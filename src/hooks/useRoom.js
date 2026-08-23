import { useEffect, useState } from 'react';
import { ensureAnonymousAuth } from '../firebase.js';
import { getSession, subscribeToRoom } from '../services/roomService.js';

export function useRoom() {
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const session = getSession();

  useEffect(() => {
    if (!session?.roomCode) {
      setLoading(false);
      return undefined;
    }
    let unsubscribe = () => {};
    ensureAnonymousAuth()
      .then(() => {
        unsubscribe = subscribeToRoom(
          session.roomCode,
          (next) => {
            setRoom(next);
            setLoading(false);
          },
          (err) => {
            setError(err);
            setLoading(false);
          }
        );
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
    return () => unsubscribe();
  }, [session?.roomCode]);

  return { room, loading, error, session };
}
