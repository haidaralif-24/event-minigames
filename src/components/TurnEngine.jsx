import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, runTransaction } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, authPersistenceReady, db } from '../firebase';
import { RAPID_SHOOTING_QUESTIONS, RAPID_SHOOTING_TIME_LIMIT, RAPID_SHOOTING_QUESTION_COUNT } from '../data/rapidShootingQuestions.js';

const TEAM_IDS = ['team-1', 'team-2', 'team-3', 'team-4', 'team-5', 'team-6'];
const FINISH_TILE = 29;
const SESSION_TIMEOUT_MS = 30000;
const EMPTY_GAME = {
  phase: 'lobby', round: 1, turnOrder: [], activeTeamIndex: 0, activeTeamId: null,
  boardPositions: {}, teams: {}, winner: null, rankings: [], minigame: null,
  dice: { status: 'waiting', value: null, teamId: null, rolledAt: null },
};

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getRapidQuestion(game, questionIndex) {
  const questionId = game.minigame?.questionIds?.[questionIndex];
  return RAPID_SHOOTING_QUESTIONS.find((question) => question.id === questionId) || null;
}

export function useGameEngine() {
  const [game, setGame] = useState(EMPTY_GAME);
  const [gameLoaded, setGameLoaded] = useState(false);
  const [gameExists, setGameExists] = useState(false);

  useEffect(() => {
    let unsubscribeSnapshot = () => {};
    let unsubscribeAuth = () => {};
    let cancelled = false;

    const startSubscription = (user) => {
      if (cancelled) return;
      if (!user) {
        setGameLoaded(true);
        setGameExists(false);
        return;
      }
      unsubscribeSnapshot();
      unsubscribeSnapshot = onSnapshot(
        doc(db, 'gameState', 'current'),
        (snap) => {
          if (cancelled) return;
          setGameExists(snap.exists());
          setGameLoaded(true);
          if (snap.exists()) setGame(snap.data());
        },
        (error) => {
          if (cancelled) return;
          console.error('game state subscription failed:', error);
          setGameLoaded(true);
        },
      );
    };

    authPersistenceReady
      .then(() => {
        if (!cancelled) unsubscribeAuth = onAuthStateChanged(auth, startSubscription);
      })
      .catch((error) => {
        console.error('Firebase Auth persistence initialization failed:', error);
        if (!cancelled) unsubscribeAuth = onAuthStateChanged(auth, startSubscription);
      });

    return () => {
      cancelled = true;
      unsubscribeAuth();
      unsubscribeSnapshot();
    };
  }, []);

  const initLobby = useCallback(async () => {
    if (!auth.currentUser) throw new Error('You must be signed in as the host.');
    await setDoc(doc(db, 'gameState', 'current'), EMPTY_GAME);
  }, []);

  const joinTeam = useCallback(async (teamId, sessionId) => {
    const user = auth.currentUser;
    if (!user || !sessionId || !TEAM_IDS.includes(teamId)) return { ok: false, error: 'Invalid authenticated team session.' };
    const gameRef = doc(db, 'gameState', 'current');
    const now = Date.now();
    try {
      return await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(gameRef);
        if (!snap.exists()) return { ok: false, error: 'Waiting for the host to open the lobby.' };
        const data = snap.data();
        if (data.phase !== 'lobby') return { ok: false, error: 'The host has already started the game.' };
        const existing = data.teams?.[teamId];
        const active = existing && existing.sessionId && (now - (existing.lastSeenAt || existing.joinedAt || 0) < SESSION_TIMEOUT_MS);
        if (active && existing.sessionId !== sessionId) return { ok: false, error: 'This team is already connected on another device or tab.' };
        if (existing?.uid && existing.uid !== user.uid) return { ok: false, error: 'This team belongs to another authenticated account.' };
        transaction.update(gameRef, {
          [`teams.${teamId}`]: {
            joinedAt: existing?.joinedAt || now,
            sessionId,
            uid: user.uid,
            email: user.email,
            lastSeenAt: now,
          },
        });
        return { ok: true };
      });
    } catch (error) {
      console.error('joinTeam failed:', error);
      return { ok: false, error: error?.code === 'permission-denied' ? 'Firebase denied this team action. Check the Firestore rules.' : 'Could not join the team right now. Please try again.' };
    }
  }, []);

  const touchTeamSession = useCallback(async (teamId, sessionId) => {
    const user = auth.currentUser;
    if (!user || !sessionId || !TEAM_IDS.includes(teamId)) return;
    try {
      const gameRef = doc(db, 'gameState', 'current');
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(gameRef);
        if (!snap.exists()) return;
        const existing = snap.data().teams?.[teamId];
        if (existing?.sessionId === sessionId && existing?.uid === user.uid) {
          transaction.update(gameRef, { [`teams.${teamId}.lastSeenAt`]: Date.now() });
        }
      });
    } catch (error) {
      console.error('team heartbeat failed:', error);
    }
  }, []);

  const startGame = useCallback(async () => {
    if (!auth.currentUser) throw new Error('You must be signed in as the host.');
    if (game.phase !== 'lobby') return;
    const joined = TEAM_IDS.filter((teamId) => game.teams?.[teamId]);
    if (!joined.length) return;
    const positions = Object.fromEntries(joined.map((teamId) => [teamId, 0]));
    const questionIds = shuffle(RAPID_SHOOTING_QUESTIONS)
      .slice(0, RAPID_SHOOTING_QUESTION_COUNT)
      .map((question) => question.id);

    await updateDoc(doc(db, 'gameState', 'current'), {
      phase: 'minigame',
      boardPositions: positions,
      turnOrder: [],
      activeTeamIndex: 0,
      activeTeamId: null,
      dice: { status: 'waiting', value: null, teamId: null, rolledAt: null },
      minigame: {
        type: 'rapid-shooting',
        status: 'playing',
        questionIndex: 0,
        questionIds,
        startedAt: Date.now(),
        questionCount: RAPID_SHOOTING_QUESTION_COUNT,
        timeLimit: RAPID_SHOOTING_TIME_LIMIT,
        answers: {},
        scores: Object.fromEntries(joined.map((teamId) => [teamId, 0])),
      },
    });
  }, [game.phase, game.teams]);

  const submitRapidAnswer = useCallback(async (teamId, optionIndex) => {
    const user = auth.currentUser;
    if (!user || game.phase !== 'minigame' || game.minigame?.type !== 'rapid-shooting' || game.minigame?.status !== 'playing') return;
    const questionIndex = game.minigame.questionIndex ?? 0;
    const question = getRapidQuestion(game, questionIndex);
    if (!question || game.minigame.answers?.[questionIndex]?.[teamId]) return;

    const gameRef = doc(db, 'gameState', 'current');
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(gameRef);
        if (!snap.exists()) return;
        const current = snap.data();
        const minigame = current.minigame;
        if (current.phase !== 'minigame' || minigame?.type !== 'rapid-shooting' || minigame?.status !== 'playing') return;
        const currentIndex = minigame.questionIndex ?? 0;
        const currentQuestion = getRapidQuestion(current, currentIndex);
        if (!currentQuestion || currentIndex !== questionIndex) return;
        const existingAnswer = minigame.answers?.[currentIndex]?.[teamId];
        if (existingAnswer) return;

        const answeredAt = Date.now();
        const elapsed = Math.max(0, (answeredAt - (minigame.startedAt || answeredAt)) / 1000);
        const correct = optionIndex === currentQuestion.answer;
        const withinTime = elapsed <= RAPID_SHOOTING_TIME_LIMIT;
        const speedBonus = correct && withinTime ? Math.max(0, Math.round(50 - elapsed * 4)) : 0;
        const points = correct && withinTime ? 100 + speedBonus : 0;
        const currentScore = minigame.scores?.[teamId] || 0;

        transaction.update(gameRef, {
          [`minigame.answers.${currentIndex}.${teamId}`]: {
            uid: user.uid,
            optionIndex,
            correct: correct && withinTime,
            answeredAt,
            elapsed: Number(elapsed.toFixed(2)),
            points,
          },
          [`minigame.scores.${teamId}`]: currentScore + points,
        });
      });
    } catch (error) {
      console.error('submitRapidAnswer failed:', error);
    }
  }, [game]);

  const nextRapidQuestion = useCallback(async () => {
    if (game.phase !== 'minigame' || game.minigame?.status !== 'playing') return;
    const nextIndex = (game.minigame.questionIndex ?? 0) + 1;
    if (nextIndex >= RAPID_SHOOTING_QUESTION_COUNT) return;
    await updateDoc(doc(db, 'gameState', 'current'), {
      'minigame.questionIndex': nextIndex,
      'minigame.startedAt': Date.now(),
    });
  }, [game.phase, game.minigame]);

  const finishRapidShooting = useCallback(async () => {
    if (game.phase !== 'minigame' || game.minigame?.type !== 'rapid-shooting') return;
    const ranked = Object.entries(game.minigame.scores || {})
      .sort(([teamA, scoreA], [teamB, scoreB]) => scoreB - scoreA || teamA.localeCompare(teamB))
      .map(([teamId], index) => ({ teamId, position: index + 1 }));
    const turnOrder = ranked.map((ranking) => ranking.teamId);

    await updateDoc(doc(db, 'gameState', 'current'), {
      phase: 'rapid-results',
      turnOrder,
      activeTeamIndex: 0,
      activeTeamId: turnOrder[0] || null,
      rankings: ranked,
      winner: null,
      'minigame.status': 'finished',
      'minigame.finishedAt': Date.now(),
    });
  }, [game.phase, game.minigame]);

  const advanceToTurnOrder = useCallback(async () => {
    if (game.phase !== 'rapid-results') return;
    await updateDoc(doc(db, 'gameState', 'current'), {
      phase: 'turn-order',
      'minigame.resultsShownAt': Date.now(),
    });
  }, [game.phase]);

  const startBoard = useCallback(async () => {
    if (game.phase !== 'turn-order' || !game.turnOrder?.length) return;
    await updateDoc(doc(db, 'gameState', 'current'), {
      phase: 'playing',
      round: 1,
      activeTeamIndex: 0,
      activeTeamId: game.turnOrder[0],
      dice: { status: 'waiting', value: null, teamId: game.turnOrder[0], rolledAt: null },
    });
  }, [game.phase, game.turnOrder]);

  const rollDice = useCallback(async (teamId) => {
    const user = auth.currentUser;
    if (!user || game.phase !== 'playing' || game.activeTeamId !== teamId) return;

    const gameRef = doc(db, 'gameState', 'current');
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(gameRef);
        if (!snap.exists()) return;
        const current = snap.data();
        if (current.phase !== 'playing' || current.activeTeamId !== teamId) return;
        if (current.dice?.status === 'rolling') return;

        const rollValue = Math.floor(Math.random() * 6) + 1;
        const currentPos = current.boardPositions?.[teamId] ?? 0;
        const newPos = Math.min(currentPos + rollValue, FINISH_TILE);
        const turnOrder = current.turnOrder || [];
        const activeIndex = current.activeTeamIndex ?? 0;
        const nextIndex = turnOrder.length ? (activeIndex + 1) % turnOrder.length : 0;
        const reachedFinish = newPos >= FINISH_TILE;

        transaction.update(gameRef, {
          [`boardPositions.${teamId}`]: newPos,
          dice: { status: 'rolled', value: rollValue, teamId, rolledAt: Date.now() },
          ...(reachedFinish
            ? { phase: 'finished', winner: teamId, rankings: Object.entries({ ...(current.boardPositions || {}), [teamId]: newPos }).sort(([, a], [, b]) => b - a).map(([id], index) => ({ teamId: id, position: index + 1 })) }
            : { activeTeamIndex: nextIndex, activeTeamId: turnOrder[nextIndex] || null, round: nextIndex === 0 ? (current.round || 1) + 1 : (current.round || 1) }),
        });
      });
    } catch (error) {
      console.error('rollDice failed:', error);
    }
  }, [game.phase, game.activeTeamId]);

  const nextTurn = useCallback(async () => {
    if (!game.turnOrder?.length) return;
    const nextIndex = (game.activeTeamIndex + 1) % game.turnOrder.length;
    await updateDoc(doc(db, 'gameState', 'current'), {
      activeTeamIndex: nextIndex,
      activeTeamId: game.turnOrder[nextIndex],
      round: nextIndex === 0 ? game.round + 1 : game.round,
    });
  }, [game.turnOrder, game.activeTeamIndex, game.round]);

  return {
    game,
    gameLoaded,
    gameExists,
    initLobby,
    joinTeam,
    touchTeamSession,
    startGame,
    submitRapidAnswer,
    nextRapidQuestion,
    finishRapidShooting,
    advanceToTurnOrder,
    startBoard,
    rollDice,
    nextTurn,
  };
}
