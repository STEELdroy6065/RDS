import { currentUser } from './mock';

// Seed votes — pre-existing polls so each group opens with something real.
// Ballots use actual member names (see membersByGroup) so the "named votes"
// UI has real people in it. Chosen to exercise every rule:
//
//   g1 · live, open, created by Coach Rivera
//        → current user (Captain) can vote, but can't close it.
//   g1 · hidden, open, created by the current user (Captain)
//        → only the creator can preview results and close it.
//   g2 · live, open, created by Priya
//        → current user is a Member here: can vote, but sees no create action.
//   g3 · live, CLOSED, created by Alex Kim
//        → results (with names) are visible to everyone; voting is locked.

export const votesSeed = [
  {
    id: 'v_g1_practice',
    groupId: 'g1',
    question: 'What time works best for Saturday practice?',
    options: [
      { id: 'o1', label: '9:00 AM' },
      { id: 'o2', label: '11:00 AM' },
      { id: 'o3', label: '2:00 PM' },
    ],
    visibility: 'live',
    status: 'open',
    createdBy: 'u_rivera',
    createdByName: 'Coach Rivera',
    createdAt: '2h ago',
    ballots: {
      u_rivera: { name: 'Coach Rivera', optionId: 'o1' },
      u_sam: { name: 'Sam Okafor', optionId: 'o1' },
      u_maya: { name: 'Maya Torres', optionId: 'o2' },
      u_diego: { name: 'Diego Alvarez', optionId: 'o1' },
      u_ella: { name: 'Ella Fournier', optionId: 'o3' },
    },
  },
  {
    id: 'v_g1_kit',
    groupId: 'g1',
    question: 'Which kit color should we run next season?',
    options: [
      { id: 'o1', label: 'Navy' },
      { id: 'o2', label: 'Crimson' },
      { id: 'o3', label: 'White' },
    ],
    visibility: 'hidden',
    status: 'open',
    createdBy: currentUser.id,
    createdByName: currentUser.name,
    createdAt: '25m ago',
    ballots: {
      u_sam: { name: 'Sam Okafor', optionId: 'o1' },
      u_maya: { name: 'Maya Torres', optionId: 'o2' },
      u_diego: { name: 'Diego Alvarez', optionId: 'o1' },
    },
  },
  {
    id: 'v_g2_sprint',
    groupId: 'g2',
    question: 'Which project should we prioritize next sprint?',
    options: [
      { id: 'o1', label: 'Autonomous nav' },
      { id: 'o2', label: 'Arm redesign' },
      { id: 'o3', label: 'Vision system' },
    ],
    visibility: 'live',
    status: 'open',
    createdBy: 'u_priya',
    createdByName: 'Priya Nadar',
    createdAt: '4h ago',
    ballots: {
      u_chen: { name: 'Ms. Chen', optionId: 'o2' },
      u_owen: { name: 'Owen Brooks', optionId: 'o1' },
      u_hana: { name: 'Hana Sato', optionId: 'o2' },
    },
  },
  {
    id: 'v_g3_review',
    groupId: 'g3',
    question: 'When should we hold the exam review?',
    options: [
      { id: 'o1', label: 'Thu after school' },
      { id: 'o2', label: 'Sat morning' },
      { id: 'o3', label: 'Sun evening' },
    ],
    visibility: 'live',
    status: 'closed',
    createdBy: 'u_alex',
    createdByName: 'Alex Kim',
    createdAt: 'Yesterday',
    ballots: {
      u_alex: { name: 'Alex Kim', optionId: 'o1' },
      u_riley: { name: 'Riley Cooper', optionId: 'o1' },
      u_noah: { name: 'Noah Bennett', optionId: 'o2' },
      [currentUser.id]: { name: currentUser.name, optionId: 'o1' },
    },
  },
];
