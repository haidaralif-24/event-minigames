import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, runTransaction, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, authPersistenceReady, db } from '../firebase';
import boardTiles from '../data/boardTiles.json';
import { EVENT_QUESTIONS, MINI_GAMES, TEAM_COLORS } from '../data/constants.js';

const TEAM_IDS = ['team-1', 'team-2', 'team-3', 'team-4', 'team-5', 'team-6'];
const FINISH_TILE = 66;
const OPENING_QUESTION_COUNT = 3;
const OPENING_TIME_LIMIT = 8;
const ROUND_MINIGAME_TIME_LIMIT = 12;
const CHALLENGE_TIME_LIMIT = 15;
const SESSION_TIMEOUT_MS = 30000;
const EMPTY_GAME = { phase: 'lobby', round: 1, turnOrder: [], activeTeamIndex: 0, activeTeamId: null, boardPositions: {}, teams: {}, winner: null, rankings: [], opening: null, minigame: null, challenge: null, dice: { status: 'waiting', die1: null, die2: null, total: null, teamId: null, rolledAt: null } };
function shuffle(items) { const result = [...items]; for (let i = result.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } return result; }
function questionById(id) { return EVENT_QUESTIONS.find((question) => question.id === id) || null; }
function getNextIndex(order, currentIndex) { return order.length ? (currentIndex + 1) % order.length : 0; }
function rankScores(scores, previousOrder = []) { const previousRank = Object.fromEntries(previousOrder.map((id, index) => [id, index])); return Object.entries(scores || {}).sort(([a, scoreA], [b, scoreB]) => scoreB - scoreA || (previousRank[a] ?? 99) - (previousRank[b] ?? 99) || a.localeCompare(b)).map(([teamId], index) => ({ teamId, position: index + 1 })); }
function buildRankingsByPosition(positions) { return Object.entries(positions || {}).sort(([, a], [, b]) => b - a).map(([teamId], index) => ({ teamId, position: index + 1 })); }
function chooseRoundGame() { const template = MINI_GAMES[Math.floor(Math.random() * MINI_GAMES.length)] || MINI_GAMES[0]; const question = shuffle(EVENT_QUESTIONS)[0]; return { template, question }; }

function resolveMoveOutcome(current, teamId, finalPosition) {
  const positions = { ...(current.boardPositions || {}), [teamId]: finalPosition };
  const reachedFinish = finalPosition >= FINISH_TILE;
  const order = current.turnOrder || [];
  const currentIndex = current.activeTeamIndex || 0;
  const nextIndex = getNextIndex(order, currentIndex);
  const completedRound = nextIndex === 0;
  if (reachedFinish) {
    return { boardPositions: positions, phase: 'finished', winner: teamId, rankings: buildRankingsByPosition(positions), finishedAt: Date.now() };
  }
  if (completedRound) {
    const { template, question } = chooseRoundGame();
    return {
      boardPositions: positions,
      phase: 'minigame',
      activeTeamIndex: 0,
      activeTeamId: null,
      minigame: {
        type: template.id,
        label: template.label,
        description: template.description,
        questionIds: [question.id],
        questionIndex: 0,
        questionCount: 1,
        timeLimit: template.timeLimit || ROUND_MINIGAME_TIME_LIMIT,
        startedAt: Timestamp.now(),
        status: 'playing',
        answers: {},
        scores: Object.fromEntries(order.map((id) => [id, 0])),
      },
    };
  }
  return { boardPositions: positions, activeTeamIndex: nextIndex, activeTeamId: order[nextIndex], round: current.round || 1 };
}

