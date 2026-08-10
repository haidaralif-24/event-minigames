import { useState, useEffect } from 'react';

export default function ReactionTap({ teamId, onFinish }) {
  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false);
  const [startTime, setStartTime] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), Math.random() * 2000 + 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleClick = () => {
    if (!ready) return;
    if (!started) {
      setStarted(true);
      setStartTime(Date.now());
    } else {
      const elapsed = Date.now() - startTime;
      const score = Math.max(0, 1000 - elapsed);
      onFinish({ teamId, score });
    }
  };

  return (
    <div className="text-center">
      <h2 className="text-2xl font-display mb-4">Reaction Tap</h2>
      <button
        onClick={handleClick}
        className={`w-40 h-40 rounded-full border-4 border-[#1a1a2e] font-black text-2xl shadow-xl transition-colors ${
          !ready ? 'bg-gray-400' : started ? 'bg-[#4dff79]' : 'bg-[#ff4d4d]'
        }`}
      >
        {!ready ? 'Wait...' : started ? 'Tap!' : 'Ready'}
      </button>
    </div>
  );
}
