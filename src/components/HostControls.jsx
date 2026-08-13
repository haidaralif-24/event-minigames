import { useEffect } from 'react';
import { useGameEngine } from './TurnEngine.jsx';
import { RAPID_SHOOTING_QUESTIONS } from '../data/rapidShootingQuestions.js';

const TEAM_LABELS = {'team-1':'One','team-2':'Two','team-3':'Three','team-4':'Four','team-5':'Five','team-6':'Six'};
const TEAM_COLORS = ['#ff4d4d','#4d79ff','#4dff79','#ffea4d','#a64dff','#ff8c4d'];

function TeamRow({ teamId, rank, score, position, active }) {
  const color = TEAM_COLORS[Number(teamId.split('-')[1]) - 1];
  return <div className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-3 ${active ? 'border-[#ff8c4d] bg-[#fff4e8]' : 'border-[#18233f]/15 bg-white'}`}><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#18233f] text-sm font-black text-white">{rank}</div><span className="h-3 w-3 rounded-full" style={{background:color}}/><div className="flex-1"><p className="font-black text-[#18233f]">Team {TEAM_LABELS[teamId]}</p>{score !== undefined && <p className="text-xs font-semibold text-[#7a8395]">{score} pts{position !== undefined ? ` • Tile ${position + 1} / 30` : ''}</p>}</div>{active && <span className="rounded-full bg-[#ff8c4d] px-2 py-1 text-[10px] font-black uppercase text-white">Turn</span>}</div>;
}

export default function HostControls() {
  const {game,gameLoaded,gameExists,initLobby,startGame,nextRapidQuestion,finishRapidShooting,nextTurn} = useGameEngine();
  useEffect(() => { if (gameLoaded && !gameExists) initLobby().catch(console.error); }, [gameLoaded,gameExists,initLobby]);
  const joinedTeams = Object.keys(game.teams || {});
  const positions = game.boardPositions || {};

  if (!gameExists && !gameLoaded) return <div className="p-4 text-center font-bold">Opening lobby…</div>;

  if (game.phase === 'lobby') return <div className="space-y-4"><section className="rounded-2xl border-2 border-[#18233f]/15 bg-white p-4 shadow-sm"><div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-[#7a8395]">Lobby</p><h2 className="font-display text-2xl text-[#18233f]">Players</h2></div><span className="rounded-full bg-[#18233f] px-3 py-1 text-sm font-black text-white">{joinedTeams.length} / 6</span></div><div className="grid grid-cols-2 gap-2">{Object.keys(TEAM_LABELS).map(id => <div key={id} className={`rounded-xl border-2 px-3 py-2 font-bold ${game.teams?.[id] ? 'border-[#4dff79] bg-[#effff2]' : 'border-[#18233f]/10 bg-gray-50 text-gray-400'}`}>Team {TEAM_LABELS[id]}</div>)}</div></section><button onClick={startGame} disabled={!joinedTeams.length} className="w-full rounded-2xl border-4 border-[#18233f] bg-[#ff4d4d] px-5 py-4 font-black text-white shadow-md disabled:opacity-40">🎮 Start Game</button><p className="text-center text-xs font-bold text-[#7a8395]">5 random Rapid Shooting questions will determine dice order.</p></div>;

  if (game.phase === 'minigame' && game.minigame?.type === 'rapid-shooting') {
    const i = game.minigame.questionIndex ?? 0;
    const id = game.minigame.questionIds?.[i];
    const question = RAPID_SHOOTING_QUESTIONS.find(q => q.id === id);
    const count = game.minigame.questionCount ?? 5;
    const answers = game.minigame.answers?.[i] || {};
    const scores = game.minigame.scores || {};
    const rows = Object.entries(scores).sort(([,a],[,b]) => b-a);
    return <div className="space-y-4"><section className="rounded-2xl border-2 border-[#18233f]/15 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-[#ff4d4d]">Rapid Shooting • Dice Order</p><h2 className="font-display text-2xl text-[#18233f]">Question {i+1} / {count}</h2></div><span className="rounded-full bg-[#18233f] px-3 py-1 text-xs font-black text-white">{Object.keys(answers).length} answered</span></div>{question && <><p className="rounded-xl bg-[#fff8e7] p-4 text-lg font-black text-[#18233f]">{question.question}</p><div className="mt-3 grid grid-cols-2 gap-2">{question.options.map((o,n)=><div key={o} className="rounded-xl border-2 border-[#18233f]/10 bg-gray-50 p-2 text-sm font-bold">{String.fromCharCode(65+n)}. {o}</div>)}</div>}</section><section className="rounded-2xl border-2 border-[#18233f]/15 bg-white p-4"><p className="mb-3 text-xs font-black uppercase tracking-wider text-[#7a8395]">Live scores</p><div className="space-y-2">{rows.map(([id,score],n)=><TeamRow key={id} teamId={id} rank={n+1} score={score}/>)}</div></section>{i >= count-1 ? <button onClick={finishRapidShooting} className="w-full rounded-2xl border-4 border-[#18233f] bg-[#4dff79] px-5 py-4 font-black text-[#18233f]">Finish → Rank Teams → Board</button> : <button onClick={nextRapidQuestion} className="w-full rounded-2xl border-4 border-[#18233f] bg-[#ff8c4d] px-5 py-4 font-black text-[#18233f]">Next Question →</button>}</div>;
  }

  if (game.phase === 'finished') return <div className="space-y-4"><section className="rounded-2xl border-2 border-[#18233f]/15 bg-white p-4"><p className="text-xs font-black uppercase tracking-wider text-[#7a8395]">Final standings</p><h2 className="mb-4 font-display text-2xl">Leaderboard</h2>{(game.rankings || []).map(r=><TeamRow key={r.teamId} teamId={r.teamId} rank={r.position} position={positions[r.teamId] ?? 0}/>)}</section><button onClick={initLobby} className="w-full rounded-2xl border-4 border-[#18233f] bg-[#4d79ff] px-5 py-4 font-black text-white">New Game</button></div>;

  const leaderboard = Object.entries(positions).sort(([,a],[,b]) => b-a);
  return <div className="space-y-4"><section className="rounded-2xl border-2 border-[#18233f]/15 bg-white p-4"><p className="mb-3 text-xs font-black uppercase tracking-wider text-[#7a8395]">Round {game.round} • LIVE</p>{leaderboard.map(([id,pos],n)=><TeamRow key={id} teamId={id} rank={n+1} position={pos} active={game.activeTeamId===id}/>)}</section><button onClick={nextTurn} className="w-full rounded-xl border-4 border-[#18233f] bg-[#ff8c4d] px-4 py-3 font-black">Force Next Turn</button></div>;
}
