import { TILE_TYPES } from '../data/constants.js';
import boardTiles from '../data/boardTiles.json';

export const MAX_PLAYERS = 6;
export const BOARD_LENGTH = boardTiles.length;
export const RAPID_QUESTIONS = [
  { id: 'q1', text: 'What is the first month in the Islamic calendar?', choices: ['Muharram', 'Safar', 'Rajab', 'Ramadan'], answerIndex: 0 },
  { id: 'q2', text: 'How many obligatory prayers are there each day?', choices: ['3', '4', '5', '7'], answerIndex: 2 },
  { id: 'q3', text: 'What is the name of the month in which Muslims fast?', choices: ['Shawwal', 'Ramadan', 'Dhu al-Hijjah', "Sha'ban"], answerIndex: 1 },
  { id: 'q4', text: "During the Quraysh boycott of Banu Hashim, imposed to pressure the Prophet's (PBUH) clan into abandoning him, in which specific location outside the Kaaba did Banu Hashim and Banu al-Muttalib take refuge for roughly three years?", choices: ["Shi'b Abi Talib (the quarter/ravine of Abu Talib)", "Ta'if", 'Mount Uhud', 'The valley of Mina'], answerIndex: 0 },
  { id: 'q5', text: 'The Hilf al-Fudul (Alliance of the Virtuous) was a pre-Islamic pact in Makkah that the Prophet (PBUH) later said he would still honor even after Islam. What was its primary stated purpose?', choices: ['To defend the trade routes to Syria', 'To protect the weak and wronged, ensuring the oppressed received justice regardless of tribe', 'To unite the Quraysh clans under one leader', 'To fund the rebuilding of the Kaaba'], answerIndex: 1 },
  { id: 'q6', text: "Year 10 of Prophethood is known as 'Aam al-Huzn' (the Year of Sorrow), following the deaths of two people central to the Prophet's (PBUH) support in Makkah. Who were they?", choices: ['Abu Talib and Khadijah', 'Abu Bakr and Umar', 'Hamzah and Ja\'far', 'Waraqah ibn Nawfal and Bilal'], answerIndex: 0 },
];
export function rollDice(sides = 6) { return Math.floor(Math.random() * sides) + 1; }
export function shuffleArray(array) { const shuffled = [...array]; for (let i = shuffled.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; } return shuffled; }
// Shuffle-bag draw: returns the next id from `pool`, removing it from `bag`
// (the list of not-yet-shown ids). When the bag is empty it refills with a
// fresh shuffle of the whole pool, so every question appears exactly once per
// cycle before any repeats. `avoidId` (the most recently shown id) is kept out
// of the first slot after a refill so a question never repeats back-to-back
// across a cycle boundary.
export function drawFromBag(pool, bag, avoidId) {
  const poolIds = Array.isArray(pool) ? pool : [];
  if (!poolIds.length) return { id: null, bag: [] };
  let remaining = Array.isArray(bag) && bag.length ? [...bag] : null;
  if (!remaining) {
    remaining = shuffleArray([...poolIds]);
    if (avoidId && remaining.length > 1) {
      const lastIdx = remaining.length - 1;
      if (remaining[lastIdx] === avoidId) {
        const other = remaining.findIndex((id, idx) => idx !== lastIdx && id !== avoidId);
        if (other !== -1) { const tmp = remaining[lastIdx]; remaining[lastIdx] = remaining[other]; remaining[other] = tmp; }
      }
    }
  }
  const id = remaining.pop();
  return { id, bag: remaining };
}
export function getInitialGameState() { return { phase: 'lobby', round: 0, turnOrder: [], activePlayerIndex: 0, boardPositions: {}, playerCheckpoints: {}, diceSize: 6, lastRoll: null, rolling: null, winner: null, rapidShot: { questionIndex: 0, answers: {}, scores: {}, submitted: {} }, minigame: null, challengeBag: [], minigameBag: [] }; }
export function getPlayerIds(players = {}) { return Object.keys(players).filter((id) => players[id] && players[id].connected !== false); }
export function getActivePlayerId(gameState) { return gameState?.turnOrder?.[gameState?.activePlayerIndex ?? 0] || null; }
export function resolveRapidShotOrder(players, rapidScores = {}) { return getPlayerIds(players).sort((a, b) => (rapidScores[b] || 0) - (rapidScores[a] || 0) || Math.random() - 0.5); }
export function moveToken(gameState, steps) { const activePlayerId = getActivePlayerId(gameState); if (!activePlayerId) throw new Error('No active player.'); let newPosition = Math.min(BOARD_LENGTH - 1, (gameState.boardPositions?.[activePlayerId] || 0) + steps); const newBoardPositions = { ...(gameState.boardPositions || {}), [activePlayerId]: newPosition }; const tile = boardTiles[newPosition]; let bonusMove = 0; if (tile?.type === TILE_TYPES.BONUS || tile?.type === TILE_TYPES.PENALTY) { bonusMove = tile.move; newPosition = tile.type === TILE_TYPES.BONUS ? Math.min(BOARD_LENGTH - 1, newPosition + bonusMove) : Math.max(0, newPosition + bonusMove); newBoardPositions[activePlayerId] = newPosition; } return { boardPositions: newBoardPositions, bonusMove, tileType: tile?.type, winner: newPosition >= BOARD_LENGTH - 1 ? activePlayerId : null }; }
export function nextTurn(gameState) { const length = gameState.turnOrder?.length || 0; if (!length) return { activePlayerIndex: 0, round: gameState.round || 1 }; const nextIndex = (gameState.activePlayerIndex + 1) % length; return { activePlayerIndex: nextIndex, round: nextIndex === 0 ? (gameState.round || 1) + 1 : gameState.round }; }
export function getRankings(gameState, players = {}) { return getPlayerIds(players).sort((a, b) => (gameState.boardPositions?.[b] || 0) - (gameState.boardPositions?.[a] || 0)); }
export function getTileInfo(index) { return index < 0 || index >= boardTiles.length ? null : boardTiles[index]; }
