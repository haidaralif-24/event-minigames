import { useGameEngine } from '../components/TurnEngine.jsx';
import Dice from '../components/Dice.jsx';
import Board from '../components/Board.jsx';

const TEAM_LABELS = {
  'team-1': 'One', 'team-2': 'Two', 'team-3': 'Three',
  'team-4': 'Four', 'team-5': 'Five', 'team-6': 'Six',
};

export default function PlayPage() {
  const { game, joinTeam, moveToken } = useGameEngine();
  const myTeamId = localStorage.getItem('team');

  if (!myTeamId || myTeamId === 'host') {
    return (
      <div className="min-h-screen bg-[#fff8e7] p-8 text-center">
        <h1 className="font-display text-3xl mb-6">No team assigned</h1>
        <p>Please log in with a team word (one through six).</p>
      </div>
    );
  }

  const isMyTurn = game.phase === 'playing' && game.turnOrder[game.activeTeamIndex] === myTeamId;
  const myPosition = game.boardPositions?.[myTeamId] ?? 0;

  const handleRoll = (value) => {
    if (!isMyTurn) return;
    moveToken(myTeamId, value);
  };

  if (game.phase === 'lobby') {
    return (
      <div className="min-h-screen bg-[#fff8e7] p-8 text-center">
        <h1 className="font-display text-3xl mb-6">Team {TEAM_LABELS[myTeamId]}</h1>
        <p className="text-xl mb-4">Waiting for host to start the game...</p>
        <button
          onClick={() => joinTeam(myTeamId)}
          className="px-6 py-3 bg-[#4dff79] border-4 border-[#1a1a2e] rounded-xl font-black shadow-md hover:scale-105 transition-transform"
        >
          Join Lobby
        </button>
      </div>
    );
  }

  if (game.phase === 'finished') {
    const myRank = (game.rankings || []).find((r) => r.teamId === myTeamId);
    return (
      <div className="min-h-screen bg-[#fff8e7] p-8 text-center">
        <h1 className="font-display text-3xl mb-6">Game Over!</h1>
        {myRank && (
          <p className="text-2xl font-black mb-4">
            You finished {myRank.position}{myRank.position === 1 ? 'st' : myRank.position === 2 ? 'nd' : 'rd'}!
          </p>
        )}
        <p className="text-lg">Winner: Team {TEAM_LABELS[game.winner]}</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <Board />
      {/* Floating dice panel */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
        {isMyTurn ? (
          <div className="bg-white border-4 border-[#1a1a2e] rounded-3xl p-6 shadow-xl max-w-md w-full text-center animate-bounce">
            <p className="font-display text-2xl mb-4 text-[#4dff79]">Your Turn!</p>
            <p className="text-lg mb-4">Position: Tile {myPosition + 1} / 30</p>
            <Dice onRoll={(v) => moveToken(myTeamId, v)} />
          </div>
        ) : (
          <div className="bg-white/90 border-4 border-[#1a1a2e] rounded-3xl px-6 py-4 shadow-xl max-w-md w-full text-center">
            <p className="text-lg">Waiting for <span className="font-black text-[#ff4d4d]">Team {TEAM_LABELS[game.activeTeamId]}</span>...</p>
          </div>
        )}
      </div>
    </div>
  );
}
