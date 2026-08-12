import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const TEAM_IDS = ['team-1', 'team-2', 'team-3', 'team-4', 'team-5', 'team-6'];
const FINISH_TILE = 29;

export function useGameEngine() {
  const [game, setGame] = useState({
    phase: 'lobby',
    round: 1,
    turnOrder: [],
    activeTeamIndex: 0,
    activeTeamId: null,
    boardPositions: {},
    teams: {},
    winner: null,
    rankings: [],
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'gameState', 'current'), (snap) => {
      if (snap.exists()) setGame(snap.data());
    });
    return unsub;
  }, []);

  const initLobby = useCallback(async () => {
    await setDoc(doc(db, 'gameState', 'current'), {
      phase: 'lobby',
      round: 1,
      turnOrder: [],
      activeTeamIndex: 0,
      activeTeamId: null,
      boardPositions: {},
      teams: {},
      winner: null,
      rankings: [],
    });
  }, []);

  const joinTeam = useCallback(async (teamId) => {
    const snap = await getDoc(doc(db, 'gameState', 'current'));
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.phase !== 'lobby') return;
    if (data.teams?.[teamId]) return;
    await updateDoc(doc(db, 'gameState', 'current'), {
      [`teams.${teamId}`]: { joinedAt: Date.now() },
    });
  }, []);

  const startGame = useCallback(async () => {
    const shuffled = [...TEAM_IDS].sort(() => Math.random() - 0.5);
    const positions = {};
    TEAM_IDS.forEach((t) => { positions[t] = 0; });
    await setDoc(doc(db, 'gameState', 'current'), {
      phase: 'playing',
      round: 1,
      turnOrder: shuffled,
      activeTeamIndex: 0,
      activeTeamId: shuffled[0],
      boardPositions: positions,
    });
  }, []);

  const moveToken = useCallback(async (teamId, rollValue) => {
    const currentPos = game.boardPositions?.[teamId] ?? 0;
    const newPos = Math.min(currentPos + rollValue, FINISH_TILE);
    await updateDoc(doc(db, 'gameState', 'current'), {
      [`boardPositions.${teamId}`]: newPos,
    });
    if (newPos >= FINISH_TILE) {
      await endGame();
    } else {
      await nextTurn();
    }
  }, [game.boardPositions]);

  const nextTurn = useCallback(async () => {
    if (!game.turnOrder || game.turnOrder.length === 0) return;
    const nextIndex = (game.activeTeamIndex + 1) % game.turnOrder.length;
    const nextTeam = game.turnOrder[nextIndex];
    const newRound = nextIndex === 0 ? game.round + 1 : game.round;
    await updateDoc(doc(db, 'gameState', 'current'), {
      activeTeamIndex: nextIndex,
      activeTeamId: nextTeam,
      round: newRound,
    });
  }, [game.turnOrder, game.activeTeamIndex, game.round]);

  const endGame = useCallback(async () => {
    const entries = Object.entries(game.boardPositions || {});
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    const rankings = sorted.map(([teamId], i) => ({ teamId, position: i + 1 }));
    await setDoc(doc(db, 'gameState', 'current'), {
      phase: 'finished',
      winner: sorted[0]?.[0] || null,
      rankings,
    }, { merge: true });
  }, [game.boardPositions]);

  return { game, initLobby, joinTeam, startGame, moveToken, nextTurn };
}
