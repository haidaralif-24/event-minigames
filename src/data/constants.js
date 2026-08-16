import meta from '../content/maulid-nabi/meta.json';
import questions from '../content/maulid-nabi/questions.json';
import challenge from '../content/maulid-nabi/challenge.json';

export const ACTIVE_EVENT = meta.id;
export const EVENT_META = meta;
export const EVENT_QUESTIONS = questions;
export const EVENT_CHALLENGES = challenge;

export const TEAM_COLORS = [
  '#ff4d4d',
  '#4d79ff',
  '#4dff79',
  '#ffea4d',
  '#a64dff',
  '#ff8c4d',
];

// The engine only knows these game types; the actual prompts live in the event content pack.
export const MINI_GAMES = [
  {
    id: 'rapid-shot',
    label: 'Rapid Shot',
    description: 'Answer before the timer runs out. Faster correct answers score more.',
    timeLimit: 12,
  },
  {
    id: 'quick-fire',
    label: 'Quick Fire',
    description: 'One question. One shot. Be the first team to lock the correct answer.',
    timeLimit: 10,
  },
  {
    id: 'brain-blitz',
    label: 'Brain Blitz',
    description: 'Think fast and steal the top spot for the next round.',
    timeLimit: 12,
  },
  {
    id: 'sprint-trivia',
    label: 'Sprint Trivia',
    description: 'A short trivia sprint decides who rolls first next round.',
    timeLimit: 10,
  },
];
