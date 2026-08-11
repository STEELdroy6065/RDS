// RDS — general AI assistant Edge Function (tool-driven).
//
// The assistant answers with the help of TARGETED query tools instead of a big
// context dump: it decides which lookup a question needs, runs a precise
// database query (fast whether there are 10 or 10,000 messages), and only uses
// the AI to phrase the final answer. Language-only tasks (summaries, drafting,
// open-ended chat) still go straight to the model.
//
// All tools run here, server-side, against a Supabase client scoped to the
// caller's JWT — so every query obeys RLS (the user only ever sees their own
// groups). The AI key lives here as a secret, never in the app bundle.
//
// Provider (first key present wins): GROQ (tool-calling) · GEMINI · ANTHROPIC.
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

function friendlyAIError(status: number): string {
  if (status === 429) return 'The assistant is a bit busy right now — try again in a few minutes.';
  if (status === 401 || status === 403) return 'The assistant isn’t available right now.';
  if (status === 400) return 'The assistant couldn’t handle that request — try rephrasing or shortening it.';
  return 'The assistant is having trouble right now — please try again in a moment.';
}
function upstreamError(provider: string, status: number, detail: string): Error {
  console.error(`[assistant] ${provider} ${status}: ${detail}`);
  return Object.assign(new Error(friendlyAIError(status)), { friendly: true });
}

type Msg = { role: 'user' | 'assistant'; content: string };
type Attachment = { url: string; name: string; type: 'image' | 'file' };
type Group = { id: string; name: string; role: string; members: number };
type ToolResult = { text: string; attachments?: Attachment[] };

// ---------------------------------------------------------------------------
// Tool context + helpers
// ---------------------------------------------------------------------------

type Ctx = {
  sb: any;
  groups: Group[];
  byId: Record<string, Group>;
  lastSeen: Record<string, string>;
  userId: string | null;
  today: string; // YYYY-MM-DD (UTC)
  todayStart: string; // ISO start of today (UTC)
};

const day = (iso: string) => (iso || '').slice(0, 10);

function resolveGroups(ctx: Ctx, arg?: string): Group[] {
  if (!arg || !arg.trim()) return ctx.groups;
  const a = arg.trim().toLowerCase();
  const byId = ctx.groups.filter((g) => g.id === arg);
  if (byId.length) return byId;
  const byName = ctx.groups.filter((g) => g.name.toLowerCase().includes(a));
  return byName.length ? byName : ctx.groups;
}

