// RDS — "Catch me up" AI summary Edge Function.
//
// Summarizes a batch of unread group-chat messages into 3-5 sentences.
// The AI key lives here as a Supabase secret, never in the app bundle, so it
// can't be extracted from the public web build.
//
// Provider is chosen automatically (first key present wins):
//   - GROQ_API_KEY       -> Groq (free, no billing) — llama-3.3-70b-versatile
//   - GEMINI_API_KEY     -> Google Gemini (free tier where available)
//   - ANTHROPIC_API_KEY  -> Anthropic Claude (paid)
//
// Deploy:  supabase functions deploy catch-me-up
// Secret (free option, Groq):
//   supabase secrets set GROQ_API_KEY=gsk_...       # from console.groq.com/keys
//   (optional) supabase secrets set GROQ_MODEL=llama-3.3-70b-versatile
// Secret (free option, Gemini):
//   supabase secrets set GEMINI_API_KEY=...         # from aistudio.google.com/apikey
//   (optional) supabase secrets set GEMINI_MODEL=gemini-2.0-flash
// Secret (Claude option):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   (optional) supabase secrets set ANTHROPIC_MODEL=claude-3-5-haiku-latest

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

// User-facing messages for upstream AI failures — never leak raw provider text
// (model names, org IDs, quotas). The real detail is logged server-side.
function friendlyAIError(status: number): string {
  if (status === 429) return 'The AI is a bit busy right now — try again in a few minutes.';
  if (status === 401 || status === 403) return 'The summary isn’t available right now.';
  if (status === 400) return 'Couldn’t summarize this chat — there may be too much to process.';
  return 'The summary is having trouble right now — please try again in a moment.';
}

function upstreamError(provider: string, status: number, detail: string): Error {
  console.error(`[catch-me-up] ${provider} ${status}: ${detail}`);
  return Object.assign(new Error(friendlyAIError(status)), { friendly: true });
}

function lineFor(m: any): string {
  const who = m.author_name || 'Member';
  const tag = m.type === 'Announcement' ? ' (ANNOUNCEMENT)' : '';
  let body = (m.text || '').trim();
  if (!body) {
    if (m.attachment_type === 'image') body = '[shared an image]';
    else if (m.attachment_name) body = `[shared a file: ${m.attachment_name}]`;
    else if (m.attachment_type) body = '[shared an attachment]';
  }
  return `${who}${tag}: ${body}`;
}

// --- Providers -------------------------------------------------------------

async function summarizeWithGroq(prompt: string): Promise<string> {
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: 400,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!resp.ok) throw upstreamError('groq', resp.status, await resp.text());
  const data = await resp.json();
  return (data?.choices?.[0]?.message?.content || '').trim();
}

async function summarizeWithGemini(prompt: string): Promise<string> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY! },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 400, temperature: 0.3 },
      }),
    }
  );
  if (!resp.ok) throw upstreamError('gemini', resp.status, await resp.text());
  const data = await resp.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: any) => p?.text || '').join('').trim();
}

async function summarizeWithClaude(prompt: string): Promise<string> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
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
      console.error('[catch-me-up] no AI key configured (GROQ/GEMINI/ANTHROPIC)');
      return json({ error: 'The summary isn’t set up yet.' }, 503);
    }

    const { messages, groupName } = await req.json().catch(() => ({}));
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'No messages to summarize.' }, 400);
    }

    const transcript = messages.map(lineFor).join('\n');
    const prompt =
      `You are catching a group member up on messages they missed in a chat` +
      (groupName ? ` called "${groupName}"` : '') +
      `. Summarize the unread messages below in 3-5 sentences of plain prose.\n\n` +
      `- Lead with the key points / decisions.\n` +
      `- Explicitly call out any ANNOUNCEMENT messages.\n` +
      `- Clearly flag anything that seems to need a reply or an action from them.\n` +
      `- Do not restate every message or quote verbatim; do not use bullet points or headers.\n\n` +
      `Unread messages (oldest first):\n${transcript}`;

    const summary = GROQ_API_KEY
      ? await summarizeWithGroq(prompt)
      : GEMINI_API_KEY
      ? await summarizeWithGemini(prompt)
      : await summarizeWithClaude(prompt);

    if (!summary) return json({ error: 'The summary is having trouble right now — please try again in a moment.' }, 502);
    return json({ summary });
  } catch (e) {
    const friendly = (e as any)?.friendly;
    if (!friendly) console.error('[catch-me-up] handler error:', (e as Error)?.stack || e);
    const message = friendly
      ? (e as Error).message
      : 'The summary is unavailable right now — please try again in a moment.';
    return json({ error: message }, 500);
  }
});
