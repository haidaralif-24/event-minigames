import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { getInitialGameState, MAX_PLAYERS, RAPID_QUESTIONS, drawFromBag } from './gameLogic.js';
import { ALL_ACCOUNTS, HOST_ACCOUNT, PLAYER_ACCOUNTS } from '../data/loginAccounts.js';
import boardTiles from '../data/boardTiles.json';
import challengeContent from '../content/maulid-nabi/challenge.json';
import minigameQuestions from '../content/maulid-nabi/minigameQuestions.json';
import extraMinigameQuestions from '../content/maulid-nabi/questions.json';

// Combined mini-game pool: the dedicated minigame bank plus the 12 questions
// from questions.json, so every authored question is actually used. Normalised
// to the `text` field the UI renders (questions.json uses `prompt`).
export const MINIGAME_QUESTIONS = [
  ...minigameQuestions,
  ...extraMinigameQuestions.map((question) => ({ ...question, text: question.text ?? question.prompt })),
];

const GAME_PATH = 'gameState/current';

// Firestore transactions on the single shared game document contend heavily
// with 4–6 players + host all writing at once, so commits routinely fail with
// `failed-precondition` (optimistic-concurrency conflict). Retry those
// transient conflicts with backoff so a roll/answer doesn't just drop — a
// dropped transaction leaves `rolling` stuck and stalls the whole game, which
// is what made questions stop appearing. SDK's own retry is disabled (the `1`
// arg) so we own the retry loop and can log it.
const TRANSIENT_TXN_CODES = ['aborted', 'failed-precondition'];
async function runTransactionWithRetry(transactionFn, { maxAttempts = 6, baseDelayMs = 200 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await runTransaction(db, transactionFn, { maxAttempts: 1 });
      return;
    } catch (error) {
      lastError = error;
      const message = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
      const transient = TRANSIENT_TXN_CODES.some((code) => message.includes(code));
      if (!transient) throw error;
      if (attempt < maxAttempts - 1) {
        const delay = baseDelayMs * 2 ** attempt;
        console.warn(`[firestore] transaction conflict (attempt ${attempt + 1}/${maxAttempts}) — retrying in ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
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
  await runTransactionWithRetry(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists() ? snapshot.data() : getInitialGameState();
    const players = { ...(current.players || {}) };
    if (account.role === 'player') {
      const existing = players[account.playerId];
      players[account.playerId] = {
        id: account.playerId,
        name: account.name,
        avatar: account.avatar,
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

// Pick the next mini-game quiz question from a shuffle-bag so every question
// appears exactly once per cycle (no repeats until the whole pool is used).
// Returns both the chosen id and the updated bag to persist in game state.
export function pickMinigameQuestion(bag, previousQuestionId) {
  const pool = MINIGAME_QUESTIONS.map((question) => question.id);
  return drawFromBag(pool, bag, previousQuestionId);
}

export async function submitMinigameAnswer(_roomCode, playerId, choiceIndex) {
  const ref = gameRef();
  await runTransactionWithRetry(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('Game is not initialized.');
    const game = snapshot.data();
    if (game.phase !== 'minigame') throw new Error('No mini-game in progress.');
    if (game.minigame?.submitted?.[playerId]) return;
    transaction.update(ref, {
      [`minigame.answers.${playerId}`]: { choiceIndex: Number(choiceIndex), answeredAt: serverTimestamp() },
      [`minigame.submitted.${playerId}`]: true,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function submitRapidAnswer(_roomCode, playerId, choiceIndex) {
  const ref = gameRef();
  await runTransactionWithRetry(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('Game is not initialized.');
    const room = snapshot.data(); const shot = room.rapidShot || {}; const index = shot.questionIndex || 0;
    if (room.phase !== 'rapid-shot') throw new Error('Rapid shot is not active.');
    if (shot.submitted?.[playerId]) throw new Error('You already answered this question.');
    const question = RAPID_QUESTIONS[index];
    const correct = Number(choiceIndex) === question?.answerIndex;
    const score = (shot.scores?.[playerId] || 0) + (correct ? 1 : 0);
    transaction.update(ref, {
      [`rapidShot.answers.${playerId}`]: Number(choiceIndex),
      [`rapidShot.scores.${playerId}`]: score,
      [`rapidShot.submitted.${playerId}`]: true,
      updatedAt: serverTimestamp(),
    });
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
  const avatarById = Object.fromEntries(PLAYER_ACCOUNTS.map((account) => [account.playerId, account.avatar]));
  const players = {};
  Object.values(snapshot.exists() ? (snapshot.data().players || {}) : {}).forEach((player) => {
    players[player.id] = { id: player.id, name: player.name, avatar: player.avatar || avatarById[player.id] || null, username: player.username, connected: false, score: 0, rapidScore: 0, position: 0 };
  });
  await setDoc(gameRef(), { ...getInitialGameState(), players, hostId: 'host', hostName: HOST_ACCOUNT.name, maxPlayers: MAX_PLAYERS, resetAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export function getPlayerAccounts() { return PLAYER_ACCOUNTS; }

// Step 1 of a synced roll: mark the active player as "rolling" in Firestore
// so every connected view (host, spectator board, other players) can render
// the same live dice animation instead of only the roller seeing it locally.
export async function beginRoll(playerId) {
  await runTransactionWithRetry(async (transaction) => {
    const snapshot = await transaction.get(gameRef());
    if (!snapshot.exists()) throw new Error('Game is not initialized.');
    const game = snapshot.data();
    const activePlayerId = game.turnOrder?.[game.activePlayerIndex ?? 0];
    if (game.phase !== 'board' || activePlayerId !== playerId) throw new Error('It is not your turn to roll.');
    if (game.rolling?.playerId) throw new Error('A roll is already in progress.');
    // Block a same-turn double roll: after the active player has already rolled
    // (lastRoll.playerId set) but the turn hasn't auto-advanced yet (~2.2s
    // window), a second roll would move them again and skip the next team.
    if (game.lastRoll?.playerId === playerId) throw new Error('You already rolled this turn — wait for the next player.');
    transaction.update(gameRef(), { rolling: { playerId, startedAt: serverTimestamp() }, lastRoll: null, updatedAt: serverTimestamp() });
  });
}

// Step 2: resolve the roll's outcome once the shared animation has played out
// on the rolling player's device, and clear the "rolling" flag for everyone.
export async function rollForActivePlayer(playerId, value) {
  // Single die (1d6) — a smaller average step paces a full game to roughly
  // 30 minutes with 5-6 players on the 67-tile board. Sanitized to 1..6 so a
  // malformed client value can't break movement.
  const roll = Math.min(6, Math.max(1, Number(value) || 1));
  await runTransactionWithRetry(async (transaction) => {
    const snapshot = await transaction.get(gameRef());
    if (!snapshot.exists()) throw new Error('Game is not initialized.');
    const game = snapshot.data();
    const activePlayerId = game.turnOrder?.[game.activePlayerIndex ?? 0];
    if (game.phase !== 'board' || activePlayerId !== playerId) throw new Error('It is not your turn to roll.');

    const finishIndex = boardTiles.length - 1;
    const initialPosition = game.boardPositions?.[playerId] || 0;
    // Clamp-and-win: an overshoot past the last tile simply lands on the
    // finish (no exact-landing bounce-back), so a high roll near the end
    // still wins instead of reversing the leftover steps.
    const landedPosition = Math.min(finishIndex, initialPosition + roll);
    const landedTile = boardTiles[landedPosition];
    const boardPositions = { ...(game.boardPositions || {}), [playerId]: landedPosition };
    const playerCheckpoints = { ...(game.playerCheckpoints || {}) };
    const base = { boardPositions, playerCheckpoints, rolling: null, lastRoll: { value: roll, playerId, landedPosition }, updatedAt: serverTimestamp() };

    if (landedTile?.type === 'challenge') {
      const pool = challengeContent.questions.map((question) => question.id);
      const { id: challengeQuestionId, bag: challengeBag } = drawFromBag(pool, game.challengeBag, game.challenge?.questionId);
      transaction.update(gameRef(), { ...base, phase: 'challenge', challenge: { teamId: playerId, questionId: challengeQuestionId, landedPosition, startedAt: serverTimestamp(), resolved: false }, challengeBag });
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
  await runTransactionWithRetry(async (transaction) => {
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
      // Carry the resolved finalPosition into lastRoll so the host auto-advance
      // key is stable for challenge turns (it reads lastRoll.finalPosition ??
      // lastRoll.landedPosition) and the turn advances exactly once.
      lastRoll: { ...(game.lastRoll || {}), playerId, finalPosition },
      challenge: { ...challenge, resolved: true, correct, choiceIndex: Number(choiceIndex), finalPosition, answeredAt: serverTimestamp() },
      lastChallenge: { playerId, correct, move, finalPosition },
      phase: finalPosition >= boardTiles.length - 1 ? 'finished' : 'board',
      ...(finalPosition >= boardTiles.length - 1 ? { winner: playerId } : {}),
      updatedAt: serverTimestamp(),
    });
  });
}
