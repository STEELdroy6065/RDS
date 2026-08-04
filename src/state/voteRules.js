// Pure, dependency-free rules for the Votes module. Keeping the logic here (not
// in components) makes the role- and visibility-based behavior easy to reason
// about and, later, to unit-test.
//
// Vote shape:
//   {
//     id, groupId, question,
//     options: [{ id, label }],
//     visibility: 'live' | 'hidden',   // while OPEN: are counts/names shown?
//     status: 'open' | 'closed',
//     createdBy, createdByName, createdAt,
//     ballots: { [userId]: { name, optionId } }   // one entry per voter
//   }

export const ROLES = { ADMIN: 'Admin', CAPTAIN: 'Captain', MEMBER: 'Member' };

// --- Tallying -------------------------------------------------------------

export function totalVotes(vote) {
  return Object.keys(vote.ballots).length;
}

export function countForOption(vote, optionId) {
  return Object.values(vote.ballots).filter((b) => b.optionId === optionId)
    .length;
}

export function percentForOption(vote, optionId) {
  const total = totalVotes(vote);
  if (!total) return 0;
  return Math.round((countForOption(vote, optionId) / total) * 100);
}

// Voters who picked a given option, e.g. [{ userId, name }].
export function votersForOption(vote, optionId) {
  return Object.entries(vote.ballots)
    .filter(([, b]) => b.optionId === optionId)
    .map(([userId, b]) => ({ userId, name: b.name }));
}

// The option this user picked, or null.
export function choiceOf(vote, userId) {
  return vote.ballots[userId] ? vote.ballots[userId].optionId : null;
}

// --- Permissions ----------------------------------------------------------

// Only Captains and Admins may create votes.
export function canCreateVote(role) {
  return role === ROLES.CAPTAIN || role === ROLES.ADMIN;
}

export function isCreator(vote, userId) {
  return vote.createdBy === userId;
}

// Only the creator can close their own vote, and only while it's open.
export function canCloseVote(vote, userId) {
  return vote.status === 'open' && isCreator(vote, userId);
}

// Votes can be cast/changed only while the vote is open.
export function canVote(vote) {
  return vote.status === 'open';
}

// The core visibility rule. Counts + voter names are revealed when:
//   • the vote is closed (always, to everyone), OR
//   • the vote is "live", OR
//   • you are the creator (so you can decide when to close a hidden vote).
// Otherwise (open + hidden + not creator) results stay concealed.
export function canSeeResults(vote, userId) {
  return (
    vote.status === 'closed' ||
    vote.visibility === 'live' ||
    isCreator(vote, userId)
  );
}

// A short status descriptor for chips/labels.
export function statusLabel(vote) {
  if (vote.status === 'closed') return 'Closed';
  return vote.visibility === 'live' ? 'Live' : 'Hidden';
}
