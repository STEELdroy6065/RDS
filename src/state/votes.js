import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';

// Votes backed by Supabase. Data is fetched into a cache keyed by vote id (and
// an index by group). RLS enforces who may see/create/close votes and which
// ballots are readable, so the client just renders what it's allowed to load.

const VotesContext = createContext(null);

function relTime(iso) {
  if (!iso) return '';
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Shape a raw vote row (+ its options/ballots/count) into the object the UI and
// voteRules expect.
function buildVote(row, options, ballots, total) {
  const ballotMap = {};
  ballots.forEach((b) => {
    ballotMap[b.user_id] = { name: b.voter_name || 'Group member', optionId: b.option_id };
  });
  return {
    id: row.id,
    groupId: row.group_id,
    question: row.question,
    visibility: row.visibility,
    status: row.status,
    kind: row.kind || 'poll',
    termEnds: row.term_ends || null,
    createdBy: row.created_by,
    createdByName: row.creator_name || 'Someone',
    createdAt: relTime(row.created_at),
    options: [...options]
      .sort((a, b) => a.position - b.position)
      .map((o) => ({ id: o.id, label: o.label, candidateId: o.candidate_id || null })),
    ballots: ballotMap,
    total: typeof total === 'number' ? total : Object.keys(ballotMap).length,
  };
}

export function VotesProvider({ children }) {
  const [votesById, setVotesById] = useState({});
  const [voteIdsByGroup, setVoteIdsByGroup] = useState({});

  // Load every vote in a group (with options, readable ballots, and counts).
  const refreshGroup = useCallback(async (groupId) => {
    const { data: rows, error } = await supabase
      .from('votes')
      .select('id, group_id, question, visibility, status, kind, term_ends, created_by, creator_name, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    if (error) return;

    const ids = (rows || []).map((r) => r.id);
    let options = [];
    let ballots = [];
    let counts = [];
    if (ids.length) {
      const [optRes, balRes, cntRes] = await Promise.all([
        supabase.from('vote_options').select('id, vote_id, label, position, candidate_id').in('vote_id', ids),
        supabase.from('vote_ballots').select('vote_id, option_id, user_id, voter_name').in('vote_id', ids),
        supabase.rpc('vote_counts', { gid: groupId }),
      ]);
      options = optRes.data || [];
      ballots = balRes.data || [];
      counts = cntRes.data || [];
    }

    const countByVote = {};
    counts.forEach((c) => {
      countByVote[c.vote_id] = c.total;
    });

    const built = {};
    (rows || []).forEach((row) => {
      built[row.id] = buildVote(
        row,
        options.filter((o) => o.vote_id === row.id),
        ballots.filter((b) => b.vote_id === row.id),
        countByVote[row.id] || 0
      );
    });

    setVotesById((prev) => ({ ...prev, ...built }));
    setVoteIdsByGroup((prev) => ({ ...prev, [groupId]: ids }));
  }, []);

  // Load a single vote (used by the detail screen).
  const refreshVote = useCallback(async (voteId) => {
    const { data: row, error } = await supabase
      .from('votes')
      .select('id, group_id, question, visibility, status, kind, term_ends, created_by, creator_name, created_at')
      .eq('id', voteId)
      .maybeSingle();
    if (error || !row) {
      setVotesById((prev) => {
        const next = { ...prev };
        delete next[voteId];
        return next;
      });
      return;
    }

    const [optRes, balRes, cntRes] = await Promise.all([
      supabase.from('vote_options').select('id, vote_id, label, position, candidate_id').eq('vote_id', voteId),
      supabase.from('vote_ballots').select('vote_id, option_id, user_id, voter_name').eq('vote_id', voteId),
      supabase.rpc('vote_participation', { vid: voteId }),
    ]);

    const built = buildVote(
      row,
      optRes.data || [],
      balRes.data || [],
      typeof cntRes.data === 'number' ? cntRes.data : 0
    );
    setVotesById((prev) => ({ ...prev, [voteId]: built }));
  }, []);

  // Options may be plain label strings (a poll) or { label, candidateId }
  // objects (a captain election). Elections also carry kind + termEnds.
  const createVote = useCallback(
    async ({ groupId, question, options, visibility, creator, kind = 'poll', termEnds = null }) => {
      const { data: vote, error } = await supabase
        .from('votes')
        .insert({
          group_id: groupId,
          question: question.trim(),
          visibility,
          kind,
          term_ends: termEnds,
          created_by: creator.id,
          creator_name: creator.name,
        })
        .select()
        .single();
      if (error) throw error;

      const rows = options
        .map((o, i) => {
          const label = (typeof o === 'string' ? o : o.label || '').trim();
          const candidateId = typeof o === 'string' ? null : o.candidateId || null;
          return { vote_id: vote.id, label, position: i, candidate_id: candidateId };
        })
        .filter((r) => r.label);
      const { error: oErr } = await supabase.from('vote_options').insert(rows);
      if (oErr) throw oErr;

      await refreshGroup(groupId);
      return vote.id;
    },
    [refreshGroup]
  );

  // Close a captain election: transfers the role to the winner (server-side).
  // Returns the winner's user id.
  const closeElection = useCallback(
    async (voteId) => {
      const { data, error } = await supabase.rpc('close_election', { vid: voteId });
      if (error) throw error;
      await refreshVote(voteId);
      return data;
    },
    [refreshVote]
  );

  const castVote = useCallback(
    async (voteId, optionId, user) => {
      const { error } = await supabase.from('vote_ballots').upsert(
        {
          vote_id: voteId,
          option_id: optionId,
          user_id: user.id,
          voter_name: user.name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'vote_id,user_id' }
      );
      if (error) throw error;
      await refreshVote(voteId);
    },
    [refreshVote]
  );

  const closeVote = useCallback(
    async (voteId) => {
      const { error } = await supabase
        .from('votes')
        .update({ status: 'closed' })
        .eq('id', voteId);
      if (error) throw error;
      await refreshVote(voteId);
    },
    [refreshVote]
  );

  // Delete a vote entirely (creator or group Admin/Captain, enforced by RLS).
  const deleteVote = useCallback(async (voteId) => {
    const { error } = await supabase.from('votes').delete().eq('id', voteId);
    if (error) throw error;
    setVotesById((prev) => {
      const next = { ...prev };
      delete next[voteId];
      return next;
    });
    setVoteIdsByGroup((prev) => {
      const next = {};
      Object.keys(prev).forEach((gid) => {
        next[gid] = prev[gid].filter((id) => id !== voteId);
      });
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      votesForGroup: (groupId) =>
        (voteIdsByGroup[groupId] || []).map((id) => votesById[id]).filter(Boolean),
      getVote: (voteId) => votesById[voteId] || null,
      refreshGroup,
      refreshVote,
      createVote,
      castVote,
      closeVote,
      closeElection,
      deleteVote,
    }),
    [votesById, voteIdsByGroup, refreshGroup, refreshVote, createVote, castVote, closeVote, closeElection, deleteVote]
  );

  return <VotesContext.Provider value={value}>{children}</VotesContext.Provider>;
}

export function useVotes() {
  const ctx = useContext(VotesContext);
  if (!ctx) throw new Error('useVotes must be used within a VotesProvider');
  return ctx;
}
