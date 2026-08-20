import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import MultiplayerBoard from '../components/MultiplayerBoard.jsx';
import { db, ensureAnonymousAuth } from '../firebase.js';

export default function SpectatorBoard() {
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let unsubscribe = () => {};
    ensureAnonymousAuth().then(() => {
      unsubscribe = onSnapshot(doc(db, 'gameState', 'current'), (snapshot) => setRoom(snapshot.exists() ? snapshot.data() : null), () => setError('The board is currently unavailable.'));
    }).catch(() => setError('The board is currently unavailable.'));
    return () => unsubscribe();
  }, []);
  if (error) return <div className="grid min-h-screen place-items-center bg-[#0e1a3a] text-white">{error}</div>;
  if (!room) return <div className="grid min-h-screen place-items-center bg-[#0e1a3a] text-white">Loading board…</div>;
  return <main className="min-h-screen bg-[#0e1a3a] p-3"><MultiplayerBoard boardPositions={room.boardPositions} players={room.players} /></main>;
}
