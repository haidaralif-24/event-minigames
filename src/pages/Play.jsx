import { useEffect, useState } from 'react';
import { useGameEngine } from '../components/TurnEngine.jsx';
import { RAPID_SHOOTING_QUESTIONS, RAPID_SHOOTING_TIME_LIMIT } from '../data/rapidShootingQuestions.js';

const TEAM_LABELS = { 'team-1': 'One', 'team-2': 'Two', 'team-3': 'Three', 'team-4': 'Four', 'team-5': 'Five', 'team-6': 'Six' };
const TARGET_STYLES = ['bg-[#ff4d4d]', 'bg-[#4d79ff]', 'bg-[#4dff79]', 'bg-[#ffea4d]'];
const TEAM_COLORS = ['#ff4d4d', '#4d79ff', '#4dff79', '#ffea4d', '#a64dff', '#ff8c4d'];

function Board({ positions }) {
  return <main className="min-h-screen bg-[#fff8e7] p-5 md:p-8">
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 rounded-3xl border-4 border-[#18233f] bg-white p-5 text-center shadow-xl">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#7a8395]">Party Board Game</p>
        <h1 className="font-display text-4xl text-[#18233f]">The Board</h1>
      </div>
      <div className="grid grid-cols-5 gap-2 md:grid-cols-10">
        {Array.from({ length: 67 }, (_, index) => {
          const teamsHere = Object.entries(positions || {}).filter(([, position]) => position === index);
          return <div key={index} className="relative flex min-h-20 items-center justify-center rounded-xl border-2 border-[#18233f]/20 bg-white font-black text-[#18233f] shadow-sm">
            <span className="absolute left-2 top-1 text-xs text-[#7a8395]">{index + 1}</span>
            <div className="flex flex-wrap justify-center gap-1 px-2 pt-3">{teamsHere.map(([teamId]) => <span key={teamId} title={`Team ${TEAM_LABELS[teamId]}`} className="h-7 w-7 rounded-full border-2 border-[#18233f]" style={{ background: TEAM_COLORS[Number(teamId.split('-')[1]) - 1] }} />)}</div>
          </div>;
        })}
      </div>
    </div>
  </main>;
}

function DiceFace({ value }) {
  return <div className="flex h-28 w-28 items-center justify-center rounded-3xl border-4 border-[#18233f] bg-white text-7xl font-black text-[#18233f] shadow-xl">{value || '🎲'}</div>;
}

export default function PlayPage() {
  const { game, joinTeam, touchTeamSession, submitRapidAnswer, rollDice } = useGameEngine();
  const myTeamId = sessionStorage.getItem('team');
  const sessionId = sessionStorage.getItem('sessionId');
  const [now, setNow] = useState(Date.now());
  const [joinError, setJoinError] = useState('');
  const [joined, setJoined] = useState(false);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    if (game.phase !== 'minigame') return undefined;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [game.phase, game.minigame?.questionIndex, game.minigame?.startedAt]);

  useEffect(() => {
    if (!myTeamId || !sessionId || game.phase === 'finished') return undefined;
    const heartbeat = setInterval(() => touchTeamSession(myTeamId, sessionId), 5000);
    return () => clearInterval(heartbeat);
  }, [myTeamId, sessionId, game.phase, touchTeamSession]);

  useEffect(() => {
    if (game.teams?.[myTeamId]?.sessionId === sessionId) setJoined(true);
  }, [game.teams, myTeamId, sessionId]);

  useEffect(() => {
    if (game.dice?.status !== 'rolled' || game.dice?.teamId !== myTeamId) return undefined;
    setRolling(true);
    const timer = setTimeout(() => setRolling(false), 900);
    return () => clearTimeout(timer);
  }, [game.dice?.rolledAt, game.dice?.teamId, myTeamId]);

  if (!myTeamId || !sessionId) return <div className="min-h-screen bg-[#fff8e7] p-8 text-center"><h1 className="font-display text-3xl mb-6">No team assigned</h1><p>Please log in with a team word (one through six).</p></div>;

  if (game.phase === 'lobby') return <div className="min-h-screen bg-[#fff8e7] p-8 text-center flex items-center justify-center"><div className="bg-white border-4 border-[#1a1a2e] rounded-3xl p-8 shadow-xl max-w-md w-full"><p className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">Team controller</p><h1 className="font-display text-4xl mb-4">Team {TEAM_LABELS[myTeamId]}</h1><p className="text-lg mb-6">Join the lobby, then wait for the host to start the game.</p>{joinError && <p className="mb-5 rounded-xl bg-red-100 px-4 py-3 font-bold text-red-700">{joinError}</p>}<button disabled={joined} onClick={async () => { setJoinError(''); const result = await joinTeam(myTeamId, sessionId); if (result?.ok) setJoined(true); else if (result?.error) setJoinError(result.error); }} className="w-full px-6 py-4 bg-[#4dff79] border-4 border-[#1a1a2e] rounded-xl font-black shadow-md hover:scale-105 transition-transform disabled:opacity-60 disabled:hover:scale-100">{joined ? 'Joined ✓' : 'Join Lobby'}</button></div></div>;

  if (game.phase === 'minigame' && game.minigame?.type === 'rapid-shooting') {
    const questionIndex = game.minigame.questionIndex ?? 0;
    const questionId = game.minigame.questionIds?.[questionIndex];
    const question = RAPID_SHOOTING_QUESTIONS.find((item) => item.id === questionId);
    const questionCount = game.minigame.questionCount ?? 5;
    const myAnswer = game.minigame.answers?.[questionIndex]?.[myTeamId];
    const elapsed = Math.max(0, (now - (game.minigame.startedAt || now)) / 1000);
    const timeLeft = Math.max(0, RAPID_SHOOTING_TIME_LIMIT - elapsed);
    const locked = Boolean(myAnswer) || timeLeft <= 0;
    if (!question) return <div className="min-h-screen bg-[#101827] p-8 text-white flex items-center justify-center"><p className="font-black">Loading question…</p></div>;
    return <div className="min-h-screen bg-[#101827] p-5 text-white flex items-center justify-center"><main className="w-full max-w-3xl"><header className="mb-5 flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#ff8c4d]">Rapid Shooting • Dice Order</p><h1 className="font-display text-3xl">Team {TEAM_LABELS[myTeamId]}</h1></div><div className={`rounded-2xl border-4 border-white/20 px-4 py-2 text-center ${timeLeft <= 3 ? 'bg-[#ff4d4d]' : 'bg-white/10'}`}><p className="text-[10px] font-black uppercase tracking-widest opacity-70">Time</p><p className="text-2xl font-black tabular-nums">{timeLeft.toFixed(1)}s</p></div></header><section className="rounded-[2rem] border-4 border-white/15 bg-[#f7f2df] p-6 text-[#18233f] shadow-2xl"><div className="mb-5 flex items-center justify-between"><span className="rounded-full bg-[#18233f] px-3 py-1 text-xs font-black text-white">Q{questionIndex + 1} / {questionCount}</span><span className="font-black text-[#ff4d4d]">{game.minigame.scores?.[myTeamId] || 0} pts</span></div><h2 className="mb-7 text-center text-2xl md:text-4xl font-black leading-tight">{question.question}</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{question.options.map((option, index) => { const selected = myAnswer?.optionIndex === index; return <button key={option} disabled={locked} onClick={() => submitRapidAnswer(myTeamId, index)} className={`group relative min-h-28 rounded-3xl border-4 border-[#18233f] p-5 text-left font-black shadow-lg transition-transform active:scale-95 disabled:cursor-not-allowed ${TARGET_STYLES[index]} ${selected ? 'ring-8 ring-white scale-[0.98]' : 'hover:-translate-y-1'}`}><span className="absolute right-4 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#18233f] text-white">{String.fromCharCode(65 + index)}</span><span className="pr-8 text-lg md:text-xl">{option}</span></button>; })}</div><div className="mt-6 text-center font-black">{myAnswer ? (myAnswer.correct ? <p className="text-[#16843a] text-xl">🎯 HIT! +{myAnswer.points} points</p> : <p className="text-[#d12c2c] text-xl">💥 MISS! 0 points</p>) : timeLeft <= 0 ? <p className="text-[#d12c2c]">⏱ Time's up — wait for the next question.</p> : <p className="text-[#6d7890]">Shoot the correct answer as fast as you can.</p>}</div></section></main></div>;
  }

  if (game.phase === 'rapid-results') {
    const rankings = game.rankings || [];
    return <div className="min-h-screen bg-[#fff8e7] p-6 flex items-center justify-center"><main className="w-full max-w-2xl"><p className="text-center text-xs font-black uppercase tracking-[0.2em] text-[#ff8c4d]">Rapid Shot Complete</p><h1 className="mt-2 mb-6 text-center font-display text-4xl text-[#18233f]">Results</h1><div className="space-y-3">{rankings.map((ranking) => <div key={ranking.teamId} className={`flex items-center gap-4 rounded-3xl border-4 p-4 ${ranking.position === 1 ? 'border-[#ff8c4d] bg-[#fff4e8]' : 'border-[#18233f]/15 bg-white'}`}><div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#18233f] text-xl font-black text-white">{ranking.position}</div><div className="flex-1"><p className="text-xl font-black text-[#18233f]">Team {TEAM_LABELS[ranking.teamId]}</p><p className="font-bold text-[#7a8395]">{game.minigame?.scores?.[ranking.teamId] || 0} points</p></div>{ranking.position === 1 && <span className="text-3xl">🥇</span>}</div>)}</div><p className="mt-6 text-center font-bold text-[#7a8395]">Preparing the turn order…</p></main></div>;
  }

  if (game.phase === 'turn-order') {
    return <div className="min-h-screen bg-[#fff8e7] p-6 flex items-center justify-center"><main className="w-full max-w-2xl text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#ff8c4d]">Turn Order</p><h1 className="mt-2 font-display text-4xl text-[#18233f]">Team {TEAM_LABELS[game.turnOrder?.[0]]} Goes First!</h1><div className="mt-7 space-y-3 text-left">{(game.turnOrder || []).map((teamId, index) => <div key={teamId} className={`flex items-center gap-4 rounded-3xl border-4 p-4 ${index === 0 ? 'border-[#ff8c4d] bg-[#fff4e8]' : 'border-[#18233f]/15 bg-white'}`}><div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#18233f] text-xl font-black text-white">{index + 1}</div><p className="flex-1 text-xl font-black text-[#18233f]">Team {TEAM_LABELS[teamId]}</p>{index === 0 && <span className="text-3xl">🎲</span>}</div>)}</div><p className="mt-6 font-bold text-[#7a8395]">The board is starting…</p></main></div>;
  }

  if (game.phase === 'finished') {
    const myRank = (game.rankings || []).find((r) => r.teamId === myTeamId);
    return <div className="min-h-screen bg-[#fff8e7] p-8 text-center"><h1 className="font-display text-3xl mb-6">Game Over!</h1>{myRank && <p className="text-2xl font-black mb-4">You finished {myRank.position}{myRank.position === 1 ? 'st' : myRank.position === 2 ? 'nd' : myRank.position === 3 ? 'rd' : 'th'}!</p>}<p className="text-lg">Winner: Team {TEAM_LABELS[game.winner]}</p></div>;
  }

  const isMyTurn = game.phase === 'playing' && game.activeTeamId === myTeamId;
  const myPosition = game.boardPositions?.[myTeamId] ?? 0;
  const lastRoll = game.dice?.status === 'rolled' ? game.dice : null;
  return <div className="relative min-h-screen w-full overflow-hidden"><Board positions={game.boardPositions} /><div className="absolute bottom-4 left-1/2 z-20 w-[min(92%,28rem)] -translate-x-1/2">{isMyTurn ? <div className="rounded-3xl border-4 border-[#1a1a2e] bg-white p-6 text-center shadow-xl"><p className="font-display text-2xl text-[#18233f]">Your Turn!</p><p className="mb-4 text-lg">Position: Tile {myPosition + 1} / 67</p><button disabled={rolling} onClick={async () => { setRolling(true); await rollDice(myTeamId); }} className="mx-auto flex flex-col items-center gap-3 disabled:opacity-60"><DiceFace value={rolling ? null : game.dice?.teamId === myTeamId ? game.dice?.value : null} /><span className="rounded-2xl border-4 border-[#18233f] bg-[#4dff79] px-6 py-3 font-black">{rolling ? 'Rolling…' : 'ROLL DICE'}</span></button></div> : <div className="rounded-3xl border-4 border-[#1a1a2e] bg-white/95 px-6 py-5 text-center shadow-xl"><p className="text-lg">Waiting for <span className="font-black text-[#ff4d4d]">Team {TEAM_LABELS[game.activeTeamId]}</span>...</p>{lastRoll && <p className="mt-2 text-sm font-bold text-[#7a8395]">Last roll: Team {TEAM_LABELS[lastRoll.teamId]} rolled {lastRoll.value}.</p>}</div>}</div></div>;
}
