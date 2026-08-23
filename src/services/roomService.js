import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { getInitialGameState, MAX_PLAYERS, RAPID_QUESTIONS } from './gameLogic.js';
import { ALL_ACCOUNTS, HOST_ACCOUNT, PLAYER_ACCOUNTS } from '../data/loginAccounts.js';
import boardTiles from '../data/boardTiles.json';
import challengeContent from '../content/maulid-nabi/challenge.json';

const GAME_PATH = 'gameState/current';
const SESSION_KEY = 'event-minigame-player-session';
const gameRef = () => doc(db, 'gameState', 'current');

export function getSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } }
function saveSession(session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); return session; }
export function clearSession() { localStorage.removeItem(SESSION_KEY); }

export function getAccount(username, password) {
  const cleanUser = username.trim().toLowerCase();
  const cleanPass = password.trim().toLowerCase();
  return ALL_ACCOUNTS.find((account) => account.username.toLowerCase() === cleanUser && account.password.toLowerCase() === cleanPass) || null;
}

export async function login(username, password) {
  const account = getAccount(username, password);
  if (!account) throw new Error('Incorrect username or password.');
  const ref = gameRef();
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists() ? snapshot.data() : getInitialGameState();
    const players = { ...(current.players || {}) };
    if (account.role === 'player') {
      const existing = players[account.playerId];
      players[account.playerId] = {
        id: account.playerId,
        name: account.name,
        username: account.username,
        connected: true,
        score: existing?.score || 0,
        rapidScore: existing?.rapidScore || 0,
        position: existing?.position || 0,
        joinedAt: existing?.joinedAt || serverTimestamp(),
        lastSeenAt: serverTimestamp(),
      };
    }
    const next = { ...current, players, hostId: 'host', hostName: HOST_ACCOUNT.name, maxPlayers: MAX_PLAYERS, updatedAt: serverTimestamp() };
    if (!snapshot.exists()) transaction.set(ref, next); else transaction.update(ref, next);
  });
  return saveSession({ roomCode: 'current', playerId: account.role === 'player' ? account.playerId : 'host', role: account.role, name: account.name, username: account.username });
}

export async function createRoom() { return login(HOST_ACCOUNT.username, HOST_ACCOUNT.password); }
export async function joinRoom(_unusedRoomCode, username, password) { return login(username, password); }
export function subscribeToRoom(_roomCode, callback, onError) { return onSnapshot(gameRef(), (snapshot) => callback(snapshot.exists() ? { id: GAME_PATH, ...snapshot.data() } : null), onError); }
export async function updateRoom(_roomCode, updates) { await updateDoc(gameRef(), { ...updates, updatedAt: serverTimestamp() }); }

export async function submitRapidAnswer(_roomCode, playerId, answer) {
  const ref = gameRef();
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('Game is not initialized.');
    const room = snapshot.data(); const shot = room.rapidShot || {}; const index = shot.questionIndex || 0;
    if (room.phase !== 'rapid-shot') throw new Error('Rapid shot is not active.');
    if (shot.submitted?.[playerId]) throw new Error('You already answered this question.');
    const userAns = answer.trim().toLowerCase();
    const expected = RAPID_QUESTIONS[index]?.answer?.trim().toLowerCase();
    let correct = userAns === expected;
    if (!correct && RAPID_QUESTIONS[index]?.id === 'q2') {
      correct = userAns === '5' || userAns === 'five' || userAns === 'lima';
    }
    const score = (shot.scores?.[playerId] || 0) + (correct ? 1 : 0);
    transaction.update(ref, { [`rapidShot.answers.${playerId}`]: answer.trim(), [`rapidShot.scores.${playerId}`]: score, [`rapidShot.submitted.${playerId}`]: true, updatedAt: serverTimestamp() });
  });
}

