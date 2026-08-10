import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export function useTurnEngine() {
  const [state, setState] = useState({
    turnOrder: [],
    activeTeamId: null,
    boardPositions: {},
    round: 1,
    phase: 'lobby',
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'gameState', 'current'), (snap) => {
      if (snap.exists()) setState(snap.data());
    });
    return unsub;
  }, []);

  const initGame = useCallback(async () => {
    const teams = ['team-1', 'team-2', 'team-3', 'team-4', 'team-5', 'team-6'];
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    const positions = {};
    teams.forEach((t) => { positions[t] = 0; });
    await setDoc(doc(db, 'gameState', 'current'), {
      phase: 'playing',
      round: 1,
      turnOrder: shuffled,
      activeTeamId: shuffled[0],
      boardPositions: positions,
    }, { merge: true });
  }, []);

  const advanceTurn = useCallback(async () => {
    if (!state.turnOrder || state.turnOrder.length === 0) return;
    const currentIndex = state.turnOrder.indexOf(state.activeTeamId);
    const nextIndex = (currentIndex + 1) % state.turnOrder.length;
    const nextTeam = state.turnOrder[nextIndex];
    await setDoc(doc(db, 'gameState', 'current'), {
      activeTeamId: nextTeam,
    }, { merge: true });
  }, [state.turnOrder, state.activeTeamId]);

  const rollForActive = useCallback(async (rollValue) => {
    if (!state.activeTeamId) return;
    const currentPos = state.boardPositions?.[state.activeTeamId] ?? 0;
    const newPos = Math.min(currentPos + rollValue, 29); // max 30 tiles (0-29)
    const updated = { ...state.boardPositions, [state.activeTeamId]: newPos };
    await setDoc(doc(db, 'gameState', 'current'), {
      boardPositions: updated,
    }, { merge: true });
  }, [state.activeTeamId, state.boardPositions]);

  return { state, initGame, advanceTurn, rollForActive };
}
