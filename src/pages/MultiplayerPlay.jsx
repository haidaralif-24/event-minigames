import { useEffect, useState } from 'react';
import Dice from '../components/Dice.jsx';
import { useRoom } from '../hooks/useRoom.js';
import { markPlayerDisconnected, rollForActivePlayer, submitChallengeChoice, submitRapidAnswer } from '../services/roomService.js';
import { RAPID_QUESTIONS, getActivePlayerId, getRankings } from '../services/gameLogic.js';
import { TOKEN_COLORS, ACTIVE_META } from '../data/constants.js';
import challengeContent from '../content/maulid-nabi/challenge.json';

export default function MultiplayerPlay() {
  const { room, loading, error, session } = useRoom();
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => () => {
    if (session?.roomCode && session?.playerId) markPlayerDisconnected(session.roomCode, session.playerId).catch(() => {});
  }, [session?.roomCode, session?.playerId]);
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#fff8e7]">Connecting…</div>;
  if (error || !room) return <div className="grid min-h-screen place-items-center bg-[#fff8e7] text-red-600">Game unavailable.</div>;

  const players = room.players || {};
  const me = players[session.playerId];
  const activeId = getActivePlayerId(room);
  const rapidQuestion = RAPID_QUESTIONS[room.rapidShot?.questionIndex || 0];
  const submitted = Boolean(room.rapidShot?.submitted?.[session.playerId]);
  const challengeQuestion = challengeContent.questions.find((question) => question.id === room.challenge?.questionId);
  const rankings = getRankings(room, players);
  const placements = room.winner ? [room.winner, ...rankings.filter((id) => id !== room.winner)].slice(0, 3) : rankings.slice(0, 3);
  const sendRapid = async () => {
    if (!answer.trim() || submitted) return;
    setBusy(true);
    try { await submitRapidAnswer(session.roomCode, session.playerId, answer); setAnswer(''); setMessage('Answer locked.'); } catch (submitError) { setMessage(submitError.message || 'Could not submit.'); } finally { setBusy(false); }
  };
  const roll = async (value) => {
    setBusy(true);
    try { await rollForActivePlayer(session.playerId, value); } catch (rollError) { setMessage(rollError.message || 'Could not roll.'); } finally { setBusy(false); }
  };
  const answerChallenge = async (choiceIndex) => {
    setBusy(true);
    try { await submitChallengeChoice(session.playerId, choiceIndex); } catch (challengeError) { setMessage(challengeError.message || 'Could not answer challenge.'); } finally { setBusy(false); }
  };

  return <div className="min-h-screen bg-[#fff8e7] p-4 text-[#18233f]">
    <header className="mx-auto mb-5 max-w-2xl text-center"><p className="text-xs font-black uppercase tracking-[.25em] text-[#ff8c4d]">{ACTIVE_META.title}</p><h1 className="mt-1 font-display text-4xl">{me?.name || session.name}</h1><p className="font-black text-[#4d79ff]">SINGLE LOBBY</p></header>
    <main className="mx-auto max-w-2xl space-y-4">
      <section className="rounded-3xl border-4 border-[#18233f] bg-white p-5"><div className="flex items-center justify-between"><h2 className="text-xl font-black">Players</h2><b>{Object.values(players).filter((player) => player.connected !== false).length}/7</b></div>{Object.values(players).sort((a, b) => a.id.localeCompare(b.id)).map((player, index) => <div key={player.id} className="mt-2 flex items-center justify-between rounded-xl bg-slate-50 p-3"><b style={{ color: TOKEN_COLORS[index % TOKEN_COLORS.length] }}>{player.name}</b><span className="text-sm font-bold text-slate-400">{player.id === activeId ? 'YOUR TURN' : player.connected ? 'READY' : 'OFFLINE'}</span></div>)}</section>
      {room.phase === 'lobby' && <section className="rounded-3xl border-4 border-[#18233f] bg-white p-8 text-center"><div className="text-5xl">⏳</div><h2 className="mt-3 text-2xl font-black">Waiting for host</h2><p className="mt-2 font-bold text-slate-500">All seven players should be logged in before the host starts.</p></section>}
      {room.phase === 'rapid-shot' && <section className="rounded-3xl border-4 border-[#18233f] bg-white p-7"><p className="text-xs font-black uppercase tracking-widest text-[#ff8c4d]">Rapid Shot {(room.rapidShot?.questionIndex || 0) + 1}/3</p><h2 className="mt-3 text-2xl font-black md:text-3xl">{rapidQuestion?.text}</h2><input disabled={submitted || busy} value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendRapid()} placeholder="Type your answer" className="mt-6 w-full rounded-xl border-4 border-[#18233f] p-4 font-bold" /><button disabled={submitted || busy || !answer.trim()} onClick={sendRapid} className="mt-3 w-full rounded-xl border-4 border-[#18233f] bg-[#4dff79] p-4 font-black disabled:opacity-40">{submitted ? 'ANSWER LOCKED' : busy ? 'SUBMITTING…' : 'SUBMIT ANSWER'}</button></section>}
      {room.phase === 'order-reveal' && <section className="rounded-3xl border-4 border-[#18233f] bg-white p-7"><h2 className="text-3xl font-black">Starting Order</h2>{room.turnOrder.map((id, index) => <div key={id} className={`mt-2 flex justify-between rounded-xl p-3 ${id === session.playerId ? 'bg-[#4dff79]/30' : ''}`}><span>#{index + 1} {players[id]?.name}</span><b>{room.rapidShot?.scores?.[id] || 0}</b></div>)}</section>}
      {room.phase === 'board' && <section className="rounded-3xl border-4 border-[#18233f] bg-white p-8 text-center"><h2 className="text-3xl font-black">{players[activeId]?.name}'s turn</h2>{activeId === session.playerId ? <><p className="mt-3 font-black text-[#ff8c4d]">ROLL ON YOUR DEVICE</p><div className="mt-5 flex justify-center"><Dice onRoll={roll} /></div></> : <p className="mt-3 font-bold text-slate-500">Watch the projected board.</p>}{room.lastChallenge && <p className={`mt-4 font-black ${room.lastChallenge.correct ? 'text-green-600' : 'text-red-600'}`}>{room.lastChallenge.playerId === session.playerId ? (room.lastChallenge.correct ? 'Challenge cleared: +3 tiles!' : 'Challenge missed: moved back to your checkpoint.') : ''}</p>}</section>}
      {room.phase === 'challenge' && <section className="rounded-3xl border-4 border-[#18233f] bg-white p-7 text-center">{room.challenge?.teamId === session.playerId ? <><p className="text-xs font-black uppercase tracking-widest text-[#4d79ff]">Challenge tile</p><h2 className="mt-3 text-2xl font-black">{challengeQuestion?.prompt}</h2><div className="mt-6 grid gap-3">{challengeQuestion?.choices.map((choice, index) => <button key={choice} disabled={busy} onClick={() => answerChallenge(index)} className="rounded-xl border-4 border-[#18233f] bg-[#fff8e7] p-4 font-black hover:bg-[#ffea4d] disabled:opacity-40">{choice}</button>)}</div></> : <><div className="text-5xl">❓</div><h2 className="mt-3 text-2xl font-black">{players[room.challenge?.teamId]?.name} is facing a challenge</h2><p className="mt-2 font-bold text-slate-500">Watch the projector for the result.</p></>}</section>}
      {room.phase === 'minigame' && <section className="rounded-3xl border-4 border-[#18233f] bg-white p-8 text-center"><p className="text-xs font-black uppercase text-[#ff8c4d]">End of round</p><h2 className="mt-2 text-3xl font-black">{room.minigame?.label}</h2><p className="mt-3 font-bold text-slate-500">{room.minigame?.description}</p></section>}
      {room.phase === 'finished' && <section className="rounded-3xl border-4 border-[#18233f] bg-white p-8 text-center"><div className="text-6xl">🏆</div><h2 className="mt-3 font-display text-3xl">Final Results</h2>{placements.map((id, index) => <p key={id} className="mt-3 rounded-xl bg-[#fff8e7] p-3 font-black">{['🥇 Winner', '🥈 Second place', '🥉 Third place'][index]} — {players[id]?.name} (Tile {(room.boardPositions?.[id] || 0) + 1})</p>)}</section>}
      {message && <p className="text-center font-bold text-[#4d79ff]">{message}</p>}
    </main>
  </div>;
}
