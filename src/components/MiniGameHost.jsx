import { useState } from 'react';
import ReactionTap from '../games/ReactionTap.jsx';
import SpeedQuiz from '../games/SpeedQuiz.jsx';

export default function MiniGameHost({ teamId = 'team-1', onResults }) {
  const [results, setResults] = useState([]);
  const [game, setGame] = useState('reaction');

  const collect = (res) => {
    setResults([...results, res]);
  };

  const finish = () => {
    onResults?.(results);
  };

  return (
    <div className="p-6 bg-white border-4 border-[#1a1a2e] rounded-3xl shadow-xl max-w-md mx-auto">
      <h2 className="text-2xl font-display mb-4">Mini-Game: {game}</h2>
      {game === 'reaction' ? (
        <ReactionTap teamId={teamId} onFinish={collect} />
      ) : (
        <SpeedQuiz teamId={teamId} onFinish={collect} />
      )}
      <button
        onClick={() => finish()}
        className="mt-4 px-6 py-2 bg-[#4dff79] border-4 border-[#1a1a2e] rounded-xl font-black shadow-md"
      >
        Resolve & Send Results
      </button>
    </div>
  );
}
