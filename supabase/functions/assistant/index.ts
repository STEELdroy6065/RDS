// RDS — general AI assistant Edge Function (with a search tool).
//
// A conversational assistant (like Gmail's Gemini panel). The client sends the
// running conversation plus a CONTEXT blob built from the user's real data.
// The assistant can also call a `search_rds` tool that looks up the user's
// feed messages, shared files, votes and people — executed here, server-side,
// scoped by RLS to the caller's own groups (via their JWT). The AI key lives
// here as a Supabase secret, never in the app bundle.
//
// Shares the same secrets/providers as catch-me-up (first key present wins):
//   GROQ_API_KEY -> Groq · GEMINI_API_KEY -> Gemini · ANTHROPIC_API_KEY -> Claude
// (Live search is wired for Groq's tool-calling; Gemini/Claude answer from the
//  provided context.)
//
// Deploy:  supabase functions deploy assistant

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') ?? 'llama-3.1-8b-instant';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.0-flash';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-3-5-haiku-latest';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}

// User-facing messages for upstream AI failures — never leak raw provider text
// (model names, org IDs, quotas). The real detail is logged server-side.
function friendlyAIError(status: number): string {
  if (status === 429) return 'The assistant is a bit busy right now — try again in a few minutes.';
  if (status === 401 || status === 403) return 'The assistant isn’t available right now.';
  if (status === 400) return 'The assistant couldn’t handle that request — try rephrasing or shortening it.';
  return 'The assistant is having trouble right now — please try again in a moment.';
}

// Thrown by provider calls; `friendly` marks it safe to show to users.
function upstreamError(provider: string, status: number, detail: string): Error {
  console.error(`[assistant] ${provider} ${status}: ${detail}`);
  return Object.assign(new Error(friendlyAIError(status)), { friendly: true });
}

type Msg = { role: 'user' | 'assistant'; content: string };

function systemPrompt(userName: string, context: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return (
    `You are the built-in AI assistant inside RDS — a group-coordination app for ` +
    `schools, clubs and teams. RDS has three things per group: a Feed (group chat + ` +
    `announcements), Votes (polls), and Attendance (a daily check-in). Members have a ` +
    `role: Admin, Captain, or Member.\n\n` +
    `You are helping ${userName || 'the user'}. Today is ${today}.\n\n` +
    `Use the CONTEXT below — it is their real, current data — to answer specifically ` +
    `and naturally. When the user asks you to FIND or LOOK UP something specific (a ` +
    `message, a shared file/PDF, a vote, or a person), call the search_rds tool and ` +
    `answer from what it returns. If search returns no matches, say so plainly — never ` +
    `invent a result. If something isn't in the context or search, say you don't have it.\n\n` +
    `When search finds files or images, they are automatically attached to your reply ` +
    `for the user to open — so just refer to them naturally by name (e.g. "Here's ` +
    `notes.pdf that Grace shared"). Do NOT paste raw URLs and do NOT tell the user to go ` +
    `find the file themselves.\n\n` +
    `You can also draft text on request (an announcement, a message, a poll question): ` +
    `write it ready to paste, concise, and never claim you posted or sent it — the user ` +
    `pastes it into RDS themselves. You cannot take actions in the app (post, vote, mark ` +
    `attendance); offer to draft or guide instead.\n\n` +
    `Keep replies concise and friendly. Plain text, no markdown headers.\n\n` +
    `CONTEXT:\n${context || '(no data available)'}`
  );
}

// --- Server-side search (scoped to the caller via RLS) ---------------------

type Attachment = { url: string; name: string; type: 'image' | 'file' };
type SearchResult = { text: string; attachments: Attachment[] };

async function runSearch(sb: any, query: string): Promise<SearchResult> {
  const q = (query || '').trim();
  if (!q) return { text: 'No search query was provided.', attachments: [] };
  const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  const safe = async (p: any) => {
    try {
      const { data } = await p;
      return data || [];
    } catch {
      return [];
    }
  };

  const groups = await safe(sb.from('groups').select('id, name'));
  const nameById: Record<string, string> = {};
  groups.forEach((g: any) => (nameById[g.id] = g.name));
  const gn = (id: string) => nameById[id] || 'a group';
  const day = (iso: string) => (iso || '').slice(0, 10);

  const [msgs, files, votes, people] = await Promise.all([
    safe(
      sb.from('posts').select('group_id, author_name, text, created_at')
        .eq('deleted', false).ilike('text', pattern)
        .order('created_at', { ascending: false }).limit(8)
    ),
    safe(
      sb.from('posts').select('group_id, author_name, attachment_name, attachment_type, attachment_url, created_at')
        .eq('deleted', false).ilike('attachment_name', pattern)
        .order('created_at', { ascending: false }).limit(8)
    ),
    safe(
      sb.from('votes').select('group_id, question, status, created_at')
        .ilike('question', pattern)
        .order('created_at', { ascending: false }).limit(8)
    ),
    safe(sb.from('posts').select('group_id, author_name').ilike('author_name', pattern).limit(30)),
  ]);

  const lines: string[] = [];
  const attachments: Attachment[] = [];
  const seenUrl = new Set<string>();
  if (msgs.length) {
    lines.push('Messages:');
    msgs.forEach((m: any) =>
      lines.push(`- in ${gn(m.group_id)}, ${m.author_name || 'someone'} on ${day(m.created_at)}: ${m.text}`)
    );
  }
  if (files.length) {
    lines.push('Files/images:');
    files.forEach((f: any) => {
      lines.push(
        `- "${f.attachment_name || 'file'}" (${f.attachment_type || 'file'}) shared by ${
          f.author_name || 'someone'
        } in ${gn(f.group_id)} on ${day(f.created_at)}`
      );
      // Collect the real attachment so the reply can show it inline.
      if (f.attachment_url && !seenUrl.has(f.attachment_url)) {
        seenUrl.add(f.attachment_url);
        attachments.push({
          url: f.attachment_url,
          name: f.attachment_name || 'file',
          type: f.attachment_type === 'image' ? 'image' : 'file',
        });
      }
    });
  }
  if (votes.length) {
    lines.push('Votes:');
    votes.forEach((v: any) =>
      lines.push(`- "${v.question}" in ${gn(v.group_id)} — ${v.status} (created ${day(v.created_at)})`)
    );
  }
  const seen = new Set<string>();
  const ppl: string[] = [];
  people.forEach((p: any) => {
    if (!p.author_name) return;
    const k = `${p.author_name}::${p.group_id}`;
    if (seen.has(k)) return;
    seen.add(k);
    ppl.push(`- ${p.author_name} (active in ${gn(p.group_id)})`);
  });
  if (ppl.length) {
    lines.push('People:');
    ppl.slice(0, 10).forEach((l) => lines.push(l));
  }

  if (lines.length === 0) return { text: `No matches found for "${q}".`, attachments: [] };
  return { text: lines.join('\n'), attachments };
}

