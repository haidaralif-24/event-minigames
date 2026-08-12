import { useGameEngine } from './TurnEngine.jsx';

const TEAM_LABELS = {
  'team-1': 'One', 'team-2': 'Two', 'team-3': 'Three',
  'team-4': 'Four', 'team-5': 'Five', 'team-6': 'Six',
};

const TEAM_COLORS = ['#ff4d4d', '#4d79ff', '#4dff79', '#ffea4d', '#a64dff', '#ff8c4d'];

function TeamRow({ teamId, rank, position, active }) {
  const index = Number(teamId.split('-')[1]) - 1;
  return (
    <div className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-3 transition ${active ? 'border-[#ff8c4d] bg-[#fff4e8]' : 'border-[#18233f]/15 bg-white'}`}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#18233f] text-sm font-black text-white">
        {rank}
      </div>
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: TEAM_COLORS[index % TEAM_COLORS.length] }} />
      <div className="min-w-0 flex-1">
        <p className="font-black text-[#18233f]">Team {TEAM_LABELS[teamId]}</p>
        <p className="text-xs font-semibold text-[#7a8395]">Tile {position + 1} / 30</p>
      </div>
      {active && <span className="rounded-full bg-[#ff8c4d] px-2 py-1 text-[10px] font-black uppercase text-white">Turn</span>}
    </div>
  );
}

export default function HostControls() {
  const { game, initLobby, startGame, nextTurn } = useGameEngine();
  const joinedTeams = Object.keys(game.teams || {});
  const positions = game.boardPositions || {};
  const leaderboard = Object.entries(positions)
    .sort(([, a], [, b]) => b - a)
    .map(([teamId, position], index) => ({ teamId, position, rank: index + 1 }));

  if (game.phase === 'lobby') {
    return (
      <div className="space-y-4">
        <section className="rounded-2xl border-2 border-[#18233f]/15 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-[#7a8395]">Lobby</p>
              <h2 className="font-display text-2xl text-[#18233f]">Players</h2>
            </div>
            <span className="rounded-full bg-[#18233f] px-3 py-1 text-sm font-black text-white">{joinedTeams.length} / 6</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(TEAM_LABELS).map((teamId) => (
              <div key={teamId} className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 font-bold ${game.teams?.[teamId] ? 'border-[#4dff79] bg-[#effff2]' : 'border-[#18233f]/10 bg-gray-50 text-gray-400'}`}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: TEAM_COLORS[Number(teamId.split('-')[1]) - 1] }} />
                Team {TEAM_LABELS[teamId]}
              </div>
            ))}
          </div>
        </section>
        <button onClick={startGame} disabled={joinedTeams.length === 0} className="w-full rounded-2xl border-4 border-[#18233f] bg-[#4dff79] px-5 py-4 font-black text-[#18233f] shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40">Start Game</button>
      </div>
    );
  }

  if (game.phase === 'finished') {
    return (
      <div className="space-y-4">
        <section className="rounded-2xl border-2 border-[#18233f]/15 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-wider text-[#7a8395]">Final standings</p>
          <h2 className="mb-4 font-display text-2xl text-[#18233f]">Leaderboard</h2>
          <div className="space-y-2">
            {(game.rankings || []).map((r) => (
              <TeamRow key={r.teamId} teamId={r.teamId} rank={r.position} position={positions[r.teamId] ?? 0} />
            ))}
          </div>
        </section>
        <button onClick={initLobby} className="w-full rounded-2xl border-4 border-[#18233f] bg-[#4d79ff] px-5 py-4 font-black text-white shadow-md transition hover:-translate-y-0.5">New Game</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border-2 border-[#18233f]/15 bg-white p-4">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-[#7a8395]">Round {game.round}</p>
            <h2 className="font-display text-2xl text-[#18233f]">Leaderboard</h2>
          </div>
          <span className="rounded-full bg-[#ff8c4d] px-3 py-1 text-xs font-black text-white">LIVE</span>
        </div>
        <div className="space-y-2">
          {leaderboard.map(({ teamId, position, rank }) => (
            <TeamRow key={teamId} teamId={teamId} rank={rank} position={position} active={game.activeTeamId === teamId} />
          ))}
        </div>
      </section>
      <section className="rounded-2xl border-2 border-[#18233f]/15 bg-white p-4">
        <p className="mb-2 text-xs font-black uppercase tracking-wider text-[#7a8395]">Turn control</p>
        <p className="mb-3 text-sm font-bold text-[#18233f]">Active: Team {TEAM_LABELS[game.activeTeamId] || '—'}</p>
        <button onClick={nextTurn} className="w-full rounded-xl border-4 border-[#18233f] bg-[#ff8c4d] px-4 py-3 font-black text-[#18233f] shadow-sm transition hover:-translate-y-0.5">Force Next Turn</button>
      </section>
    </div>
  );
}