export async function markPlayerConnected(_roomCode, playerId) {
  const snapshot = await getDoc(gameRef());
  if (!snapshot.exists() || !snapshot.data().players?.[playerId]) return;
  await updateDoc(gameRef(), { [`players.${playerId}.connected`]: true, [`players.${playerId}.lastSeenAt`]: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function markPlayerDisconnected(_roomCode, playerId) {
  const snapshot = await getDoc(gameRef());
  if (!snapshot.exists() || !snapshot.data().players?.[playerId]) return;
  await updateDoc(gameRef(), { [`players.${playerId}.connected`]: false, [`players.${playerId}.lastSeenAt`]: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function resetGame() {
  const snapshot = await getDoc(gameRef());
  const players = {};
  Object.values(snapshot.exists() ? (snapshot.data().players || {}) : {}).forEach((player) => {
    players[player.id] = { id: player.id, name: player.name, username: player.username, connected: false, score: 0, rapidScore: 0, position: 0 };
  });
  await setDoc(gameRef(), { ...getInitialGameState(), players, hostId: 'host', hostName: HOST_ACCOUNT.name, maxPlayers: MAX_PLAYERS, resetAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export function getPlayerAccounts() { return PLAYER_ACCOUNTS; }

export async function rollForActivePlayer(playerId, value) {
  const roll = Math.min(6, Math.max(1, Number(value) || 1));
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(gameRef());
    if (!snapshot.exists()) throw new Error('Game is not initialized.');
    const game = snapshot.data();
    const activePlayerId = game.turnOrder?.[game.activePlayerIndex ?? 0];
    if (game.phase !== 'board' || activePlayerId !== playerId || game.lastRoll?.playerId === playerId) throw new Error('It is not your turn to roll.');

    const initialPosition = game.boardPositions?.[playerId] || 0;
    const landedPosition = Math.min(boardTiles.length - 1, initialPosition + roll);
    const landedTile = boardTiles[landedPosition];
    const boardPositions = { ...(game.boardPositions || {}), [playerId]: landedPosition };
    const playerCheckpoints = { ...(game.playerCheckpoints || {}) };
    const base = { boardPositions, playerCheckpoints, lastRoll: { value: roll, playerId, landedPosition }, updatedAt: serverTimestamp() };

    if (landedTile?.type === 'challenge') {
      const questionIndex = (landedPosition + (game.round || 0) + playerId.length) % challengeContent.questions.length;
      transaction.update(gameRef(), { ...base, phase: 'challenge', challenge: { teamId: playerId, questionId: challengeContent.questions[questionIndex].id, landedPosition, startedAt: serverTimestamp(), resolved: false } });
      return;
    }

    let finalPosition = landedPosition;
    if (landedTile?.type === 'bonus') finalPosition = Math.min(boardTiles.length - 1, landedPosition + (landedTile.move || 0));
    if (landedTile?.type === 'penalty') finalPosition = Math.max(playerCheckpoints[playerId] || 0, landedPosition + (landedTile.move || 0));
    if (landedTile?.type === 'checkpoint') playerCheckpoints[playerId] = landedPosition;
    boardPositions[playerId] = finalPosition;
    transaction.update(gameRef(), {
      ...base,
      boardPositions,
      playerCheckpoints,
      lastRoll: { value: roll, playerId, landedPosition, finalPosition, tileType: landedTile?.type || 'normal' },
      ...(finalPosition >= boardTiles.length - 1 ? { winner: playerId, phase: 'finished' } : {}),
    });
  });
}

export async function submitChallengeChoice(playerId, choiceIndex) {
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(gameRef());
    if (!snapshot.exists()) throw new Error('Game is not initialized.');
    const game = snapshot.data();
    const challenge = game.challenge;
    if (game.phase !== 'challenge' || !challenge || challenge.teamId !== playerId || challenge.resolved) throw new Error('This challenge is not available.');
    const question = challengeContent.questions.find((item) => item.id === challenge.questionId);
    if (!question) throw new Error('Challenge question not found.');

    const correct = Number(choiceIndex) === question.answerIndex;
    const playerCheckpoints = { ...(game.playerCheckpoints || {}) };
    const boardPositions = { ...(game.boardPositions || {}) };
    const currentPosition = boardPositions[playerId] || challenge.landedPosition || 0;
    const move = correct ? challengeContent.winTiles : -challengeContent.loseTiles;
    const finalPosition = correct
      ? Math.min(boardTiles.length - 1, currentPosition + move)
      : Math.max(playerCheckpoints[playerId] || 0, currentPosition + move);
    boardPositions[playerId] = finalPosition;
    if (boardTiles[finalPosition]?.type === 'checkpoint') playerCheckpoints[playerId] = finalPosition;
    transaction.update(gameRef(), {
      boardPositions,
      playerCheckpoints,
      challenge: { ...challenge, resolved: true, correct, choiceIndex: Number(choiceIndex), finalPosition, answeredAt: serverTimestamp() },
      lastChallenge: { playerId, correct, move, finalPosition },
      phase: finalPosition >= boardTiles.length - 1 ? 'finished' : 'board',
      ...(finalPosition >= boardTiles.length - 1 ? { winner: playerId } : {}),
      updatedAt: serverTimestamp(),
    });
  });
}