// --- Providers -------------------------------------------------------------

const SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'search_rds',
    description:
      "Search the user's RDS data — feed messages (text), shared files/images (by filename), " +
      'votes (by question), and people (by name). Scoped to the user\'s groups. Call this ' +
      'whenever the user asks to find or look up something specific.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Keywords to search for.' } },
      required: ['query'],
    },
  },
};

async function chatGroq(
  system: string,
  history: Msg[],
  sb: any
): Promise<{ reply: string; attachments: Attachment[] }> {
  const messages: any[] = [{ role: 'system', content: system }, ...history];
  const found = new Map<string, Attachment>(); // dedupe attachments surfaced by search
  const collect = () => [...found.values()].slice(0, 6);

  for (let i = 0; i < 4; i++) {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 800,
        temperature: 0.4,
        messages,
        tools: [SEARCH_TOOL],
        tool_choice: 'auto',
      }),
    });
    if (!resp.ok) throw upstreamError('groq', resp.status, await resp.text());
    const data = await resp.json();
    const msg = data?.choices?.[0]?.message;
    if (!msg) throw new Error('Groq returned no message.');

    if (msg.tool_calls && msg.tool_calls.length) {
      messages.push(msg);
      for (const tc of msg.tool_calls) {
        let args: any = {};
        try {
          args = JSON.parse(tc.function?.arguments || '{}');
        } catch {
          args = {};
        }
        let result: SearchResult;
        try {
          result =
            tc.function?.name === 'search_rds'
              ? await runSearch(sb, args.query)
              : { text: `Unknown tool: ${tc.function?.name}`, attachments: [] };
        } catch (err) {
          // A search failure must not kill the whole reply — tell the model.
          result = {
            text: `The search could not be completed: ${(err as Error)?.message || 'error'}`,
            attachments: [],
          };
        }
        result.attachments.forEach((a) => {
          if (a.url && !found.has(a.url)) found.set(a.url, a);
        });
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          name: tc.function?.name,
          content: String(result.text),
        });
      }
      continue;
    }
    return { reply: (msg.content || '').trim(), attachments: collect() };
  }
  return {
    reply: 'I looked but could not settle on an answer — could you rephrase that?',
    attachments: collect(),
  };
}

async function chatGemini(system: string, history: Msg[]): Promise<string> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: history.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: 800, temperature: 0.4 },
      }),
    }
  );
  if (!resp.ok) throw upstreamError('gemini', resp.status, await resp.text());
  const data = await resp.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: any) => p?.text || '').join('').trim();
}

async function chatClaude(system: string, history: Msg[]): Promise<string> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 800, system, messages: history }),
  });
  if (!resp.ok) throw upstreamError('claude', resp.status, await resp.text());
  const data = await resp.json();
  return (data?.content?.[0]?.text || '').trim();
}

// --- Handler ---------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    if (!GROQ_API_KEY && !GEMINI_API_KEY && !ANTHROPIC_API_KEY) {
      console.error('[assistant] no AI key configured (GROQ/GEMINI/ANTHROPIC)');
      return json({ error: 'The assistant isn’t set up yet.' }, 503);
    }

    const { messages, context, userName } = await req.json().catch(() => ({}));
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'No messages provided.' }, 400);
    }

    const history: Msg[] = messages
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
      .slice(-20)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
    if (history.length === 0) return json({ error: 'No usable messages.' }, 400);

    const system = systemPrompt(String(userName || ''), String(context || ''));

    // Supabase client scoped to the caller (their JWT) so search obeys RLS.
    const authHeader = req.headers.get('Authorization') || '';
    const sb = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    let reply: string;
    let attachments: Attachment[] = [];
    if (GROQ_API_KEY) {
      const out = await chatGroq(system, history, sb);
      reply = out.reply;
      attachments = out.attachments;
    } else if (GEMINI_API_KEY) {
      reply = await chatGemini(system, history);
    } else {
      reply = await chatClaude(system, history);
    }

    if (!reply) return json({ error: 'The assistant is having trouble right now — please try again in a moment.' }, 502);
    return json({ reply, attachments });
  } catch (e) {
    // Friendly errors (from the AI providers) are safe to show; anything else
    // is logged and replaced with a generic message so no raw text leaks.
    const friendly = (e as any)?.friendly;
    if (!friendly) console.error('[assistant] handler error:', (e as Error)?.stack || e);
    const message = friendly
      ? (e as Error).message
      : 'The assistant is unavailable right now — please try again in a moment.';
    return json({ error: message }, 500);
  }
});
