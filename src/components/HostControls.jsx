import { useEffect } from 'react';
import { useGameEngine } from './TurnEngine.jsx';

const TEAM_LABELS = { 'team-1': 'One', 'team-2': 'Two', 'team-3': 'Three', 'team-4': 'Four', 'team-5': 'Five', 'team-6': 'Six' };
const TEAM_COLORS = ['#ff4d4d', '#4d79ff', '#4dff79', '#ffea4d', '#a64dff', '#ff8c4d'];

function TeamRow({ teamId, rank, score, position, active }) {
  const color = TEAM_COLORS[Number(teamId.split('-')[1]) - 1];
  return <div className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-3 ${active ? 'border-[#ff8c4d] bg-[#fff4e8]' : 'border-[#18233f]/15 bg-white'}`}><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#18233f] text-sm font-black text-white">{rank}</div><span className="h-3 w-3 rounded-full" style={{ background: color }} /><div className="flex-1"><p className="font-black text-[#18233f]">Team {TEAM_LABELS[teamId]}</p>{score !== undefined && <p className="text-xs font-semibold text-[#7a8395]">{score} pts{position !== undefined ? ` • Tile ${position + 1} / 30` : ''}</p>}</div>{active && <span className="rounded-full bg-[#ff8c4d] px-2 py-1 text-[10px] font-black uppercase text-white">Turn</span>}</div>;
}

export default function HostControls() {
  const { game, gameLoaded, gameExists, initLobby, startGame, nextRapidQuestion, finishRapidShooting, advanceToTurnOrder, startBoard } = useGameEngine();

  useEffect(() => {
    if (gameLoaded && !gameExists) initLobby().catch(console.error);
  }, [gameLoaded, gameExists, initLobby]);

  useEffect(() => {
    if (game.phase !== 'minigame' || game.minigame?.type !== 'rapid-shooting') return undefined;
    const questionIndex = game.minigame.questionIndex ?? 0;
    const startedAt = game.minigame.startedAt?.toMillis?.() ?? game.minigame.startedAt ?? Date.now();
    const delay = Math.max(0, startedAt + (game.minigame.timeLimit || 5) * 1000 - Date.now()) + 100;
    const timer = setTimeout(() => {
      if (questionIndex >= (game.minigame.questionCount || 5) - 1) finishRapidShooting().catch(console.error);
      else nextRapidQuestion().catch(console.error);
    }, delay);
    return () => clearTimeout(timer);
  }, [game.phase, game.minigame?.type, game.minigame?.questionIndex, game.minigame?.startedAt, game.minigame?.timeLimit, game.minigame?.questionCount, nextRapidQuestion, finishRapidShooting]);

  useEffect(() => {
    if (game.phase !== 'rapid-results') return undefined;
    const timer = setTimeout(() => advanceToTurnOrder().catch(console.error), 2800);
    return () => clearTimeout(timer);
  }, [game.phase, game.minigame?.finishedAt, advanceToTurnOrder]);

  useEffect(() => {
    if (game.phase !== 'turn-order') return undefined;
    const timer = setTimeout(() => startBoard().catch(console.error), 2800);
    return () => clearTimeout(timer);
  }, [game.phase, startBoard]);

  const joinedTeams = Object.keys(game.teams || {});
  const positions = game.boardPositions || {};
  const scores = game.minigame?.scores || {};

  if (!gameExists && !gameLoaded) return <div className="p-4 text-center font-bold">Opening lobby…</div>;

  if (game.phase === 'lobby') return <div className="space-y-4"><section className="rounded-2xl border-2 border-[#18233f]/15 bg-white p-4 shadow-sm"><div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-[#7a8395]">Lobby</p><h2 className="font-display text-2xl text-[#18233f]">Players</h2></div><span className="rounded-full bg-[#18233f] px-3 py-1 text-sm font-black text-white">{joinedTeams.length} / 6</span></div><div className="grid grid-cols-2 gap-2">{Object.keys(TEAM_LABELS).map((id) => <div key={id} className={`rounded-xl border-2 px-3 py-2 font-bold ${game.teams?.[id] ? 'border-[#4dff79] bg-[#effff2]' : 'border-[#18233f]/10 bg-gray-50 text-gray-400'}`}>Team {TEAM_LABELS[id]}</div>)}</div></section><button onClick={startGame} disabled={!joinedTeams.length} className="w-full rounded-2xl border-4 border-[#18233f] bg-[#ff4d4d] px-5 py-4 font-black text-white shadow-md disabled:opacity-40">🎮 Start Game</button><p className="text-center text-xs font-bold text-[#7a8395]">5 random Rapid Shooting questions will determine dice order.</p></div>;

  if (game.phase === 'minigame') return <div className="space-y-4"><section className="rounded-2xl border-2 border-[#18233f]/15 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-wider text-[#ff4d4d]">Rapid Shooting • Dice Order</p><h2 className="mt-1 font-display text-3xl text-[#18233f]">Question {(game.minigame?.questionIndex ?? 0) + 1} / 5</h2><p className="mt-3 rounded-xl bg-[#fff8e7] p-4 font-black text-[#18233f]">Teams are answering. The next question appears automatically.</p></section><section className="rounded-2xl border-2 border-[#18233f]/15 bg-white p-4"><p className="mb-3 text-xs font-black uppercase tracking-wider text-[#7a8395]">Live scores</p><div className="space-y-2">{Object.entries(scores).sort(([, a], [, b]) => b - a).map(([teamId, score], index) => <TeamRow key={teamId} teamId={teamId} rank={index + 1} score={score} />)}</div></section></div>;

  if (game.phase === 'rapid-results') return <div className="space-y-4"><section className="rounded-2xl border-2 border-[#18233f]/15 bg-white p-5 text-center shadow-sm"><p className="text-xs font-black uppercase tracking-wider text-[#ff8c4d]">Rapid Shot Complete</p><h2 className="mt-1 font-display text-3xl text-[#18233f]">Results</h2><p className="mt-2 font-semibold text-[#7a8395]">Calculating turn order…</p></section><div className="space-y-2">{(game.rankings || []).map((r) => <TeamRow key={r.teamId} teamId={r.teamId} rank={r.position} score={scores[r.teamId] || 0} />)}</div></div>;

  if (game.phase === 'turn-order') return <div className="space-y-4"><section className="rounded-2xl border-2 border-[#18233f]/15 bg-white p-5 text-center shadow-sm"><p className="text-xs font-black uppercase tracking-wider text-[#ff8c4d]">Turn Order</p><h2 className="mt-1 font-display text-3xl text-[#18233f]">Team {TEAM_LABELS[game.turnOrder?.[0]]} Goes First!</h2><p className="mt-2 font-semibold text-[#7a8395]">The board will begin automatically.</p></section><div className="space-y-2">{(game.turnOrder || []).map((teamId, index) => <TeamRow key={teamId} teamId={teamId} rank={index + 1} score={scores[teamId] || 0} />)}</div></div>;

  if (game.phase === 'finished') return <div className="space-y-4"><section className="rounded-2xl border-2 border-[#18233f]/15 bg-white p-4"><p className="text-xs font-black uppercase tracking-wider text-[#7a8395]">Final standings</p><h2 className="mb-4 font-display text-2xl">Game Over</h2>{(game.rankings || []).map((r) => <TeamRow key={r.teamId} teamId={r.teamId} rank={r.position} position={positions[r.teamId] ?? 0} />)}</section><button onClick={initLobby} className="w-full rounded-2xl border-4 border-[#18233f] bg-[#4d79ff] px-5 py-4 font-black text-white">New Game</button></div>;

  return <div className="space-y-4"><section className="rounded-2xl border-2 border-[#18233f]/15 bg-white p-4"><p className="mb-3 text-xs font-black uppercase tracking-wider text-[#7a8395]">Round {game.round} • LIVE</p><div className="space-y-2">{(game.turnOrder || []).map((teamId, index) => <TeamRow key={teamId} teamId={teamId} rank={index + 1} position={positions[teamId] ?? 0} active={game.activeTeamId === teamId} />)}</div></section><p className="rounded-xl bg-[#fff8e7] p-3 text-center text-xs font-bold text-[#7a8395]">Teams roll when it is their turn.</p></div>;
}
