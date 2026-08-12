import { useEffect, useState } from 'react';
import { useGameEngine } from '../components/TurnEngine.jsx';
import Dice from '../components/Dice.jsx';
import Board from '../components/Board.jsx';
import { RAPID_SHOOTING_QUESTIONS, RAPID_SHOOTING_TIME_LIMIT } from '../data/rapidShootingQuestions.js';

const TEAM_LABELS = { 'team-1': 'One', 'team-2': 'Two', 'team-3': 'Three', 'team-4': 'Four', 'team-5': 'Five', 'team-6': 'Six' };
const TARGET_STYLES = ['bg-[#ff4d4d]', 'bg-[#4d79ff]', 'bg-[#4dff79]', 'bg-[#ffea4d]'];

export default function PlayPage() {
  const { game, joinTeam, touchTeamSession, submitRapidAnswer, moveToken } = useGameEngine();
  const myTeamId = sessionStorage.getItem('team');
  const sessionId = sessionStorage.getItem('sessionId');
  const [now, setNow] = useState(Date.now());
  const [joinError, setJoinError] = useState('');
  const [joined, setJoined] = useState(false);

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

  if (!myTeamId || !sessionId) return <div className="min-h-screen bg-[#fff8e7] p-8 text-center"><h1 className="font-display text-3xl mb-6">No team assigned</h1><p>Please log in with a team word (one through six).</p></div>;

  if (game.phase === 'lobby') return (
    <div className="min-h-screen bg-[#fff8e7] p-8 text-center flex items-center justify-center">
      <div className="bg-white border-4 border-[#1a1a2e] rounded-3xl p-8 shadow-xl max-w-md w-full">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">Team controller</p>
        <h1 className="font-display text-4xl mb-4">Team {TEAM_LABELS[myTeamId]}</h1>
        <p className="text-lg mb-6">Join the lobby, then wait for the host to launch the minigame.</p>
        {joinError && <p className="mb-5 rounded-xl bg-red-100 px-4 py-3 font-bold text-red-700">{joinError}</p>}
        <button
          disabled={joined}
          onClick={async () => {
            setJoinError('');
            const result = await joinTeam(myTeamId, sessionId);
            if (result?.ok) setJoined(true);
            else if (result?.error) setJoinError(result.error);
          }}
          className="w-full px-6 py-4 bg-[#4dff79] border-4 border-[#1a1a2e] rounded-xl font-black shadow-md hover:scale-105 transition-transform disabled:opacity-60 disabled:hover:scale-100"
        >
          {joined ? 'Joined ✓' : 'Join Lobby'}
        </button>
      </div>
    </div>
  );

  if (game.phase === 'minigame' && game.minigame?.type === 'rapid-shooting') {
    const questionIndex = game.minigame.questionIndex ?? 0;
    const question = RAPID_SHOOTING_QUESTIONS[questionIndex];
    const myAnswer = game.minigame.answers?.[questionIndex]?.[myTeamId];
    const elapsed = Math.max(0, (now - (game.minigame.startedAt || now)) / 1000);
    const timeLeft = Math.max(0, RAPID_SHOOTING_TIME_LIMIT - elapsed);
    const locked = Boolean(myAnswer) || timeLeft <= 0;

    return (
      <div className="min-h-screen bg-[#101827] p-5 text-white flex items-center justify-center">
        <main className="w-full max-w-3xl">
          <header className="mb-5 flex items-center justify-between gap-4">
            <div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#ff8c4d]">Rapid Shooting</p><h1 className="font-display text-3xl">Team {TEAM_LABELS[myTeamId]}</h1></div>
            <div className={`rounded-2xl border-4 border-white/20 px-4 py-2 text-center ${timeLeft <= 3 ? 'bg-[#ff4d4d]' : 'bg-white/10'}`}><p className="text-[10px] font-black uppercase tracking-widest opacity-70">Time</p><p className="text-2xl font-black tabular-nums">{timeLeft.toFixed(1)}s</p></div>
          </header>
          <section className="rounded-[2rem] border-4 border-white/15 bg-[#f7f2df] p-6 text-[#18233f] shadow-2xl">
            <div className="mb-5 flex items-center justify-between"><span className="rounded-full bg-[#18233f] px-3 py-1 text-xs font-black text-white">Q{questionIndex + 1} / {RAPID_SHOOTING_QUESTIONS.length}</span><span className="font-black text-[#ff4d4d]">{game.minigame.scores?.[myTeamId] || 0} pts</span></div>
            <h2 className="mb-7 text-center text-2xl md:text-4xl font-black leading-tight">{question.question}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {question.options.map((option, index) => {
                const selected = myAnswer?.optionIndex === index;
                return <button key={option} disabled={locked} onClick={() => submitRapidAnswer(myTeamId, index)} className={`group relative min-h-28 rounded-3xl border-4 border-[#18233f] p-5 text-left font-black shadow-lg transition-transform active:scale-95 disabled:cursor-not-allowed ${TARGET_STYLES[index]} ${selected ? 'ring-8 ring-white scale-[0.98]' : 'hover:-translate-y-1'}`}><span className="absolute right-4 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#18233f] text-white">{String.fromCharCode(65 + index)}</span><span className="pr-8 text-lg md:text-xl">{option}</span></button>;
              })}
            </div>
            <div className="mt-6 text-center font-black">
              {myAnswer ? (myAnswer.correct ? <p className="text-[#16843a] text-xl">🎯 HIT! +{myAnswer.points} points</p> : <p className="text-[#d12c2c] text-xl">💥 MISS! 0 points</p>) : timeLeft <= 0 ? <p className="text-[#d12c2c]">⏱ Time's up — wait for the next question.</p> : <p className="text-[#6d7890]">Shoot the correct answer as fast as you can.</p>}
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (game.phase === 'finished') {
    const myRank = (game.rankings || []).find((r) => r.teamId === myTeamId);
    return <div className="min-h-screen bg-[#fff8e7] p-8 text-center"><h1 className="font-display text-3xl mb-6">Game Over!</h1>{myRank && <p className="text-2xl font-black mb-4">You finished {myRank.position}{myRank.position === 1 ? 'st' : myRank.position === 2 ? 'nd' : myRank.position === 3 ? 'rd' : 'th'}!</p>}<p className="text-lg">Winner: Team {TEAM_LABELS[game.winner]}</p></div>;
  }

  const isMyTurn = game.phase === 'playing' && game.turnOrder?.[game.activeTeamIndex] === myTeamId;
  const myPosition = game.boardPositions?.[myTeamId] ?? 0;
  return <div className="relative min-h-screen w-full overflow-hidden"><Board /><div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">{isMyTurn ? <div className="bg-white border-4 border-[#1a1a2e] rounded-3xl p-6 shadow-xl max-w-md w-full text-center animate-bounce"><p className="font-display text-2xl mb-4 text-[#4dff79]">Your Turn!</p><p className="text-lg mb-4">Position: Tile {myPosition + 1} / 30</p><Dice onRoll={(v) => moveToken(myTeamId, v)} /></div> : <div className="bg-white/90 border-4 border-[#1a1a2e] rounded-3xl px-6 py-4 shadow-xl max-w-md w-full text-center"><p className="text-lg">Waiting for <span className="font-black text-[#ff4d4d]">Team {TEAM_LABELS[game.activeTeamId]}</span>...</p></div>}</div></div>;
}
