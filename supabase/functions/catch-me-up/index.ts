// RDS — "Catch me up" AI summary Edge Function.
//
// Summarizes a batch of unread group-chat messages into 3-5 sentences using
// Anthropic's Claude API. The API key lives here as a Supabase secret, never in
// the app bundle, so it can't be extracted from the public web build.
//
// Deploy:  supabase functions deploy catch-me-up
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//          (optional) supabase secrets set ANTHROPIC_MODEL=claude-3-5-haiku-latest

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY is not configured.' }, 500);

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

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return json({ error: `AI request failed (${resp.status}).`, detail }, 502);
    }

    const data = await resp.json();
    const summary = (data?.content?.[0]?.text || '').trim();
    if (!summary) return json({ error: 'The AI returned an empty summary.' }, 502);
    return json({ summary });
  } catch (e) {
    return json({ error: (e as Error)?.message || 'Unexpected error.' }, 500);
  }
});
