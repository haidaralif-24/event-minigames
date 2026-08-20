import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { getInitialGameState, MAX_PLAYERS, RAPID_QUESTIONS } from './gameLogic.js';

const ROOMS = 'rooms';
const SESSION_KEY = 'event-minigame-player-session';
const makeCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const makeId = () => crypto.randomUUID();
const hashPin = async (pin) => { const data = new TextEncoder().encode(pin); const digest = await crypto.subtle.digest('SHA-256', data); return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join(''); };

export function getSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } }
function saveSession(session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); return session; }
export function clearSession() { localStorage.removeItem(SESSION_KEY); }

export async function createRoom(hostName = 'Host') {
  let code = makeCode(); let ref = doc(db, ROOMS, code); let snapshot = await getDoc(ref);
  while (snapshot.exists()) { code = makeCode(); ref = doc(db, ROOMS, code); snapshot = await getDoc(ref); }
  const hostId = makeId();
  await setDoc(ref, { ...getInitialGameState(), phase: 'lobby', hostId, hostName: hostName.trim() || 'Host', maxPlayers: MAX_PLAYERS, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return saveSession({ roomCode: code, playerId: hostId, role: 'host', name: hostName.trim() || 'Host' });
}

export async function joinRoom(roomCode, name, pin) {
  const code = roomCode.trim().toUpperCase(); const cleanName = name.trim();
  if (!code || !cleanName || !pin) throw new Error('Room code, username and password are required.');
  const pinHash = await hashPin(pin); const ref = doc(db, ROOMS, code); let sessionPlayerId = null;
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref); if (!snapshot.exists()) throw new Error('Room not found.');
    const room = snapshot.data(); if (room.phase !== 'lobby') throw new Error('The game has already started.');
    const players = room.players || {}; const existing = Object.values(players).find((p) => p.name?.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      if (existing.connected !== false) throw new Error('That username is already connected.');
      if (existing.pinHash !== pinHash) throw new Error('Incorrect password for that username.');
      sessionPlayerId = existing.id;
      transaction.update(ref, { [`players.${existing.id}.connected`]: true, [`players.${existing.id}.reconnectedAt`]: serverTimestamp(), updatedAt: serverTimestamp() });
      return;
    }
    const activeCount = Object.values(players).filter((p) => p.connected !== false).length;
    if (activeCount >= (room.maxPlayers || MAX_PLAYERS)) throw new Error('This room is full.');
    sessionPlayerId = makeId();
    transaction.update(ref, { [`players.${sessionPlayerId}`]: { id: sessionPlayerId, name: cleanName, pinHash, score: 0, rapidScore: 0, position: 0, connected: true, joinedAt: serverTimestamp() }, updatedAt: serverTimestamp() });
  });
  return saveSession({ roomCode: code, playerId: sessionPlayerId, role: 'player', name: cleanName });
}

export function subscribeToRoom(roomCode, callback, onError) { return onSnapshot(doc(db, ROOMS, roomCode), (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null), onError); }
export async function updateRoom(roomCode, updates) { await updateDoc(doc(db, ROOMS, roomCode), { ...updates, updatedAt: serverTimestamp() }); }
export async function submitRapidAnswer(roomCode, playerId, answer) {
  const ref = doc(db, ROOMS, roomCode);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref); if (!snapshot.exists()) throw new Error('Room not found.');
    const room = snapshot.data(); const shot = room.rapidShot || {}; const index = shot.questionIndex || 0;
    if (room.phase !== 'rapid-shot') throw new Error('Rapid shot is not active.');
    if (shot.submitted?.[playerId]) throw new Error('You already answered this question.');
    const expected = RAPID_QUESTIONS[index]?.answer?.trim().toLowerCase(); const correct = answer.trim().toLowerCase() === expected;
    const score = (shot.scores?.[playerId] || 0) + (correct ? 1 : 0);
    transaction.update(ref, { [`rapidShot.answers.${playerId}`]: answer.trim(), [`rapidShot.scores.${playerId}`]: score, [`rapidShot.submitted.${playerId}`]: true, updatedAt: serverTimestamp() });
  });
}
export async function markPlayerDisconnected(roomCode, playerId) { const ref = doc(db, ROOMS, roomCode); const snapshot = await getDoc(ref); if (!snapshot.exists()) return; const players = { ...(snapshot.data().players || {}) }; if (players[playerId]) players[playerId] = { ...players[playerId], connected: false }; await updateDoc(ref, { players, updatedAt: serverTimestamp() }); }
