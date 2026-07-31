import { UNIT1, DIGITS, MATH_PROBLEMS } from './data.js';

const COUNT_TOTALS = ['1', '2', '3', '4', '5'];
const U2 = './assets/audio/unit2/';
const SFX = './assets/audio/sfx/';

export const UNITS = [
  {
    n: 1,
    label: 'Aa Bb Cc',
    chips: ['Aa', 'Bb', 'Cc'],
    face: '🍎',
    state: 'done',
    steps: [
      { id: 'hello', icon: '🍎', tone: 'primary' },
      { id: 'whatsthis', icon: '❓', tone: 'reward' },
      { id: 'chant', icon: '🎵', tone: 'celebration' },
      { id: 'peekaboo', icon: '👀', tone: 'success' },
      { id: 'story', icon: '📖', tone: 'grape' },
      { id: 'bubbles', icon: '🫧', tone: 'primary' },
      { id: 'popup', icon: '🌟', tone: 'celebration' },
    ],
    preload: [
      ...UNIT1.map((word) => word.utter),
      './assets/audio/chant.mp3',
      SFX + 'correct.mp3',
      SFX + 'stage-clear.mp3',
      SFX + 'transition-sting.mp3',
    ],
  },
  {
    n: 2,
    label: 'Digits',
    chips: ['1 2 3', '4 5 6', '7 8 9 0'],
    face: '🔢',
    state: 'current',
    steps: [
      { id: 'numbers', icon: '🔢', tone: 'primary' },
      { id: 'count', icon: '👆', tone: 'success' },
      { id: 'howmany', icon: '❓', tone: 'reward' },
      { id: 'addup', icon: '➕', tone: 'celebration' },
      { id: 'matchup', icon: '🔎', tone: 'grape' },
    ],
    preload: [
      ...DIGITS.map((d) => d.clip),
      ...DIGITS.map((d) => `${U2}num-${d.digit}.mp3`),
      ...COUNT_TOTALS.map((d) => `${U2}total-${d}.mp3`),
      ...MATH_PROBLEMS.map((p) => p.clip),
      U2 + 'count-with-me.mp3',
      U2 + 'how-many.mp3',
      U2 + 'lets-add.mp3',
      U2 + 'find-the-number.mp3',
      U2 + 'find-that-many.mp3',
      U2 + 'nice-counting.mp3',
      U2 + 'you-know-your-numbers.mp3',
      SFX + 'correct.mp3',
      SFX + 'wrong.mp3',
      SFX + 'pop.mp3',
      SFX + 'stage-clear.mp3',
    ],
  },
];

export function findUnit(n) {
  return UNITS.find((u) => u.n === n);
}
