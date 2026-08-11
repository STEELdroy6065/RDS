// RDS — file text extraction. Called (fire-and-forget) right after an
// attachment is posted. Pulls the text out of the file and stores it on the
// post so search and the assistant can see what's *inside* it.
//
//   PDF / docx / pptx -> plain parsing, no AI (free).
//   images           -> OCR + a short description via a vision model (an AI
//                       call, so this is the one part with a cost separate
//                       from the Groq text model).
//
// Reads the post with the caller's JWT (RLS: must be a member to trigger it),
// then writes attachment_text with the service role (bypasses the lack of a
// posts UPDATE policy). The extracted text is truncated for storage.
//
// Deploy:  supabase functions deploy extract

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { extractText, getDocumentProxy } from 'npm:unpdf';
import { unzipSync, strFromU8 } from 'npm:fflate';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
// A vision-capable Groq model (does OCR + description). Overridable.
const GROQ_VISION_MODEL = Deno.env.get('GROQ_VISION_MODEL') ?? 'meta-llama/llama-4-scout-17b-16e-instruct';

const MAX_CHARS = 20000;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}
// Join the text nodes of an OOXML part (docx <w:t>, pptx <a:t>).
function joinTags(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(decodeEntities(m[1]));
  return out.join(' ');
}

async function fileBytes(url: string): Promise<Uint8Array> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download failed (${r.status})`);
  return new Uint8Array(await r.arrayBuffer());
}

async function extractPdf(url: string): Promise<string> {
  const pdf = await getDocumentProxy(await fileBytes(url));
  const res: any = await extractText(pdf, { mergePages: true });
  return Array.isArray(res.text) ? res.text.join('\n') : String(res.text || '');
}

async function extractDocx(url: string): Promise<string> {
  const files = unzipSync(await fileBytes(url));
  const part = files['word/document.xml'];
  if (!part) return '';
  const xml = strFromU8(part).replace(/<\/w:p>/g, '\n');
  return joinTags(xml, 'w:t');
}

async function extractPptx(url: string): Promise<string> {
  const files = unzipSync(await fileBytes(url));
  const slides = Object.keys(files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => {
      const n = (s: string) => parseInt(s.replace(/\D/g, ''), 10) || 0;
      return n(a) - n(b);
    });
  return slides.map((s) => joinTags(strFromU8(files[s]), 'a:t')).join('\n');
}

// OCR + description in one vision call.
async function describeImage(url: string): Promise<string> {
  if (!GROQ_API_KEY) return '';
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      max_tokens: 600,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'Transcribe ALL text visible in this image, exactly as written. ' +
                'Then on a new line write "DESCRIPTION:" followed by one short sentence ' +
                'describing what the image shows. If there is no readable text, only give the DESCRIPTION.',
            },
            { type: 'image_url', image_url: { url } },
          ],
        },
      ],
    }),
  });
  if (!resp.ok) {
    console.error('[extract] vision', resp.status, await resp.text());
    return '';
  }
  const data = await resp.json();
  return (data?.choices?.[0]?.message?.content || '').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { postId } = await req.json().catch(() => ({}));
    if (!postId) return json({ error: 'postId required' }, 400);

    // Read the post as the caller (RLS: only a group member can see it).
    const authHeader = req.headers.get('Authorization') || '';
    const asUser = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: post } = await asUser
      .from('posts')
      .select('id, attachment_url, attachment_name, attachment_type, attachment_mime')
      .eq('id', postId)
      .single();
    if (!post || !post.attachment_url) return json({ error: 'No such attachment.' }, 404);

    const name = (post.attachment_name || '').toLowerCase();
    const mime = (post.attachment_mime || '').toLowerCase();
    const ext = name.includes('.') ? name.split('.').pop() : '';
    const isImage = post.attachment_type === 'image' || mime.startsWith('image/');

    let text = '';
    try {
      if (isImage) text = await describeImage(post.attachment_url);
      else if (mime.includes('pdf') || ext === 'pdf') text = await extractPdf(post.attachment_url);
      else if (ext === 'docx' || mime.includes('word')) text = await extractDocx(post.attachment_url);
      else if (ext === 'pptx' || mime.includes('presentation')) text = await extractPptx(post.attachment_url);
      // Other types (txt, unknown) are left empty.
    } catch (err) {
      console.error('[extract] parse error:', (err as Error)?.message);
    }

    text = (text || '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_CHARS);

    // Persist with the service role (no posts UPDATE policy exists for authors).
    const admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    await admin
      .from('posts')
      .update({ attachment_text: text || null, attachment_text_status: text ? 'done' : 'failed' })
      .eq('id', postId);

    return json({ ok: true, chars: text.length });
  } catch (e) {
    console.error('[extract] handler error:', (e as Error)?.stack || e);
    return json({ error: 'Extraction failed.' }, 500);
  }
});
