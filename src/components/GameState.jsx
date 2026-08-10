import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export default function GameState() {
  const [state, setState] = useState({ phase: 'lobby', round: 0, boardPositions: {} });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'gameState', 'current'), (snap) => {
      if (snap.exists()) setState(snap.data());
    });
    return unsub;
  }, []);

  return (
    <div className="fixed top-4 right-4 bg-white/90 border-4 border-[#1a1a2e] rounded-2xl p-4 shadow-xl z-50">
      <h3 className="font-display text-xl mb-1">Game State</h3>
      <p>Phase: <span className="font-bold">{state.phase}</span></p>
      <p>Round: <span className="font-bold">{state.round}</span></p>
    </div>
  );
}