export function useGameEngine() {
  const [game, setGame] = useState(EMPTY_GAME); const [gameLoaded, setGameLoaded] = useState(false); const [gameExists, setGameExists] = useState(false);
  useEffect(() => { let unsubscribeSnapshot = () => {}; let unsubscribeAuth = () => {}; let cancelled = false; const startSubscription = (user) => { if (cancelled) return; if (!user) { setGameLoaded(true); setGameExists(false); return; } unsubscribeSnapshot(); unsubscribeSnapshot = onSnapshot(doc(db, 'gameState', 'current'), (snap) => { if (cancelled) return; setGameExists(snap.exists()); setGameLoaded(true); if (snap.exists()) setGame(snap.data()); }, (error) => { console.error('game state subscription failed:', error); setGameLoaded(true); }); }; authPersistenceReady.then(() => { if (!cancelled) unsubscribeAuth = onAuthStateChanged(auth, startSubscription); }).catch(() => { if (!cancelled) unsubscribeAuth = onAuthStateChanged(auth, startSubscription); }); return () => { cancelled = true; unsubscribeAuth(); unsubscribeSnapshot(); }; }, []);

  const initLobby = useCallback(async () => { if (!auth.currentUser) throw new Error('You must be signed in as the host.'); await setDoc(doc(db, 'gameState', 'current'), { ...EMPTY_GAME, teams: {} }); }, []);
  const joinTeam = useCallback(async (teamId, sessionId) => { const user = auth.currentUser; if (!user || !sessionId || !TEAM_IDS.includes(teamId)) return { ok: false, error: 'Invalid team session.' }; const gameRef = doc(db, 'gameState', 'current'); const now = Date.now(); try { return await runTransaction(db, async (transaction) => { const snap = await transaction.get(gameRef); if (!snap.exists()) return { ok: false, error: 'Waiting for the host to open the lobby.' }; const data = snap.data(); if (data.phase !== 'lobby') return { ok: false, error: 'The game has already started.' }; const existing = data.teams?.[teamId]; const active = existing?.sessionId && now - (existing.lastSeenAt || existing.joinedAt || 0) < SESSION_TIMEOUT_MS; if (active && existing.sessionId !== sessionId) return { ok: false, error: 'This team is already connected.' }; if (existing?.uid && existing.uid !== user.uid) return { ok: false, error: 'This team is already claimed.' }; transaction.update(gameRef, { [`teams.${teamId}`]: { name: existing?.name || `Team ${teamId.split('-')[1]}`, color: TEAM_COLORS[Number(teamId.split('-')[1]) - 1], joinedAt: existing?.joinedAt || now, sessionId, uid: user.uid, email: user.email, lastSeenAt: now } }); return { ok: true }; }); } catch (error) { console.error(error); return { ok: false, error: error?.code === 'permission-denied' ? 'Firebase denied the join. Check Firestore rules.' : 'Could not join the lobby.' }; } }, []);
  const touchTeamSession = useCallback(async (teamId, sessionId) => { const user = auth.currentUser; if (!user || !sessionId || !TEAM_IDS.includes(teamId)) return; try { await runTransaction(db, async (transaction) => { const ref = doc(db, 'gameState', 'current'); const snap = await transaction.get(ref); if (!snap.exists()) return; const existing = snap.data().teams?.[teamId]; if (existing?.sessionId === sessionId && existing?.uid === user.uid) transaction.update(ref, { [`teams.${teamId}.lastSeenAt`]: Date.now() }); }); } catch (error) { console.error('heartbeat failed:', error); } }, []);
  const startGame = useCallback(async () => { if (!auth.currentUser || game.phase !== 'lobby') return; const joined = TEAM_IDS.filter((teamId) => game.teams?.[teamId]); if (!joined.length) return; const positions = Object.fromEntries(joined.map((teamId) => [teamId, 0])); const questionIds = shuffle(EVENT_QUESTIONS).slice(0, OPENING_QUESTION_COUNT).map((q) => q.id); await updateDoc(doc(db, 'gameState', 'current'), { phase: 'opening', boardPositions: positions, turnOrder: [], activeTeamIndex: 0, activeTeamId: null, winner: null, rankings: [], dice: { status: 'waiting', die1: null, die2: null, total: null, teamId: null, rolledAt: null }, challenge: null, opening: { questionIndex: 0, questionIds, questionCount: OPENING_QUESTION_COUNT, timeLimit: OPENING_TIME_LIMIT, startedAt: Timestamp.now(), answers: {}, scores: Object.fromEntries(joined.map((id) => [id, 0])) }, minigame: null }); }, [game.phase, game.teams]);
  const submitAnswer = useCallback(async (teamId, optionIndex) => { const user = auth.currentUser; if (!user || !['opening', 'minigame'].includes(game.phase)) return; const phaseConfig = game.phase === 'opening' ? game.opening : game.minigame; if (!phaseConfig) return; const question = questionById(phaseConfig.questionIds?.[phaseConfig.questionIndex]); if (!question || phaseConfig.answers?.[phaseConfig.questionIndex]?.[teamId]) return; const ref = doc(db, 'gameState', 'current'); try { await runTransaction(db, async (transaction) => { const snap = await transaction.get(ref); if (!snap.exists()) return; const current = snap.data(); const config = current.phase === 'opening' ? current.opening : current.minigame; if (!config || current.phase !== game.phase || config.questionIndex !== phaseConfig.questionIndex) return; const q = questionById(config.questionIds?.[config.questionIndex]); if (!q || config.answers?.[config.questionIndex]?.[teamId]) return; const started = config.startedAt?.toMillis?.() ?? config.startedAt ?? Date.now(); const elapsed = Math.max(0, (Date.now() - started) / 1000); if (elapsed > (config.timeLimit || OPENING_TIME_LIMIT) + 0.5) return; const correct = optionIndex === q.answerIndex; const points = correct ? Math.max(1, 100 + Math.round(((config.timeLimit || 10) - elapsed) * 10)) : 0; const score = config.scores?.[teamId] || 0; transaction.update(ref, { [`${current.phase}.answers.${config.questionIndex}.${teamId}`]: { uid: user.uid, optionIndex, correct, points, elapsed: Number(elapsed.toFixed(2)), answeredAt: Date.now() }, [`${current.phase}.scores.${teamId}`]: score + points }); }); } catch (error) { console.error('submitAnswer failed:', error); } }, [game]);
  const advanceQuestion = useCallback(async () => { const config = game.phase === 'opening' ? game.opening : game.minigame; if (!config) return; const nextIndex = (config.questionIndex || 0) + 1; if (nextIndex >= config.questionCount) { if (game.phase === 'opening') { const rankings = rankScores(config.scores, []); await updateDoc(doc(db, 'gameState', 'current'), { phase: 'opening-results', turnOrder: rankings.map((r) => r.teamId), rankings, 'opening.finishedAt': Date.now() }); } else { const rankings = rankScores(config.scores, game.turnOrder); await updateDoc(doc(db, 'gameState', 'current'), { phase: 'minigame-results', rankings, 'minigame.finishedAt': Date.now(), 'minigame.status': 'finished' }); } return; } await updateDoc(doc(db, 'gameState', 'current'), { [`${game.phase}.questionIndex`]: nextIndex, [`${game.phase}.startedAt`]: Timestamp.now() }); }, [game]);
  const beginBoard = useCallback(async () => { if (game.phase !== 'opening-results' || !game.turnOrder?.length) return; await updateDoc(doc(db, 'gameState', 'current'), { phase: 'turn-order' }); }, [game.phase, game.turnOrder]);
  const startInitialRound = useCallback(async () => { if (game.phase !== 'turn-order' || !game.turnOrder?.length) return; await updateDoc(doc(db, 'gameState', 'current'), { phase: 'playing', round: 1, activeTeamIndex: 0, activeTeamId: game.turnOrder[0], dice: { status: 'waiting', die1: null, die2: null, total: null, teamId: game.turnOrder[0], rolledAt: null } }); }, [game.phase, game.turnOrder]);
  const startNextRound = useCallback(async () => { if (game.phase !== 'round-transition' || !game.turnOrder?.length) return; await updateDoc(doc(db, 'gameState', 'current'), { phase: 'playing', activeTeamIndex: 0, activeTeamId: game.turnOrder[0], dice: { status: 'waiting', die1: null, die2: null, total: null, teamId: game.turnOrder[0], rolledAt: null }, minigame: null }); }, [game.phase, game.turnOrder]);
  const prepareNextRound = useCallback(async () => { if (game.phase !== 'minigame-results' || !game.turnOrder?.length) return; const nextOrder = (game.rankings || []).map((r) => r.teamId); await updateDoc(doc(db, 'gameState', 'current'), { phase: 'round-transition', turnOrder: nextOrder, activeTeamIndex: 0, activeTeamId: nextOrder[0], round: (game.round || 1) + 1 }); }, [game.phase, game.turnOrder, game.rankings, game.round]);
  const rollDice = useCallback(async (teamId) => {
    const user = auth.currentUser;
    if (!user || game.phase !== 'playing' || game.activeTeamId !== teamId) return;
    const ref = doc(db, 'gameState', 'current');
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists()) return;
        const current = snap.data();
        if (current.phase !== 'playing' || current.activeTeamId !== teamId) return;
        const die1 = Math.floor(Math.random() * 6) + 1;
        const die2 = Math.floor(Math.random() * 6) + 1;
        const total = die1 + die2;
        const oldPosition = current.boardPositions?.[teamId] ?? 0;
        const target = Math.min(oldPosition + total, FINISH_TILE);
        const tile = boardTiles[target];
        const diceUpdate = { status: 'rolled', die1, die2, total, teamId, rolledAt: Date.now() };

        if (tile?.type === 'challenge') {
          const question = shuffle(EVENT_QUESTIONS)[0];
          transaction.update(ref, {
            boardPositions: { ...(current.boardPositions || {}), [teamId]: target },
            dice: diceUpdate,
            phase: 'challenge',
            activeTeamIndex: current.activeTeamIndex,
            activeTeamId: teamId,
            challenge: { teamId, questionId: question.id, startedAt: Timestamp.now(), timeLimit: CHALLENGE_TIME_LIMIT, resolved: false, correct: null, answer: null, answeredAt: null },
          });
          return;
        }

        let newPosition;
        if (tile?.type === 'bonus') newPosition = Math.min(target + 3, FINISH_TILE);
        else if (tile?.type === 'penalty') newPosition = Math.max(0, target - 4);
        else newPosition = target;

        transaction.update(ref, { dice: diceUpdate, ...resolveMoveOutcome(current, teamId, newPosition) });
      });
    } catch (error) { console.error('rollDice failed:', error); }
  }, [game.phase, game.activeTeamId]);

  const submitChallengeAnswer = useCallback(async (teamId, optionIndex, isTimeout = false) => {
    const user = auth.currentUser;
    if (!user || game.phase !== 'challenge') return;
    const challenge = game.challenge;
    if (!challenge || challenge.teamId !== teamId || challenge.resolved) return;
    const ref = doc(db, 'gameState', 'current');
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists()) return;
        const current = snap.data();
        const ch = current.challenge;
        if (!ch || ch.teamId !== teamId || ch.resolved || current.phase !== 'challenge') return;
        const question = questionById(ch.questionId);
        if (!question) return;
        const started = ch.startedAt?.toMillis?.() ?? ch.startedAt ?? Date.now();
        const elapsed = Math.max(0, (Date.now() - started) / 1000);
        if (!isTimeout && elapsed > (ch.timeLimit || CHALLENGE_TIME_LIMIT) + 0.5) return;
        const correct = isTimeout ? false : optionIndex === question.answerIndex;
        const target = current.boardPositions?.[teamId] ?? 0;
        const finalPosition = correct ? Math.min(target + 3, FINISH_TILE) : Math.max(0, target - 5);
        transaction.update(ref, {
          challenge: { ...ch, resolved: true, correct, answer: isTimeout ? null : optionIndex, answeredAt: Date.now() },
          ...resolveMoveOutcome(current, teamId, finalPosition),
        });
      });
    } catch (error) { console.error('submitChallengeAnswer failed:', error); }
  }, [game.phase, game.challenge]);

  const resetForNewGame = useCallback(async () => { if (!auth.currentUser) return; await setDoc(doc(db, 'gameState', 'current'), { ...EMPTY_GAME, teams: {} }); }, []);
  return { game, gameLoaded, gameExists, initLobby, joinTeam, touchTeamSession, startGame, submitAnswer, advanceQuestion, beginBoard, startInitialRound, prepareNextRound, startNextRound, rollDice, submitChallengeAnswer, resetForNewGame };
}