async function countPosts(build: any): Promise<number> {
  try {
    const { count } = await build;
    return count ?? 0;
  } catch {
    return 0;
  }
}
async function rows(build: any): Promise<any[]> {
  try {
    const { data } = await build;
    return data || [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

async function toolWhatsHappening(ctx: Ctx): Promise<ToolResult> {
  if (ctx.groups.length === 0) return { text: 'The user is not in any groups.' };
  const lines: string[] = [`Snapshot for ${ctx.today}:`];
  for (const g of ctx.groups) {
    const todayCount = await countPosts(
      ctx.sb.from('posts').select('*', { count: 'exact', head: true })
        .eq('group_id', g.id).eq('deleted', false).gte('created_at', ctx.todayStart)
    );
    let unread = 'n/a';
    const seen = ctx.lastSeen[g.id];
    if (seen) {
      let b = ctx.sb.from('posts').select('*', { count: 'exact', head: true })
        .eq('group_id', g.id).eq('deleted', false).gt('created_at', seen);
      if (ctx.userId) b = b.neq('author_id', ctx.userId);
      unread = String(await countPosts(b));
    }
    const openVotes = await countPosts(
      ctx.sb.from('votes').select('*', { count: 'exact', head: true })
        .eq('group_id', g.id).eq('status', 'open')
    );
    const att = await rows(
      ctx.sb.from('attendance_records').select('status, present_count, total_count')
        .eq('group_id', g.id).eq('date', ctx.today).limit(1)
    );
    const attStr = att.length
      ? att[0].status === 'submitted'
        ? `marked${att[0].present_count != null ? ` (${att[0].present_count}/${att[0].total_count})` : ''}`
        : att[0].status.replace(/_/g, ' ')
      : 'not marked yet';
    lines.push(
      `- ${g.name}: ${unread} unread, ${todayCount} message(s) today, ${openVotes} open vote(s), attendance ${attStr}`
    );
  }
  return { text: lines.join('\n') };
}

const FILE_COLS =
  'id, group_id, author_name, attachment_name, attachment_type, attachment_url, attachment_text, created_at';
const esc = (s: string) => String(s).replace(/[\\%_]/g, '\\$&');

function snippetAround(text: string, term: string): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  const idx = clean.toLowerCase().indexOf((term || '').toLowerCase());
  if (idx < 0 || !term) return clean.slice(0, 160);
  const s = Math.max(0, idx - 50);
  const e = Math.min(clean.length, idx + term.length + 90);
  return (s > 0 ? '…' : '') + clean.slice(s, e) + (e < clean.length ? '…' : '');
}

async function toolFindFiles(ctx: Ctx, args: any): Promise<ToolResult> {
  const ids = resolveGroups(ctx, args.group).map((g) => g.id);
  const term = args.name || args.content;

  const base = () => {
    let b = ctx.sb.from('posts').select(FILE_COLS)
      .eq('deleted', false).not('attachment_url', 'is', null).in('group_id', ids)
      .order('created_at', { ascending: false }).limit(12);
    if (args.kind === 'image') b = b.eq('attachment_type', 'image');
    else if (args.kind === 'file') b = b.neq('attachment_type', 'image');
    if (args.sender) b = b.ilike('author_name', `%${esc(args.sender)}%`);
    if (args.since) b = b.gte('created_at', String(args.since));
    if (args.until) b = b.lte('created_at', String(args.until));
    return b;
  };

  // Match by filename and/or by extracted content, then merge.
  const queries: any[] = [];
  if (term) {
    queries.push(base().ilike('attachment_name', `%${esc(term)}%`));
    queries.push(base().ilike('attachment_text', `%${esc(term)}%`));
  } else {
    queries.push(base()); // no term → just filter by sender/kind/date
  }
  const results = await Promise.all(queries.map((q) => rows(q)));

  const byId: Record<string, any> = {};
  results.flat().forEach((f: any) => (byId[f.id] = f));
  const found = Object.values(byId)
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 12);
  if (found.length === 0) return { text: 'No matching files or images were found.' };

  const attachments: Attachment[] = [];
  const lines = found.map((f: any) => {
    attachments.push({
      url: f.attachment_url,
      name: f.attachment_name || (f.attachment_type === 'image' ? 'image' : 'file'),
      type: f.attachment_type === 'image' ? 'image' : 'file',
    });
    const gname = (ctx.byId[f.group_id] || {}).name || 'a group';
    let line = `- ${f.attachment_type === 'image' ? 'image' : 'file'} "${f.attachment_name || 'untitled'}" from ${
      f.author_name || 'someone'
    } in ${gname} on ${day(f.created_at)}`;
    if (term && f.attachment_text && f.attachment_text.toLowerCase().includes(String(term).toLowerCase())) {
      line += `\n    match: "${snippetAround(f.attachment_text, term)}"`;
    }
    return line;
  });
  return { text: `Found ${found.length}:\n${lines.join('\n')}`, attachments: attachments.slice(0, 6) };
}

// Return a file's already-extracted text so the model can analyze/summarize it.
async function toolReadFile(ctx: Ctx, args: any): Promise<ToolResult> {
  const ids = resolveGroups(ctx, args.group).map((g) => g.id);
  const term = args.name || args.query;
  const build = (col: string) => {
    let b = ctx.sb.from('posts').select(FILE_COLS)
      .eq('deleted', false).not('attachment_text', 'is', null).in('group_id', ids)
      .order('created_at', { ascending: false }).limit(3);
    if (args.sender) b = b.ilike('author_name', `%${esc(args.sender)}%`);
    if (term) b = b.ilike(col, `%${esc(term)}%`);
    return b;
  };
  let found = term ? await rows(build('attachment_name')) : await rows(build('attachment_name'));
  if (found.length === 0 && term) found = await rows(build('attachment_text'));
  if (found.length === 0) {
    return { text: 'No file with readable text matched. (Files are readable once their text has been extracted.)' };
  }
  const f: any = found[0];
  const gname = (ctx.byId[f.group_id] || {}).name || 'a group';
  const body = String(f.attachment_text || '').slice(0, 8000);
  return {
    text:
      `Contents of "${f.attachment_name || 'file'}" (shared by ${f.author_name || 'someone'} in ${gname} on ${day(
        f.created_at
      )}):\n\n${body}`,
    attachments: [
      {
        url: f.attachment_url,
        name: f.attachment_name || 'file',
        type: f.attachment_type === 'image' ? 'image' : 'file',
      },
    ],
  };
}

async function toolCheckAttendance(ctx: Ctx, args: any): Promise<ToolResult> {
  const date = (args.date && String(args.date)) || ctx.today;
  const groups = resolveGroups(ctx, args.group);
  const lines: string[] = [`Attendance for ${date}:`];
  for (const g of groups) {
    const rec = await rows(
      ctx.sb.from('attendance_records').select('status, present_count, total_count')
        .eq('group_id', g.id).eq('date', date).limit(1)
    );
    if (!rec.length) lines.push(`- ${g.name}: not marked`);
    else if (rec[0].status === 'submitted')
      lines.push(
        `- ${g.name}: marked${rec[0].present_count != null ? ` (${rec[0].present_count}/${rec[0].total_count} present)` : ''}`
      );
    else lines.push(`- ${g.name}: ${rec[0].status.replace(/_/g, ' ')}`);
  }
  return { text: lines.join('\n') };
}

async function toolListVotes(ctx: Ctx, args: any): Promise<ToolResult> {
  const groups = resolveGroups(ctx, args.group);
  const ids = groups.map((g) => g.id);
  const status = args.status === 'closed' ? 'closed' : args.status === 'all' ? null : 'open';
  let vb = ctx.sb.from('votes').select('id, group_id, question, visibility, status, created_at')
    .in('group_id', ids).order('created_at', { ascending: false }).limit(15);
  if (status) vb = vb.eq('status', status);
  const votes = await rows(vb);
  if (votes.length === 0) return { text: 'No matching votes.' };

  const out: string[] = [];
  for (const v of votes) {
    const gname = (ctx.byId[v.group_id] || {}).name || 'a group';
    const opts = await rows(
      ctx.sb.from('vote_options').select('id, label, position').eq('vote_id', v.id).order('position')
    );
    const ballots = await rows(ctx.sb.from('vote_ballots').select('option_id').eq('vote_id', v.id));
    const tally: Record<string, number> = {};
    ballots.forEach((x: any) => (tally[x.option_id] = (tally[x.option_id] || 0) + 1));
    const total = ballots.length;
    out.push(`- "${v.question}" (${gname}, ${v.status})`);
    if (total === 0 && v.visibility === 'hidden' && v.status === 'open') {
      out.push('    results hidden until the vote closes');
    } else if (opts.length) {
      opts.forEach((o: any) => out.push(`    ${o.label}: ${tally[o.id] || 0}`));
    }
  }
  return { text: out.join('\n') };
}

async function toolListMembers(ctx: Ctx, args: any): Promise<ToolResult> {
  const groups = resolveGroups(ctx, args.group);
  const lines: string[] = [];
  for (const g of groups) {
    const mem = await rows(ctx.sb.from('memberships').select('role').eq('group_id', g.id));
    const byRole: Record<string, number> = {};
    mem.forEach((m: any) => (byRole[m.role] = (byRole[m.role] || 0) + 1));
    const breakdown = Object.entries(byRole).map(([r, n]) => `${n} ${r}`).join(', ') || `${g.members} member(s)`;
    // Names aren't stored per membership (no profiles table); surface who's
    // been active from message authors as the best available "who".
    const authors = await rows(
      ctx.sb.from('posts').select('author_name').eq('group_id', g.id).not('author_name', 'is', null).limit(50)
    );
    const names = [...new Set(authors.map((a: any) => a.author_name).filter(Boolean))].slice(0, 10);
    lines.push(`- ${g.name}: ${mem.length} members (${breakdown}).`);
    if (names.length) lines.push(`    recently active: ${names.join(', ')}`);
  }
  return {
    text:
      lines.join('\n') +
      '\n(Note: individual member names aren’t stored yet, only roles/counts and who has posted.)',
  };
}

async function toolActivityCounts(ctx: Ctx, args: any): Promise<ToolResult> {
  const groups = resolveGroups(ctx, args.group);
  const since = (args.since && String(args.since)) ||
    new Date(Date.now() - 7 * 86400000).toISOString();
  const lines: string[] = [`Message activity since ${day(since)}:`];
  for (const g of groups) {
    let b = ctx.sb.from('posts').select('*', { count: 'exact', head: true })
      .eq('group_id', g.id).eq('deleted', false).gte('created_at', since);
    if (args.until) b = b.lte('created_at', String(args.until));
    lines.push(`- ${g.name}: ${await countPosts(b)} message(s)`);
  }
  return { text: lines.join('\n') };
}

async function toolGetMessages(ctx: Ctx, args: any): Promise<ToolResult> {
  const groups = resolveGroups(ctx, args.group);
  const ids = groups.map((g) => g.id);
  const limit = Math.min(Math.max(parseInt(args.limit, 10) || 25, 1), 40);
  let b = ctx.sb.from('posts')
    .select('group_id, author_name, type, text, attachment_type, attachment_name, created_at')
    .eq('deleted', false).in('group_id', ids)
    .order('created_at', { ascending: false }).limit(limit);
  if (args.query) b = b.ilike('text', `%${String(args.query).replace(/[\\%_]/g, '\\$&')}%`);
  if (args.sender) b = b.ilike('author_name', `%${String(args.sender).replace(/[\\%_]/g, '\\$&')}%`);
  if (args.since) b = b.gte('created_at', String(args.since));
  if (args.until) b = b.lte('created_at', String(args.until));

  const msgs = await rows(b);
  if (msgs.length === 0) return { text: 'No matching messages.' };
  const lines = msgs.reverse().map((m: any) => {
    const gname = (ctx.byId[m.group_id] || {}).name || 'a group';
    const body =
      (m.text || '').trim() ||
      (m.attachment_type === 'image'
        ? `[image${m.attachment_name ? `: ${m.attachment_name}` : ''}]`
        : m.attachment_type
        ? `[file${m.attachment_name ? `: ${m.attachment_name}` : ''}]`
        : '');
    return `- [${gname}] ${m.author_name || 'someone'}${
      m.type === 'Announcement' ? ' (ANNOUNCEMENT)' : ''
    } (${day(m.created_at)}): ${body}`;
  });
  return { text: lines.join('\n') };
}

const TOOL_DEFS = [
  {
    name: 'whats_happening',
    description:
      "Structured snapshot across all the user's groups: unread count, messages today, open vote count, and today's attendance status per group. Use for 'what's happening', 'anything I missed', 'catch me up on everything', daily overviews.",
    parameters: { type: 'object', properties: {} },
    run: (ctx: Ctx) => toolWhatsHappening(ctx),
  },
  {
    name: 'find_files',
    description:
      'Find files/images shared in the feed by name, by what is INSIDE them (extracted/OCR text), sender, group, date range, and/or kind. Use for "find the PDF", "the handout about photosynthesis", "images Grace shared", "files from last week". Prefer sender/kind/date over name for images (they rarely have meaningful filenames); use `content` to search inside files.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'part of the filename' },
        content: { type: 'string', description: 'text expected INSIDE the file/image' },
        sender: { type: 'string', description: 'who shared it' },
        group: { type: 'string', description: 'group name (optional)' },
        kind: { type: 'string', enum: ['image', 'file', 'any'], description: 'restrict to images or documents' },
        since: { type: 'string', description: 'ISO date lower bound' },
        until: { type: 'string', description: 'ISO date upper bound' },
      },
    },
    run: (ctx: Ctx, a: any) => toolFindFiles(ctx, a),
  },
  {
    name: 'read_file',
    description:
      "Read a file's already-extracted text so you can analyze or summarize it. Use when asked to 'summarize the PDF', 'what does this handout say', 'analyze the document/photo'. Works for PDFs, docx, pptx, and images (OCR + description) alike, since the text was extracted at upload.",
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'part of the filename' },
        query: { type: 'string', description: 'text expected inside it (optional)' },
        sender: { type: 'string', description: 'who shared it (optional)' },
        group: { type: 'string', description: 'group name (optional)' },
      },
    },
    run: (ctx: Ctx, a: any) => toolReadFile(ctx, a),
  },
  {
    name: 'check_attendance',
    description: "Attendance status for a group (or all groups) on a date (defaults to today). Use for 'has attendance been marked', 'who was present'.",
    parameters: {
      type: 'object',
      properties: {
        group: { type: 'string', description: 'group name (optional = all)' },
        date: { type: 'string', description: 'YYYY-MM-DD (optional = today)' },
      },
    },
    run: (ctx: Ctx, a: any) => toolCheckAttendance(ctx, a),
  },
  {
    name: 'list_votes',
    description: "List a group's votes and their current results. Defaults to open votes. Use for 'open polls', 'vote results', 'what are we deciding'.",
    parameters: {
      type: 'object',
      properties: {
        group: { type: 'string', description: 'group name (optional = all)' },
        status: { type: 'string', enum: ['open', 'closed', 'all'] },
      },
    },
    run: (ctx: Ctx, a: any) => toolListVotes(ctx, a),
  },
  {
    name: 'list_members',
    description: "Who's in a group and their roles (counts per role + who's been active). Use for 'who's in this group', 'how many admins'.",
    parameters: {
      type: 'object',
      properties: { group: { type: 'string', description: 'group name (optional = all)' } },
    },
    run: (ctx: Ctx, a: any) => toolListMembers(ctx, a),
  },
  {
    name: 'activity_counts',
    description: "Count of messages per group over a time range (defaults to the last 7 days). Use for 'how active', 'how many messages this week'.",
    parameters: {
      type: 'object',
      properties: {
        group: { type: 'string', description: 'group name (optional = all)' },
        since: { type: 'string', description: 'ISO lower bound (optional)' },
        until: { type: 'string', description: 'ISO upper bound (optional)' },
      },
    },
    run: (ctx: Ctx, a: any) => toolActivityCounts(ctx, a),
  },
  {
    name: 'get_messages',
    description:
      'Fetch recent feed messages for a group (newest first, capped), optionally filtered by text/sender/date. Use this to READ the actual discussion — for summaries ("catch me up on Steel"), or "find the message where…". Do not use it just to count.',
    parameters: {
      type: 'object',
      properties: {
        group: { type: 'string', description: 'group name (optional = all)' },
        query: { type: 'string', description: 'text to match (optional)' },
        sender: { type: 'string', description: 'author to match (optional)' },
        limit: { type: 'integer', description: 'max messages (default 25, max 40)' },
        since: { type: 'string', description: 'ISO lower bound (optional)' },
        until: { type: 'string', description: 'ISO upper bound (optional)' },
      },
    },
    run: (ctx: Ctx, a: any) => toolGetMessages(ctx, a),
  },
];

