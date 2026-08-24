import { Navigate } from 'react-router-dom';
import { useRoom } from '../hooks/useRoom.js';
import { resetGame } from '../services/roomService.js';
import { getRankings } from '../services/gameLogic.js';
import { TOKEN_COLORS, ACTIVE_META } from '../data/constants.js';

// Dedicated full-screen results page. Clients are redirected here from the
// host / player / spectator views as soon as a team reaches the finish tile
// (game phase becomes 'finished'). The host gets a Reset control so a new game
// can be started without leaving the celebration screen.
export default function Podium() {
  const { room, loading, error, session } = useRoom();
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#0e1a3a] text-white">Loading results…</div>;
  if (error || !room) return <div className="grid min-h-screen place-items-center bg-[#0e1a3a] text-white">Game unavailable.</div>;
  if (!session) return <Navigate to="/" replace />;
  if (room.phase !== 'finished') return <Navigate to={session.role === 'host' ? '/host' : session.role === 'player' ? '/play' : '/board'} replace />;

  const players = room.players || {};
  const rankings = getRankings(room, players);
  const placements = room.winner
    ? [room.winner, ...rankings.filter((id) => id !== room.winner)].slice(0, 3)
    : rankings.slice(0, 3);
  const labels = ['Winner', '2nd Place', '3rd Place'];
  const medals = ['🏆', '🥈', '🥉'];
  const allIds = Object.keys(players).sort();
  const colorFor = (id) => TOKEN_COLORS[Math.max(0, allIds.indexOf(id)) % TOKEN_COLORS.length];

  return (
    <div className="min-h-screen bg-[#0e1a3a] px-5 py-8 text-white">
      <header className="mx-auto mb-6 max-w-[1100px] text-center">
        <p className="mb-1 text-[11px] font-black uppercase tracking-[.22em] text-[#ff8c4d]">{ACTIVE_META.title}</p>
        <h1 className="font-display text-5xl md:text-6xl">🏆 Final Results</h1>
        <p className="mt-2 text-sm font-bold text-[#aab2d4]">The race is complete — here's how the teams finished.</p>
      </header>

      <main className="mx-auto max-w-[1100px] space-y-4">
        {placements.map((id, index) => {
          const player = players[id];
          const color = colorFor(id);
          const position = (room.boardPositions?.[id] || 0) + 1;
          return (
            <div key={id} className={`flex items-center gap-4 rounded-3xl px-6 py-5 ${index === 0 ? 'bg-[#fff3c4] text-[#18233f]' : 'bg-[#1b2a55] text-white'}`}>
              <span className="text-5xl">{medals[index]}</span>
              {player?.avatar ? (
                <img src={player.avatar} alt={player.name} className="h-16 w-16 rounded-full border-4 border-[#18233f] object-cover" />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-full border-4 border-[#18233f] text-2xl font-black" style={{ backgroundColor: color }}>{index + 1}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#ff8c4d]">{labels[index]}</p>
                <p className="truncate font-display text-3xl">{player?.name || id}</p>
              </div>
              <span className="text-xl font-black">Tile {position}</span>
            </div>
          );
        })}

        <section className="mt-6 rounded-3xl bg-[#1b2a55] p-5">
          <h2 className="mb-3 font-display text-lg">Full Standings</h2>
          <div className="space-y-1">
            {rankings.map((id, index) => {
              const player = players[id];
              const color = colorFor(id);
              const position = (room.boardPositions?.[id] || 0) + 1;
              return (
                <div key={id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                  <span className="w-7 text-center text-sm font-black text-[#ff8c4d]">{index + 1}</span>
                  {player?.avatar ? (
                    <img src={player.avatar} alt={player.name} className="h-7 w-7 rounded-full border-2 border-[#18233f] object-cover" />
                  ) : (
                    <span className="h-4 w-4 rounded-[5px] border-2 border-[#18233f]" style={{ backgroundColor: color }} />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-black">{player?.name || id}</span>
                  <span className="text-xs font-extrabold text-[#aab2d4]">Tile {position}</span>
                </div>
              );
            })}
          </div>
        </section>

        {session.role === 'host' && (
          <div className="flex justify-center pt-2">
            <button
              onClick={() => { if (window.confirm('Reset the entire game and return everyone to the login lobby?')) resetGame(); }}
              className="rounded-xl bg-[#ff8c4d] px-6 py-3 font-display text-[13px] text-[#18233f] shadow-[0_4px_0_rgba(0,0,0,.25)]"
            >
              Reset Game
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
