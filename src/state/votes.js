import React, { createContext, useContext, useMemo, useState } from 'react';
import { votesSeed } from '../data/votesSeed';

// In-memory store for all votes across all groups. No backend yet — state lives
// here for the life of the app session and is shared by every screen, so a vote
// created on one screen is immediately visible on another.

const VotesContext = createContext(null);

let seq = 0;
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${seq++}`;

export function VotesProvider({ children }) {
  const [votes, setVotes] = useState(votesSeed);

  const api = useMemo(
    () => ({
      votesForGroup: (groupId) => votes.filter((v) => v.groupId === groupId),

      getVote: (voteId) => votes.find((v) => v.id === voteId) || null,

      // Create a new open vote. `options` is an array of label strings.
      createVote: ({ groupId, question, options, visibility, creator }) => {
        const vote = {
          id: uid('v'),
          groupId,
          question: question.trim(),
          options: options
            .map((label) => label.trim())
            .filter(Boolean)
            .map((label) => ({ id: uid('o'), label })),
          visibility,
          status: 'open',
          createdBy: creator.id,
          createdByName: creator.name,
          createdAt: 'Just now',
          ballots: {},
        };
        setVotes((prev) => [vote, ...prev]);
        return vote.id;
      },

      // Cast or change the current user's single vote. No-op if closed.
      castVote: (voteId, optionId, user) => {
        setVotes((prev) =>
          prev.map((v) => {
            if (v.id !== voteId || v.status !== 'open') return v;
            return {
              ...v,
              ballots: {
                ...v.ballots,
                [user.id]: { name: user.name, optionId },
              },
            };
          })
        );
      },

      closeVote: (voteId) => {
        setVotes((prev) =>
          prev.map((v) =>
            v.id === voteId ? { ...v, status: 'closed' } : v
          )
        );
      },
    }),
    [votes]
  );

  return <VotesContext.Provider value={api}>{children}</VotesContext.Provider>;
}

export function useVotes() {
  const ctx = useContext(VotesContext);
  if (!ctx) throw new Error('useVotes must be used within a VotesProvider');
  return ctx;
}