const TOOL_MAP: Record<string, (ctx: Ctx, a: any) => Promise<ToolResult>> = Object.fromEntries(
  TOOL_DEFS.map((t) => [t.name, t.run])
);
const GROQ_TOOLS = TOOL_DEFS.map((t) => ({
  type: 'function',
  function: { name: t.name, description: t.description, parameters: t.parameters },
}));

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function systemPrompt(userName: string, groups: Group[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const groupList = groups.length
    ? groups.map((g) => `- ${g.name} (your role: ${g.role}, ${g.members} member(s))`).join('\n')
    : '- (none yet)';
  return (
    `You are the built-in AI assistant inside RDS — a group-coordination app for ` +
    `schools, clubs and teams. Each group has a Feed (chat + announcements), Votes, and ` +
    `daily Attendance. Roles: Admin, Captain, Member.\n\n` +
    `You are helping ${userName || 'the user'}. Today is ${today}.\n\n` +
    `The user's groups:\n${groupList}\n\n` +
    `IMPORTANT: You do NOT know the user's messages, files, votes, attendance, members, ` +
    `or counts on your own. Whenever a question needs that data, CALL THE RIGHT TOOL and ` +
    `answer strictly from what it returns. Never guess or invent counts, dates, names, ` +
    `filenames, or vote results. If a tool returns nothing, say so plainly.\n\n` +
    `When find_files (or any tool) returns files/images, they are automatically attached ` +
    `to your reply for the user to open — refer to them naturally by name; do NOT paste ` +
    `raw URLs or tell the user to go find them.\n\n` +
    `You can also draft text (announcements, messages, poll questions) — write it ready to ` +
    `paste, concise, and never claim you posted it. You cannot take actions in the app ` +
    `(post, vote, mark attendance); offer to draft or guide instead.\n\n` +
    `Keep replies concise and friendly. Plain text, no markdown headers.`
  );
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

async function chatGroq(
  system: string,
  history: Msg[],
  ctx: Ctx
): Promise<{ reply: string; attachments: Attachment[] }> {
  const messages: any[] = [{ role: 'system', content: system }, ...history];
  const found = new Map<string, Attachment>();
  const collect = () => [...found.values()].slice(0, 6);

  for (let i = 0; i < 5; i++) {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 800,
        temperature: 0.3,
        messages,
        tools: GROQ_TOOLS,
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
        let result: ToolResult;
        const fn = TOOL_MAP[tc.function?.name];
        try {
          result = fn ? await fn(ctx, args) : { text: `Unknown tool: ${tc.function?.name}` };
        } catch (err) {
          result = { text: `That lookup could not be completed: ${(err as Error)?.message || 'error'}` };
        }
        (result.attachments || []).forEach((a) => {
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
  return { reply: 'I looked but could not settle on an answer — could you rephrase that?', attachments: collect() };
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

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    if (!GROQ_API_KEY && !GEMINI_API_KEY && !ANTHROPIC_API_KEY) {
      console.error('[assistant] no AI key configured');
      return json({ error: 'The assistant isn’t set up yet.' }, 503);
    }

    const body = await req.json().catch(() => ({}));
    const { messages, userName, groups: rawGroups, lastSeen } = body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'No messages provided.' }, 400);
    }

    const history: Msg[] = messages
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
      .slice(-20)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
    if (history.length === 0) return json({ error: 'No usable messages.' }, 400);

    const groups: Group[] = Array.isArray(rawGroups)
      ? rawGroups
          .filter((g: any) => g && g.id && g.name)
          .map((g: any) => ({ id: g.id, name: g.name, role: g.role || 'Member', members: g.members || 1 }))
      : [];

    const system = systemPrompt(String(userName || ''), groups);

    // Scoped client (RLS as the caller) for all tool queries.
    const authHeader = req.headers.get('Authorization') || '';
    const sb = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    let reply: string;
    let attachments: Attachment[] = [];
    if (GROQ_API_KEY) {
      let userId: string | null = null;
      try {
        const { data } = await sb.auth.getUser();
        userId = data?.user?.id || null;
      } catch {
        userId = null;
      }
      const now = new Date();
      const ctx: Ctx = {
        sb,
        groups,
        byId: Object.fromEntries(groups.map((g) => [g.id, g])),
        lastSeen: (lastSeen && typeof lastSeen === 'object') ? lastSeen : {},
        userId,
        today: now.toISOString().slice(0, 10),
        todayStart: now.toISOString().slice(0, 10) + 'T00:00:00Z',
      };
      const out = await chatGroq(system, history, ctx);
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
    const friendly = (e as any)?.friendly;
    if (!friendly) console.error('[assistant] handler error:', (e as Error)?.stack || e);
    const message = friendly
      ? (e as Error).message
      : 'The assistant is unavailable right now — please try again in a moment.';
    return json({ error: message }, 500);
  }
});
