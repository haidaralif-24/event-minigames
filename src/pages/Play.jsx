import { useEffect, useState } from 'react';
import { useGameEngine } from '../components/TurnEngine.jsx';
import { EVENT_QUESTIONS, TEAM_COLORS } from '../data/constants.js';

const TEAM_LABELS = { 'team-1': 'One', 'team-2': 'Two', 'team-3': 'Three', 'team-4': 'Four', 'team-5': 'Five', 'team-6': 'Six' };
const ANSWER_STYLES = ['bg-[#ff4d4d]', 'bg-[#4d79ff]', 'bg-[#4dff79]', 'bg-[#ffea4d]'];

function DiceFace({ value }) {
  return <div className="flex h-24 w-24 items-center justify-center rounded-3xl border-4 border-[#18233f] bg-white text-6xl font-black text-[#18233f] shadow-xl">{value || '🎲'}</div>;
}

function QuestionCard({ game, myTeamId, now, submitAnswer }) {
  const config = game.phase === 'opening' ? game.opening : game.minigame;
  const question = EVENT_QUESTIONS.find((item) => item.id === config?.questionIds?.[config?.questionIndex]);
  if (!question) return <div className="rounded-3xl bg-white p-8 text-center font-black">Loading question…</div>;
  const answer = config?.answers?.[config.questionIndex]?.[myTeamId];
  const started = config.startedAt?.toMillis?.() ?? config.startedAt ?? now;
  const timeLeft = Math.max(0, (config.timeLimit || 10) - ((now - started) / 1000));
  const locked = Boolean(answer) || timeLeft <= 0;
  return <div className="min-h-screen bg-[#101827] p-4 text-white flex items-center justify-center">
    <main className="w-full max-w-4xl">
      <header className="mb-5 flex items-center justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[0.22em] text-[#ff8c4d]">{game.phase === 'opening' ? 'Opening Rapid Shot' : game.minigame?.label || 'Mini-game'}</p><h1 className="font-display text-3xl">Team {TEAM_LABELS[myTeamId]}</h1></div>
        <div className={`rounded-2xl border-4 border-white/15 px-4 py-2 text-center ${timeLeft <= 3 ? 'bg-[#ff4d4d]' : 'bg-white/10'}`}><p className="text-[10px] font-black uppercase tracking-widest opacity-70">Time</p><p className="text-2xl font-black tabular-nums">{timeLeft.toFixed(1)}s</p></div>
      </header>
      <section className="rounded-[2rem] border-4 border-[#18233f] bg-[#f7f2df] p-6 md:p-9 text-[#18233f] shadow-2xl">
        <div className="mb-5 flex items-center justify-between"><span className="rounded-full bg-[#18233f] px-3 py-1 text-xs font-black text-white">Q{config.questionIndex + 1} / {config.questionCount}</span><span className="font-black text-[#ff8c4d]">{config.scores?.[myTeamId] || 0} pts</span></div>
        {game.phase === 'minigame' && <p className="mb-4 text-center text-sm font-black uppercase tracking-widest text-[#7a8395]">{game.minigame?.description}</p>}
        <h2 className="mb-7 text-center text-2xl md:text-4xl font-black leading-tight">{question.prompt}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{question.choices.map((choice, index) => <button key={choice} disabled={locked} onClick={() => submitAnswer(myTeamId, index)} className={`relative min-h-24 rounded-3xl border-4 border-[#18233f] p-5 text-left font-black shadow-lg transition-transform active:scale-95 disabled:cursor-not-allowed ${ANSWER_STYLES[index]} ${answer?.optionIndex === index ? 'ring-8 ring-white scale-[0.98]' : 'hover:-translate-y-1'}`}><span className="absolute right-4 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#18233f] text-white">{String.fromCharCode(65 + index)}</span><span className="pr-8 text-lg md:text-xl">{choice}</span></button>)}</div>
        <div className="mt-6 text-center font-black">{answer ? (answer.correct ? <p className="text-[#16843a] text-xl">🎯 Correct! +{answer.points}</p> : <p className="text-[#d12c2c] text-xl">💥 Miss! 0 points</p>) : timeLeft <= 0 ? <p className="text-[#d12c2c]">⏱ Time's up.</p> : <p className="text-[#6d7890]">Lock your answer as quickly as you can.</p>}</div>
      </section>
    </main>
  </div>;
}

function ChallengeCard({ game, myTeamId, now, submitChallengeAnswer }) {
  const ch = game.challenge;
  const question = EVENT_QUESTIONS.find((item) => item.id === ch?.questionId);
  if (!question) return <div className="rounded-3xl bg-white p-8 text-center font-black">Loading question…</div>;
  const started = ch.startedAt?.toMillis?.() ?? ch.startedAt ?? now;
  const timeLeft = Math.max(0, (ch.timeLimit || 15) - ((now - started) / 1000));
  const locked = Boolean(ch.resolved) || timeLeft <= 0;
  return <div className="min-h-screen bg-[#101827] p-4 text-white flex items-center justify-center">
    <main className="w-full max-w-4xl">
      <header className="mb-5 flex items-center justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[0.22em] text-[#4d79ff]">Challenge Tile</p><h1 className="font-display text-3xl">Team {TEAM_LABELS[myTeamId]}</h1></div>
        <div className={`rounded-2xl border-4 border-white/15 px-4 py-2 text-center ${timeLeft <= 3 ? 'bg-[#ff4d4d]' : 'bg-white/10'}`}><p className="text-[10px] font-black uppercase tracking-widest opacity-70">Time</p><p className="text-2xl font-black tabular-nums">{timeLeft.toFixed(1)}s</p></div>
      </header>
      <section className="rounded-[2rem] border-4 border-[#4d79ff] bg-[#f7f2df] p-6 md:p-9 text-[#18233f] shadow-2xl">
        <div className="mb-5 text-center font-black text-[#4d79ff]">Win: +3 tiles · Lose: −5 tiles</div>
        <h2 className="mb-7 text-center text-2xl md:text-4xl font-black leading-tight">{question.prompt}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{question.choices.map((choice, index) => {
          const isChosen = ch.resolved && ch.answer === index;
          return <button key={choice} disabled={locked} onClick={() => submitChallengeAnswer(myTeamId, index)} className={`relative min-h-24 rounded-3xl border-4 border-[#18233f] p-5 text-left font-black shadow-lg transition-transform active:scale-95 disabled:cursor-not-allowed ${ANSWER_STYLES[index]} ${isChosen ? 'ring-8 ring-white scale-[0.98]' : 'hover:-translate-y-1'}`}><span className="absolute right-4 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#18233f] text-white">{String.fromCharCode(65 + index)}</span><span className="pr-8 text-lg md:text-xl">{choice}</span></button>;
        })}</div>
        <div className="mt-6 text-center font-black">{ch.resolved ? (ch.correct ? <p className="text-[#16843a] text-xl">🎯 Correct! +3 tiles</p> : <p className="text-[#d12c2c] text-xl">💥 Wrong! −5 tiles</p>) : timeLeft <= 0 ? <p className="text-[#d12c2c]">⏱ Time's up. −5 tiles</p> : <p className="text-[#6d7890]">Answer to claim your bonus.</p>}</div>
      </section>
    </main>
  </div>;
}

function ChallengeWait({ game }) {
  return <div className="min-h-screen bg-[#fff8e7] p-8 flex items-center justify-center"><main className="w-full max-w-md text-center rounded-[2rem] border-4 border-[#18233f] bg-white p-8 shadow-xl"><div className="text-6xl">❓</div><p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-[#4d79ff]">Challenge Tile</p><h1 className="mt-2 font-display text-4xl text-[#18233f]">Team {TEAM_LABELS[game.challenge?.teamId]} is facing a challenge!</h1><p className="mt-4 text-lg font-semibold text-[#586176]">Watch the big screen for the question. Your turn is next.</p></main></div>;
}

export default function PlayPage() {
  const { game, joinTeam, touchTeamSession, submitAnswer, submitChallengeAnswer, rollDice } = useGameEngine();
  const myTeamId = sessionStorage.getItem('team');
  const sessionId = sessionStorage.getItem('sessionId');
  const [now, setNow] = useState(Date.now());
  const [joinError, setJoinError] = useState('');
  const [joined, setJoined] = useState(false);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    if (!['opening', 'minigame', 'challenge'].includes(game.phase)) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [game.phase, game.opening?.questionIndex, game.minigame?.questionIndex, game.challenge?.questionIndex, game.opening?.startedAt, game.minigame?.startedAt, game.challenge?.startedAt]);

  useEffect(() => {
    if (!myTeamId || !sessionId || game.phase === 'finished') return undefined;
    const heartbeat = setInterval(() => touchTeamSession(myTeamId, sessionId), 5000);
    return () => clearInterval(heartbeat);
  }, [myTeamId, sessionId, game.phase, touchTeamSession]);

  useEffect(() => { if (game.teams?.[myTeamId]?.sessionId === sessionId) setJoined(true); }, [game.teams, myTeamId, sessionId]);
  useEffect(() => { if (game.dice?.rolledAt && game.dice?.teamId === myTeamId) { setRolling(true); const timer = setTimeout(() => setRolling(false), 900); return () => clearTimeout(timer); } return undefined; }, [game.dice?.rolledAt, game.dice?.teamId, myTeamId]);

  if (!myTeamId || !sessionId) return <div className="min-h-screen bg-[#fff8e7] flex items-center justify-center p-8"><div className="rounded-3xl border-4 border-[#18233f] bg-white p-8 text-center shadow-xl"><h1 className="font-display text-3xl">No team session</h1><p className="mt-2">Return to the login screen.</p></div></div>;

  if (game.phase === 'lobby') return <div className="min-h-screen bg-[#fff8e7] p-8 flex items-center justify-center"><main className="w-full max-w-md rounded-[2rem] border-4 border-[#18233f] bg-white p-8 text-center shadow-xl"><div className="mx-auto mb-5 h-20 w-20 rounded-full border-4 border-[#18233f]" style={{ background: TEAM_COLORS[Number(myTeamId.split('-')[1]) - 1] }} /><p className="text-xs font-black uppercase tracking-[0.2em] text-[#7a8395]">Player controller</p><h1 className="font-display text-4xl text-[#18233f]">Team {TEAM_LABELS[myTeamId]}</h1><p className="my-6 text-lg font-semibold text-[#586176]">Join the lobby, then keep this screen open. The host controls the game start.</p>{joinError && <p className="mb-5 rounded-xl bg-red-100 px-4 py-3 font-bold text-red-700">{joinError}</p>}<button disabled={joined} onClick={async () => { setJoinError(''); const result = await joinTeam(myTeamId, sessionId); if (result?.ok) setJoined(true); else if (result?.error) setJoinError(result.error); }} className="w-full rounded-2xl border-4 border-[#18233f] bg-[#4dff79] px-6 py-4 font-black shadow-md disabled:opacity-60">{joined ? '✓ Joined — Waiting for Host' : 'Join Lobby'}</button></main></div>;

  if (game.phase === 'opening' || game.phase === 'minigame') return <QuestionCard game={game} myTeamId={myTeamId} now={now} submitAnswer={submitAnswer} />;

  if (game.phase === 'challenge') {
    if (game.challenge?.teamId !== myTeamId) return <ChallengeWait game={game} />;
    return <ChallengeCard game={game} myTeamId={myTeamId} now={now} submitChallengeAnswer={submitChallengeAnswer} />;
  }

  if (game.phase === 'opening-results' || game.phase === 'turn-order') return <div className="min-h-screen bg-[#fff8e7] p-6 flex items-center justify-center"><main className="w-full max-w-2xl text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#ff8c4d]">{game.phase === 'opening-results' ? 'Opening complete' : 'Game starting'}</p><h1 className="mt-2 font-display text-4xl text-[#18233f]">{game.phase === 'opening-results' ? `Team ${TEAM_LABELS[game.turnOrder?.[0]]} rolls first!` : 'Get ready!'}</h1><div className="mt-7 space-y-3 text-left">{(game.turnOrder || []).map((teamId, index) => <div key={teamId} className={`flex items-center gap-4 rounded-3xl border-4 p-4 ${index === 0 ? 'border-[#ff8c4d] bg-[#fff4e8]' : 'border-[#18233f]/15 bg-white'}`}><div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#18233f] text-xl font-black text-white">{index + 1}</div><p className="flex-1 text-xl font-black text-[#18233f]">Team {TEAM_LABELS[teamId]}</p>{index === 0 && <span className="text-3xl">🎲</span>}</div>)}</div><p className="mt-6 font-bold text-[#7a8395]">Watch the big screen…</p></main></div>;

  if (game.phase === 'minigame-results' || game.phase === 'round-transition') return <div className="min-h-screen bg-[#fff8e7] p-6 flex items-center justify-center"><main className="w-full max-w-2xl text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#ff8c4d]">Round {game.round} complete</p><h1 className="mt-2 font-display text-4xl text-[#18233f]">Next round order</h1><div className="mt-7 space-y-3 text-left">{(game.rankings || []).map((r) => <div key={r.teamId} className="flex items-center gap-4 rounded-3xl border-4 border-[#18233f]/15 bg-white p-4"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#18233f] text-xl font-black text-white">{r.position}</div><p className="flex-1 text-xl font-black">Team {TEAM_LABELS[r.teamId]}</p></div>)}</div><p className="mt-6 font-bold text-[#7a8395]">Winner starts the next dice round.</p></main></div>;

  if (game.phase === 'finished') return <div className="min-h-screen bg-[#fff8e7] p-8 flex items-center justify-center text-center"><main><div className="text-7xl">🏆</div><p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-[#ff8c4d]">Game complete</p><h1 className="font-display text-5xl text-[#18233f]">Team {TEAM_LABELS[game.winner]} wins!</h1><p className="mt-4 text-xl font-black text-[#586176]">Your final position: Tile {(game.boardPositions?.[myTeamId] ?? 0) + 1} / 67</p></main></div>;

  const isMyTurn = game.phase === 'playing' && game.activeTeamId === myTeamId;
  const myPosition = game.boardPositions?.[myTeamId] ?? 0;
  return <div className="min-h-screen bg-[#fff8e7] p-5 flex items-center justify-center"><main className="w-full max-w-md text-center"><div className="mb-5 rounded-[2rem] border-4 border-[#18233f] bg-white p-5 shadow-xl"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#7a8395]">Round {game.round}</p><h1 className="font-display text-4xl text-[#18233f]">Team {TEAM_LABELS[myTeamId]}</h1><p className="mt-1 font-black text-[#7a8395]">Tile {myPosition + 1} / 67</p></div>{isMyTurn ? <div className="rounded-[2rem] border-4 border-[#18233f] bg-white p-7 shadow-xl"><p className="mb-5 font-display text-3xl text-[#18233f]">YOUR TURN!</p><div className="mb-6 flex justify-center gap-4"><DiceFace value={rolling ? null : game.dice?.die1} /><DiceFace value={rolling ? null : game.dice?.die2} /></div><p className="mb-5 text-lg font-black text-[#7a8395]">Roll 2 dice • move up to 12 tiles</p><button disabled={rolling} onClick={async () => { setRolling(true); await rollDice(myTeamId); }} className="w-full rounded-2xl border-4 border-[#18233f] bg-[#4dff79] px-6 py-5 text-xl font-black shadow-md disabled:opacity-60">{rolling ? 'ROLLING…' : '🎲 ROLL BOTH DICE'}</button></div> : <div className="rounded-[2rem] border-4 border-[#18233f]/20 bg-white p-7 shadow-xl"><p className="text-lg font-black text-[#586176]">Waiting for</p><p className="mt-1 font-display text-3xl text-[#18233f]">Team {TEAM_LABELS[game.activeTeamId]}</p><p className="mt-5 text-sm font-bold text-[#7a8395]">Keep watching the board. Your turn will appear here.</p></div>}</main></div>;
}
