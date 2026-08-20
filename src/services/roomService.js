import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { getInitialGameState, MAX_PLAYERS, RAPID_QUESTIONS } from './gameLogic.js';
import { ALL_ACCOUNTS, HOST_ACCOUNT, PLAYER_ACCOUNTS } from '../data/loginAccounts.js';

const GAME_PATH = 'gameState/current';
const SESSION_KEY = 'event-minigame-player-session';
const gameRef = () => doc(db, 'gameState', 'current');

export function getSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } }
function saveSession(session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); return session; }
export function clearSession() { localStorage.removeItem(SESSION_KEY); }

export function getAccount(username, password) {
  const clean = username.trim().toLowerCase();
  return ALL_ACCOUNTS.find((account) => account.username.toLowerCase() === clean && account.password === password) || null;
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
      if (existing?.connected) throw new Error('This player is already connected on another device.');
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
    if (!room.players?.[playerId]?.connected) throw new Error('Player is not connected.');
    if (shot.submitted?.[playerId]) throw new Error('You already answered this question.');
    const expected = RAPID_QUESTIONS[index]?.answer?.trim().toLowerCase();
    const correct = answer.trim().toLowerCase() === expected;
    const score = (shot.scores?.[playerId] || 0) + (correct ? 1 : 0);
    transaction.update(ref, { [`rapidShot.answers.${playerId}`]: answer.trim(), [`rapidShot.scores.${playerId}`]: score, [`rapidShot.submitted.${playerId}`]: true, updatedAt: serverTimestamp() });
  });
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
