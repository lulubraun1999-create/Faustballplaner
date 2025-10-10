import { PlaceHolderImages } from './placeholder-images';

function getPlaceholderImage(id: string) {
  return PlaceHolderImages.find((img) => img.id === id) || PlaceHolderImages[0];
}

// News Data
export const newsData = [
  {
    id: 1,
    title: 'Leverkusen Crowned Undefeated Bundesliga Champions!',
    summary: 'Bayer Leverkusen completes a historic unbeaten season to win their first-ever Bundesliga title, a remarkable achievement under coach Xabi Alonso.',
    date: '2024-05-18',
    image: getPlaceholderImage('news-1'),
  },
  {
    id: 2,
    title: 'Xabi Alonso Commits Future to Leverkusen Amidst Top Club Interest',
    summary: 'Manager Xabi Alonso has put an end to speculation by confirming he will stay at Bayer Leverkusen next season, despite interest from Liverpool and Bayern Munich.',
    date: '2024-05-15',
    image: getPlaceholderImage('news-2'),
  },
  {
    id: 3,
    title: 'BayArena Expansion Plans Approved',
    summary: 'The club has received approval for plans to expand the BayArena, increasing capacity to 35,000 and modernizing facilities for fans.',
    date: '2024-05-12',
    image: getPlaceholderImage('news-3'),
  },
];

// Player Data
export const players = [
  {
    id: 'florian-wirtz',
    name: 'Florian Wirtz',
    number: 10,
    position: 'Attacking Midfielder',
    stats: {
      goals: 18,
      assists: 20,
      appearances: 49,
    },
    bio: 'Regarded as one of the best young talents in world football, Florian Wirtz is the creative heart of the Werkself. His vision, dribbling, and goal-scoring ability make him a constant threat.',
    image: getPlaceholderImage('player-wirtz'),
  },
  {
    id: 'victor-boniface',
    name: 'Victor Boniface',
    number: 22,
    position: 'Striker',
    stats: {
      goals: 21,
      assists: 10,
      appearances: 34,
    },
    bio: 'A powerful and clinical striker, Victor Boniface has been a revelation since joining the club. His strength, pace, and finishing have made him a key part of the team\'s success.',
    image: getPlaceholderImage('player-boniface'),
  },
  {
    id: 'granit-xhaka',
    name: 'Granit Xhaka',
    number: 34,
    position: 'Central Midfielder',
    stats: {
      goals: 3,
      assists: 2,
      appearances: 50,
    },
    bio: 'The experienced leader in the center of the park. Granit Xhaka\'s control, passing range, and tactical discipline have been instrumental in the team\'s historic season.',
    image: getPlaceholderImage('player-xhaka'),
  },
  {
    id: 'jeremie-frimpong',
    name: 'Jeremie Frimpong',
    number: 30,
    position: 'Right Wing-Back',
    stats: {
      goals: 14,
      assists: 12,
      appearances: 47,
    },
    bio: 'A lightning-fast wing-back who terrorizes opposition defenses. Frimpong\'s attacking output from the right flank is phenomenal, contributing a huge number of goals and assists.',
    image: getPlaceholderImage('player-frimpong'),
  },
  {
    id: 'alejandro-grimaldo',
    name: 'Alejandro Grimaldo',
    number: 20,
    position: 'Left Wing-Back',
    stats: {
      goals: 12,
      assists: 19,
      appearances: 51,
    },
    bio: 'A master of set-pieces and a constant creative force from the left. Grimaldo\'s technical quality and incredible assist record have been vital to the team\'s attacking prowess.',
    image: getPlaceholderImage('player-grimaldo'),
  },
  {
    id: 'jonathan-tah',
    name: 'Jonathan Tah',
    number: 4,
    position: 'Centre-Back',
    stats: {
      goals: 6,
      assists: 1,
      appearances: 48,
    },
    bio: 'The rock at the heart of the defense. Jonathan Tah\'s leadership, strength, and defensive prowess have been the foundation of the team\'s incredible unbeaten run.',
    image: getPlaceholderImage('player-tah'),
  },
];

export const getPlayerById = (id: string) => players.find((p) => p.id === id);

// Match Data
export const matchResults = [
  {
    id: 1,
    homeTeam: 'VfL Bochum',
    awayTeam: 'Bayer Leverkusen',
    homeScore: 0,
    awayScore: 5,
    date: '2024-05-12',
    competition: 'Bundesliga',
  },
  {
    id: 2,
    homeTeam: 'Bayer Leverkusen',
    awayTeam: 'AS Roma',
    homeScore: 2,
    awayScore: 2,
    date: '2024-05-09',
    competition: 'Europa League',
  },
  {
    id: 3,
    homeTeam: 'Eintracht Frankfurt',
    awayTeam: 'Bayer Leverkusen',
    homeScore: 1,
    awayScore: 5,
    date: '2024-05-05',
    competition: 'Bundesliga',
  },
];

export const upcomingMatches = [
  {
    id: 4,
    homeTeam: 'Bayer Leverkusen',
    awayTeam: 'FC Augsburg',
    date: '2024-05-18',
    time: '15:30',
    competition: 'Bundesliga',
  },
  {
    id: 5,
    homeTeam: 'Bayer Leverkusen',
    awayTeam: 'Borussia Dortmund',
    date: '2024-05-25',
    time: '20:00',
    competition: 'DFB-Pokal Final',
  },
  {
    id: 6,
    homeTeam: 'Bayer Leverkusen',
    awayTeam: 'West Ham',
    date: '2024-08-10',
    time: '16:00',
    competition: 'Pre-season Friendly',
  },
];

export const liveMatch = {
  ...upcomingMatches[0],
  status: "75'",
  homeScore: 2,
  awayScore: 1,
  events: [
    { minute: 12, player: 'Boniface', type: 'Goal' },
    { minute: 28, player: 'Demirovic', type: 'Goal' },
    { minute: 65, player: 'Wirtz', type: 'Goal' },
  ],
};

// Forum Data
export const forumTopics = [
  {
    id: 1,
    title: 'UNBEATABLE! What a season!',
    author: 'WerkselfFan_88',
    replies: 124,
    lastPost: '5 minutes ago',
  },
  {
    id: 2,
    title: 'Predictions for the DFB-Pokal Final?',
    author: 'LeverkusenLion',
    replies: 58,
    lastPost: '22 minutes ago',
  },
  {
    id: 3,
    title: 'Who was your Player of the Season?',
    author: 'Alonso_Magic',
    replies: 203,
    lastPost: '1 hour ago',
  },
  {
    id: 4,
    title: 'Summer transfer targets',
    author: 'ScoutingForGlory',
    replies: 76,
    lastPost: '3 hours ago',
  },
];
