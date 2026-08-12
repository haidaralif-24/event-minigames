import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { RAPID_SHOOTING_QUESTIONS, RAPID_SHOOTING_TIME_LIMIT } from '../data/rapidShootingQuestions.js';

const TEAM_IDS = ['team-1', 'team-2', 'team-3', 'team-4', 'team-5', 'team-6'];
const FINISH_TILE = 29;

export function useGameEngine() {
  const [game, setGame] = useState({
    phase: 'lobby', round: 1, turnOrder: [], activeTeamIndex: 0, activeTeamId: null,
    boardPositions: {}, teams: {}, winner: null, rankings: [], minigame: null,
  });

  useEffect(() => onSnapshot(doc(db, 'gameState', 'current'), (snap) => {
    if (snap.exists()) setGame(snap.data());
  }), []);

  const initLobby = useCallback(async () => {
    await setDoc(doc(db, 'gameState', 'current'), {
      phase: 'lobby', round: 1, turnOrder: [], activeTeamIndex: 0, activeTeamId: null,
      boardPositions: {}, teams: {}, winner: null, rankings: [], minigame: null,
    });
  }, []);

  const joinTeam = useCallback(async (teamId) => {
    const snap = await getDoc(doc(db, 'gameState', 'current'));
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.phase !== 'lobby' || data.teams?.[teamId]) return;
    await updateDoc(doc(db, 'gameState', 'current'), { [`teams.${teamId}`]: { joinedAt: Date.now() } });
  }, []);

  const startGame = useCallback(async () => {
    const joined = TEAM_IDS.filter((teamId) => game.teams?.[teamId]);
    if (!joined.length) return;
    const shuffled = [...joined].sort(() => Math.random() - 0.5);
    const positions = Object.fromEntries(joined.map((teamId) => [teamId, 0]));
    await setDoc(doc(db, 'gameState', 'current'), {
      phase: 'playing', round: 1, turnOrder: shuffled, activeTeamIndex: 0,
      activeTeamId: shuffled[0], boardPositions: positions, teams: game.teams,
      winner: null, rankings: [], minigame: null,
    });
  }, [game.teams]);

  const startRapidShooting = useCallback(async () => {
    const joined = TEAM_IDS.filter((teamId) => game.teams?.[teamId]);
    if (!joined.length) return;
    const positions = Object.fromEntries(joined.map((teamId) => [teamId, 0]));
    await updateDoc(doc(db, 'gameState', 'current'), {
      phase: 'minigame', boardPositions: positions,
      minigame: {
        type: 'rapid-shooting', status: 'playing', questionIndex: 0,
        startedAt: Date.now(), questionCount: RAPID_SHOOTING_QUESTIONS.length,
        timeLimit: RAPID_SHOOTING_TIME_LIMIT, answers: {},
        scores: Object.fromEntries(joined.map((teamId) => [teamId, 0])),
      },
    });
  }, [game.teams]);

  const submitRapidAnswer = useCallback(async (teamId, optionIndex) => {
    if (game.phase !== 'minigame' || game.minigame?.type !== 'rapid-shooting' || game.minigame?.status !== 'playing') return;
    const questionIndex = game.minigame.questionIndex ?? 0;
    const question = RAPID_SHOOTING_QUESTIONS[questionIndex];
    if (!question || game.minigame.answers?.[questionIndex]?.[teamId]) return;
    const answeredAt = Date.now();
    const elapsed = Math.max(0, (answeredAt - (game.minigame.startedAt || answeredAt)) / 1000);
    const correct = optionIndex === question.answer;
    const withinTime = elapsed <= RAPID_SHOOTING_TIME_LIMIT;
    const speedBonus = correct && withinTime ? Math.max(0, Math.round(50 - elapsed * 4)) : 0;
    const points = correct && withinTime ? 100 + speedBonus : 0;
    const currentScore = game.minigame.scores?.[teamId] || 0;
    await updateDoc(doc(db, 'gameState', 'current'), {
      [`minigame.answers.${questionIndex}.${teamId}`]: { optionIndex, correct: correct && withinTime, answeredAt, elapsed: Number(elapsed.toFixed(2)), points },
      [`minigame.scores.${teamId}`]: currentScore + points,
    });
  }, [game]);

  const nextRapidQuestion = useCallback(async () => {
    if (game.phase !== 'minigame' || game.minigame?.status !== 'playing') return;
    const nextIndex = (game.minigame.questionIndex ?? 0) + 1;
    if (nextIndex >= RAPID_SHOOTING_QUESTIONS.length) return;
    await updateDoc(doc(db, 'gameState', 'current'), {
      'minigame.questionIndex': nextIndex,
      'minigame.startedAt': Date.now(),
    });
  }, [game.phase, game.minigame]);

  const finishRapidShooting = useCallback(async () => {
    if (game.phase !== 'minigame' || game.minigame?.type !== 'rapid-shooting') return;
    const ranked = Object.entries(game.minigame.scores || {})
      .sort(([, a], [, b]) => b - a || Math.random() - 0.5)
      .map(([teamId], index) => ({ teamId, position: index + 1 }));
    const turnOrder = ranked.map((r) => r.teamId);
    await updateDoc(doc(db, 'gameState', 'current'), {
      phase: 'playing', round: 1, turnOrder, activeTeamIndex: 0,
      activeTeamId: turnOrder[0] || null, rankings: ranked, winner: null,
      'minigame.status': 'finished', 'minigame.finishedAt': Date.now(),
    });
  }, [game.phase, game.minigame]);

  const moveToken = useCallback(async (teamId, rollValue) => {
    const currentPos = game.boardPositions?.[teamId] ?? 0;
    const newPos = Math.min(currentPos + rollValue, FINISH_TILE);
    await updateDoc(doc(db, 'gameState', 'current'), { [`boardPositions.${teamId}`]: newPos });
    if (newPos >= FINISH_TILE) await endGame();
    else await nextTurn();
  }, [game.boardPositions]);

  const nextTurn = useCallback(async () => {
    if (!game.turnOrder?.length) return;
    const nextIndex = (game.activeTeamIndex + 1) % game.turnOrder.length;
    await updateDoc(doc(db, 'gameState', 'current'), {
      activeTeamIndex: nextIndex,
      activeTeamId: game.turnOrder[nextIndex],
      round: nextIndex === 0 ? game.round + 1 : game.round,
    });
  }, [game.turnOrder, game.activeTeamIndex, game.round]);

  const endGame = useCallback(async () => {
    const sorted = Object.entries(game.boardPositions || {}).sort((a, b) => b[1] - a[1]);
    await setDoc(doc(db, 'gameState', 'current'), {
      phase: 'finished', winner: sorted[0]?.[0] || null,
      rankings: sorted.map(([teamId], i) => ({ teamId, position: i + 1 })),
    }, { merge: true });
  }, [game.boardPositions]);

  return { game, initLobby, joinTeam, startGame, startRapidShooting, submitRapidAnswer, nextRapidQuestion, finishRapidShooting, moveToken, nextTurn };
}
