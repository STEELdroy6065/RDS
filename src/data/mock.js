// All content here is placeholder/mock data for the UI-only skeleton.
// No network, no persistence — screens read from these constants and hold
// any interaction (e.g. poll votes) in local component state.

export const currentUser = {
  name: 'Jordan Lee',
  handle: '@jordan',
  role: 'Student · Lincoln High',
  stats: {
    groups: 3,
    votesCast: 27,
    attendance: '94%',
  },
};

export const groups = [
  {
    id: 'g1',
    name: 'Lincoln HS Soccer',
    role: 'Captain',
    members: 22,
    emoji: '⚽️',
    kind: 'Team',
  },
  {
    id: 'g2',
    name: 'Robotics Club',
    role: 'Member',
    members: 15,
    emoji: '🤖',
    kind: 'Club',
  },
  {
    id: 'g3',
    name: 'AP Bio Study Group',
    role: 'Organizer',
    members: 9,
    emoji: '🧬',
    kind: 'Class',
  },
];

// Feed posts keyed by group id.
export const feedByGroup = {
  g1: [
    {
      id: 'p1',
      type: 'Announcement',
      author: 'Coach Rivera',
      text: 'Saturday scrimmage moved to the turf field. Cleats + shin guards required.',
      time: '2h',
    },
    {
      id: 'p2',
      type: 'Event',
      author: 'Jordan Lee',
      text: 'Team dinner after Friday’s home game — sign up in Votes for a time.',
      time: '5h',
    },
    {
      id: 'p3',
      type: 'Update',
      author: 'Sam Okafor',
      text: 'New jerseys arrived! Grab yours from the equipment room this week.',
      time: '1d',
    },
  ],
  g2: [
    {
      id: 'p1',
      type: 'Announcement',
      author: 'Ms. Chen',
      text: 'Regional qualifier registration closes Friday. Confirm your slot.',
      time: '3h',
    },
    {
      id: 'p2',
      type: 'Update',
      author: 'Priya N.',
      text: 'Drivetrain v2 is assembled — testing tonight in the lab.',
      time: '1d',
    },
  ],
  g3: [
    {
      id: 'p1',
      type: 'Event',
      author: 'Jordan Lee',
      text: 'Review session for Unit 6 this Thursday. Bring your practice FRQs.',
      time: '4h',
    },
    {
      id: 'p2',
      type: 'Update',
      author: 'Alex Kim',
      text: 'Shared the cellular respiration flashcards in the group drive.',
      time: '2d',
    },
  ],
};

// Poll seed keyed by group id — screens copy this into local state.
export const pollByGroup = {
  g1: {
    question: 'What time works best for Saturday practice?',
    options: [
      { id: 'o1', label: '9:00 AM', votes: 8 },
      { id: 'o2', label: '11:00 AM', votes: 5 },
      { id: 'o3', label: '2:00 PM', votes: 3 },
    ],
  },
  g2: {
    question: 'Which project should we prioritize next sprint?',
    options: [
      { id: 'o1', label: 'Autonomous nav', votes: 6 },
      { id: 'o2', label: 'Arm redesign', votes: 7 },
      { id: 'o3', label: 'Vision system', votes: 2 },
    ],
  },
  g3: {
    question: 'When should we hold the exam review?',
    options: [
      { id: 'o1', label: 'Thu after school', votes: 5 },
      { id: 'o2', label: 'Sat morning', votes: 3 },
      { id: 'o3', label: 'Sun evening', votes: 1 },
    ],
  },
};

// Members keyed by group id.
export const membersByGroup = {
  g1: [
    { id: 'm1', name: 'Coach Rivera', role: 'Coach' },
    { id: 'm2', name: 'Jordan Lee', role: 'Captain' },
    { id: 'm3', name: 'Sam Okafor', role: 'Player' },
    { id: 'm4', name: 'Maya Torres', role: 'Player' },
    { id: 'm5', name: 'Diego Alvarez', role: 'Player' },
    { id: 'm6', name: 'Ella Fournier', role: 'Player' },
  ],
  g2: [
    { id: 'm1', name: 'Ms. Chen', role: 'Advisor' },
    { id: 'm2', name: 'Priya Nadar', role: 'Lead' },
    { id: 'm3', name: 'Jordan Lee', role: 'Member' },
    { id: 'm4', name: 'Owen Brooks', role: 'Member' },
    { id: 'm5', name: 'Hana Sato', role: 'Member' },
  ],
  g3: [
    { id: 'm1', name: 'Jordan Lee', role: 'Organizer' },
    { id: 'm2', name: 'Alex Kim', role: 'Member' },
    { id: 'm3', name: 'Riley Cooper', role: 'Member' },
    { id: 'm4', name: 'Noah Bennett', role: 'Member' },
  ],
};

export const alerts = [
  {
    id: 'a1',
    kind: 'vote',
    title: 'New poll in Lincoln HS Soccer',
    body: 'Coach Rivera asked: What time works best for Saturday practice?',
    time: '12m',
    unread: true,
  },
  {
    id: 'a2',
    kind: 'announcement',
    title: 'Announcement · Robotics Club',
    body: 'Regional qualifier registration closes Friday.',
    time: '3h',
    unread: true,
  },
  {
    id: 'a3',
    kind: 'attendance',
    title: 'Attendance recorded',
    body: 'You were marked present for AP Bio review session.',
    time: 'Yesterday',
    unread: false,
  },
];
