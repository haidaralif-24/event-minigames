import { TILE_TYPES } from '../data/constants.js';
import boardTiles from '../data/boardTiles.json';

export const MAX_PLAYERS = 7;
export const BOARD_LENGTH = boardTiles.length;
export const RAPID_QUESTIONS = [
  { id: 'q1', text: 'What is the first month in the Islamic calendar?', answer: 'Muharram' },
  { id: 'q2', text: 'How many obligatory prayers are there each day?', answer: '5' },
  { id: 'q3', text: 'What is the name of the month in which Muslims fast?', answer: 'Ramadan' },
];
export function rollDice(sides = 6) { return Math.floor(Math.random() * sides) + 1; }
export function shuffleArray(array) { const shuffled = [...array]; for (let i = shuffled.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; } return shuffled; }
export function getInitialGameState() { return { phase: 'lobby', round: 0, turnOrder: [], activePlayerIndex: 0, boardPositions: {}, playerCheckpoints: {}, diceSize: 6, lastRoll: null, winner: null, rapidShot: { questionIndex: 0, answers: {}, scores: {}, submitted: {} }, minigame: null }; }
export function getPlayerIds(players = {}) { return Object.keys(players).filter((id) => players[id]); }
export function getActivePlayerId(gameState) { return gameState?.turnOrder?.[gameState?.activePlayerIndex ?? 0] || null; }
export function resolveRapidShotOrder(players, rapidScores = {}) { return getPlayerIds(players).sort((a, b) => (rapidScores[b] || 0) - (rapidScores[a] || 0) || Math.random() - 0.5); }
export function moveToken(gameState, steps) { const activePlayerId = getActivePlayerId(gameState); if (!activePlayerId) throw new Error('No active player.'); let newPosition = Math.min(BOARD_LENGTH - 1, (gameState.boardPositions?.[activePlayerId] || 0) + steps); const newBoardPositions = { ...(gameState.boardPositions || {}), [activePlayerId]: newPosition }; const tile = boardTiles[newPosition]; let bonusMove = 0; if (tile?.type === TILE_TYPES.BONUS || tile?.type === TILE_TYPES.PENALTY) { bonusMove = tile.move; newPosition = tile.type === TILE_TYPES.BONUS ? Math.min(BOARD_LENGTH - 1, newPosition + bonusMove) : Math.max(0, newPosition + bonusMove); newBoardPositions[activePlayerId] = newPosition; } return { boardPositions: newBoardPositions, bonusMove, tileType: tile?.type, winner: newPosition >= BOARD_LENGTH - 1 ? activePlayerId : null }; }
export function nextTurn(gameState) { const length = gameState.turnOrder?.length || 0; if (!length) return { activePlayerIndex: 0, round: gameState.round || 1 }; const nextIndex = (gameState.activePlayerIndex + 1) % length; return { activePlayerIndex: nextIndex, round: nextIndex === 0 ? (gameState.round || 1) + 1 : gameState.round }; }
export function getRankings(gameState, players = {}) { return getPlayerIds(players).sort((a, b) => (gameState.boardPositions?.[b] || 0) - (gameState.boardPositions?.[a] || 0)); }
export function getTileInfo(index) { return index < 0 || index >= boardTiles.length ? null : boardTiles[index]; }
