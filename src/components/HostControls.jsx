import { useGameEngine } from './TurnEngine.jsx';

const TEAM_LABELS = {
  'team-1': 'One', 'team-2': 'Two', 'team-3': 'Three',
  'team-4': 'Four', 'team-5': 'Five', 'team-6': 'Six',
};

export default function HostControls() {
  const { game, initLobby, startGame, nextTurn } = useGameEngine();

  if (game.phase === 'lobby') {
    const joinedCount = Object.keys(game.teams || {}).length;
    return (
      <div className="bg-white border-4 border-[#1a1a2e] rounded-3xl p-6 shadow-xl max-w-md mx-auto text-center">
        <h2 className="font-display text-2xl mb-4">Lobby</h2>
        <p className="text-lg mb-4">
          Teams joined: <span className="font-black text-[#ff4d4d]">{joinedCount}</span> / 6
        </p>
        <div className="grid grid-cols-3 gap-2 mb-6">
          {Object.keys(TEAM_LABELS).map((tid) => (
            <div key={tid} className={`px-3 py-2 rounded-xl border-4 border-[#1a1a2e] font-bold text-sm ${game.teams?.[tid] ? 'bg-[#4dff79]' : 'bg-gray-200'}`}>
              {TEAM_LABELS[tid]}
            </div>
          ))}
        </div>
        <button
          onClick={startGame}
          disabled={joinedCount === 0}
          className="w-full px-6 py-3 bg-[#4dff79] border-4 border-[#1a1a2e] rounded-xl font-black shadow-md disabled:opacity-50 hover:scale-105 transition-transform"
        >
          Start Game
        </button>
      </div>
    );
  }

  if (game.phase === 'finished') {
    const top3 = (game.rankings || []).slice(0, 3);
    return (
      <div className="bg-white border-4 border-[#1a1a2e] rounded-3xl p-6 shadow-xl max-w-md mx-auto text-center">
        <h2 className="font-display text-3xl mb-4">Game Over!</h2>
        <div className="space-y-2 mb-4">
          {top3.map((r) => (
            <div key={r.teamId} className={`px-4 py-3 rounded-xl border-4 border-[#1a1a2e] font-black text-lg ${r.position === 1 ? 'bg-[#ffea4d]' : r.position === 2 ? 'bg-gray-300' : 'bg-orange-300'}`}>
              {r.position}{r.position === 1 ? 'st' : r.position === 2 ? 'nd' : 'rd'} Place: Team {TEAM_LABELS[r.teamId]}
            </div>
          ))}
        </div>
        <button
          onClick={initLobby}
          className="w-full px-6 py-3 bg-[#4d79ff] border-4 border-[#1a1a2e] rounded-xl font-black shadow-md text-white hover:scale-105 transition-transform"
        >
          New Game
        </button>
      </div>
    );
  }

  // Playing phase
  return (
    <div className="bg-white border-4 border-[#1a1a2e] rounded-3xl p-6 shadow-xl max-w-md mx-auto text-center">
      <h2 className="font-display text-2xl mb-2">Round {game.round}</h2>
      <p className="text-lg mb-4">
        Active: <span className="font-black text-[#ff4d4d]">Team {TEAM_LABELS[game.activeTeamId]}</span>
      </p>
      <button
        onClick={nextTurn}
        className="w-full px-6 py-3 bg-[#ff8c4d] border-4 border-[#1a1a2e] rounded-xl font-black shadow-md hover:scale-105 transition-transform"
      >
        Force Next Turn
      </button>
      <p className="text-xs text-gray-500 mt-2">Auto-advances after roll</p>
    </div>
  );
}
