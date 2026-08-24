import meta from '../content/maulid-nabi/meta.json';
import questions from '../content/maulid-nabi/questions.json';
import challenge from '../content/maulid-nabi/challenge.json';

export const ACTIVE_EVENT = meta.id;
export const EVENT_META = meta;
export const EVENT_QUESTIONS = questions;
export const EVENT_CHALLENGES = challenge;
export const ACTIVE_META = meta;
export const NUM_PLAYERS = 6;
export const MAX_PLAYERS = 6;
export const BOARD_LENGTH = 67;
export const DICE_SIZE = 6;
export const HOST_PIN = 'dadarzz';
export const TOKEN_COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ec4899'];
export const TEAM_COLORS = TOKEN_COLORS;
export const TILE_TYPES = { START: 'start', NORMAL: 'normal', BONUS: 'bonus', PENALTY: 'penalty', FINISH: 'finish', CHALLENGE: 'challenge' };
export const PHASES = { LOBBY: 'lobby', RAPID_SHOT: 'rapid-shot', ORDER_REVEAL: 'order-reveal', BOARD: 'board', MINIGAME: 'minigame', FINISHED: 'finished' };

// The engine still exposes the event's four game templates for future rounds.
export const MINI_GAMES = [
  { id: 'rapid-shot', label: 'Rapid Shot', description: 'Answer before the timer runs out.', timeLimit: 15 },
  { id: 'quick-fire', label: 'Quick Fire', description: 'One question. One shot.', timeLimit: 15 },
  { id: 'brain-blitz', label: 'Brain Blitz', description: 'Think fast and steal the top spot.', timeLimit: 15 },
  { id: 'sprint-trivia', label: 'Sprint Trivia', description: 'A short trivia sprint decides who rolls first next round.', timeLimit: 15 },
];
