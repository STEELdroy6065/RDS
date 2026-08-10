// RDS — general AI assistant Edge Function.
//
// A conversational assistant (like Gmail's Gemini panel). The client sends the
// running conversation plus a CONTEXT blob built from the user's real data
// (groups, open votes, today's attendance, recent feed activity). The AI key
// lives here as a Supabase secret, never in the app bundle.
//
// Shares the same secrets/providers as catch-me-up (first key present wins):
//   GROQ_API_KEY -> Groq · GEMINI_API_KEY -> Gemini · ANTHROPIC_API_KEY -> Claude
//
// Deploy:  supabase functions deploy assistant
// (Secrets are project-wide, so if catch-me-up already works, this does too.)

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') ?? 'llama-3.3-70b-versatile';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.0-flash';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-3-5-haiku-latest';

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
    `and naturally (e.g. "You have one open vote in Steel, and attendance hasn't been ` +
    `marked in Students yet today"). If something isn't in the context, say you don't ` +
    `have that info rather than inventing it.\n\n` +
    `What you can do:\n` +
    `- Answer questions about their groups, open votes, attendance, and recent messages.\n` +
    `- Draft text on request (an announcement, a message, a poll question). Write the ` +
    `suggested text clearly and ready to paste; keep it concise. Never claim you posted ` +
    `or sent it — you only draft, the user pastes it into RDS themselves.\n` +
    `- Otherwise just chat helpfully.\n\n` +
    `What you cannot do: take actions in the app (you cannot post, vote, or mark ` +
    `attendance). If asked, explain you can draft or guide, but they do it in the app.\n\n` +
    `Keep replies concise and friendly. Plain text, no markdown headers.\n\n` +
    `CONTEXT:\n${context || '(no data available)'}`
  );
}

// --- Providers -------------------------------------------------------------

async function chatGroq(system: string, history: Msg[]): Promise<string> {
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: 800,
      temperature: 0.4,
      messages: [{ role: 'system', content: system }, ...history],
    }),
  });
  if (!resp.ok) throw new Error(`Groq request failed (${resp.status}): ${await resp.text()}`);
  const data = await resp.json();
  return (data?.choices?.[0]?.message?.content || '').trim();
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
  if (!resp.ok) throw new Error(`Gemini request failed (${resp.status}): ${await resp.text()}`);
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
  if (!resp.ok) throw new Error(`Claude request failed (${resp.status}): ${await resp.text()}`);
  const data = await resp.json();
  return (data?.content?.[0]?.text || '').trim();
}

// --- Handler ---------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    if (!GROQ_API_KEY && !GEMINI_API_KEY && !ANTHROPIC_API_KEY) {
      return json({ error: 'No AI key configured. Set GROQ_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY.' }, 500);
    }

    const { messages, context, userName } = await req.json().catch(() => ({}));
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'No messages provided.' }, 400);
    }

    // Keep only role/content, cap history length.
    const history: Msg[] = messages
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
      .slice(-20)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));

    if (history.length === 0) return json({ error: 'No usable messages.' }, 400);

    const system = systemPrompt(String(userName || ''), String(context || ''));

    const reply = GROQ_API_KEY
      ? await chatGroq(system, history)
      : GEMINI_API_KEY
      ? await chatGemini(system, history)
      : await chatClaude(system, history);

    if (!reply) return json({ error: 'The AI returned an empty reply.' }, 502);
    return json({ reply });
  } catch (e) {
    return json({ error: (e as Error)?.message || 'Unexpected error.' }, 500);
  }
});
