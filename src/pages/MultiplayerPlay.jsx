import { useEffect, useRef, useState } from 'react';
import Dice from '../components/Dice.jsx';
import { useRoom } from '../hooks/useRoom.js';
import { beginRoll, markPlayerConnected, markPlayerDisconnected, rollForActivePlayer, submitChallengeChoice, submitMinigameAnswer, submitRapidAnswer, updateRoom } from '../services/roomService.js';

// Keep in sync with the animation feel in Dice.jsx — this is how long the
// dice visibly rolls for everyone (host, board, other players) before the
// real outcome resolves.
const ROLL_ANIMATION_MS = 1100;
import { RAPID_QUESTIONS, getActivePlayerId, getRankings } from '../services/gameLogic.js';
import { TOKEN_COLORS, ACTIVE_META } from '../data/constants.js';
import challengeContent from '../content/maulid-nabi/challenge.json';
import minigameQuestions from '../content/maulid-nabi/minigameQuestions.json';

const ANSWER_STYLES = [
  'bg-[#e84d4d] hover:bg-[#f05b5b]',
  'bg-[#3f73d9] hover:bg-[#5183e5]',
  'bg-[#d8a91e] hover:bg-[#e5b52b]',
  'bg-[#3cae61] hover:bg-[#49bf70]',
];
const ANSWER_ICONS = ['▲', '◆', '●', '■'];

function PlayerShell({ children, title, step, me, room }) {
  const connected = Object.values(room.players || {}).filter((player) => player.connected !== false).length;
  return (
    <div className="h-screen overflow-y-auto bg-[#f4f4f7] text-[#18233f]">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-4">
          <div className="flex items-center gap-4">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#18233f] text-xl text-white shadow-sm">🎮</div>
            <div>
              <p className="text-xs font-black uppercase tracking-[.2em] text-[#ff8c4d]">{ACTIVE_META.title}</p>
              <p className="font-black">{title}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm font-black">
            <span className="rounded-full bg-[#eef0f6] px-4 py-2">ROOM • {room.code || '----'}</span>
            <span className="rounded-full bg-[#e7f7ec] px-4 py-2 text-[#218548]">● {connected}/6</span>
            {me?.avatar && <img src={me.avatar} alt={me.name} className="h-9 w-9 rounded-full border-2 border-[#18233f] object-cover" />}
            <span className="rounded-full bg-[#18233f] px-4 py-2 text-white">{me?.name}</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-8 py-8 pb-16">{children}</main>
    </div>
  );
}

function PhaseLabel({ children, step }) {
  return <div className="mb-5 flex items-center justify-center gap-3"><span className="rounded-full bg-[#18233f] px-4 py-2 text-xs font-black uppercase tracking-widest text-white">{step}</span><span className="text-sm font-black uppercase tracking-[.2em] text-[#6c7180]">{children}</span></div>;
}

function AnswerButton({ choice, index, selected, disabled, onClick }) {
  return <button disabled={disabled} onClick={onClick} className={`group flex min-h-28 items-center gap-5 rounded-2xl px-7 py-5 text-left text-xl font-black text-white shadow-[0_5px_0_rgba(0,0,0,.18)] transition duration-150 hover:-translate-y-0.5 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-55 ${ANSWER_STYLES[index]}`}>
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-black/15 text-2xl">{ANSWER_ICONS[index]}</span>
    <span className="flex-1">{choice}</span>
    {selected && <span className="rounded-full bg-white px-3 py-1 text-sm text-[#18233f]">LOCKED</span>}
  </button>;
}

function AnswerReveal({ question, playerChoiceIndex, correct, label }) {
  if (!question) return null;
  return (
    <div className="mt-7 rounded-2xl border-2 border-[#18233f]/10 bg-[#f6f8ff] p-5">
      <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#4d79ff]">{label || 'Correct answer'}</p>
      <ul className="mt-3 space-y-2">
        {question.choices.map((choice, index) => {
          const isCorrect = index === question.answerIndex;
          const isPlayer = index === playerChoiceIndex;
          const cls = isCorrect
            ? 'border-[#3cae61] bg-[#dff8e7] text-[#1c6b3a]'
            : isPlayer
              ? 'border-[#c43838] bg-[#fde4e4] text-[#8f2b2b]'
              : 'border-[#18233f]/10 bg-white text-[#18233f]';
          return (
            <li key={choice} className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-lg font-black ${cls}`}>
              <span>{isCorrect ? '✅' : isPlayer ? '❌' : ''}</span>
              <span className="flex-1">{choice}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-base font-black text-[#18233f]">Correct answer: <span className="text-[#218548]">{question.choices[question.answerIndex]}</span>{typeof correct === 'boolean' && <span className={correct ? ' text-[#218548]' : ' text-[#c43838]'}> · {correct ? 'You got it!' : 'You missed it.'}</span>}</p>
    </div>
  );
}

export default function MultiplayerPlay() {
  const { room, loading, error, session } = useRoom();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (session?.roomCode && session?.playerId) markPlayerConnected(session.roomCode, session.playerId).catch(() => {});
    return () => {
      if (session?.roomCode && session?.playerId) markPlayerDisconnected(session.roomCode, session.playerId).catch(() => {});
    };
  }, [session?.roomCode, session?.playerId]);

  // When a challenge tile resolves, surface the correct answer on the player's
  // device for a beat even though the phase has already flipped back to 'board'.
  const [challengeRevealActive, setChallengeRevealActive] = useState(false);
  const prevChallengeResolved = useRef(false);
  useEffect(() => {
    const resolved = Boolean(room.challenge?.resolved);
    if (resolved && !prevChallengeResolved.current) {
      setChallengeRevealActive(true);
      const timer = setTimeout(() => setChallengeRevealActive(false), 4500);
      prevChallengeResolved.current = resolved;
      return () => clearTimeout(timer);
    }
    prevChallengeResolved.current = resolved;
  }, [room.challenge?.resolved]);

  if (loading) return <div className="grid h-screen place-items-center bg-[#f4f4f7] text-xl font-black">Connecting…</div>;
  if (error || !room) return <div className="grid h-screen place-items-center bg-[#f4f4f7] text-xl font-black text-red-600">Game unavailable.</div>;

  const players = room.players || {};
  const me = players[session.playerId];
  const activeId = getActivePlayerId(room);
  const rapidQuestion = RAPID_QUESTIONS[room.rapidShot?.questionIndex || 0];
  const submitted = Boolean(room.rapidShot?.submitted?.[session.playerId]);
  const challengeQuestion = challengeContent.questions.find((question) => question.id === room.challenge?.questionId);
  const minigameQuestion = minigameQuestions.find((question) => question.id === room.minigame?.questionId);
  const miniSubmitted = Boolean(room.minigame?.submitted?.[session.playerId]);
  const rankings = getRankings(room, players);
  const placements = room.winner ? [room.winner, ...rankings.filter((id) => id !== room.winner)].slice(0, 3) : rankings.slice(0, 3);

  const sendRapid = async (choiceIndex) => {
    if (submitted) return;
    setBusy(true); setMessage('');
    try { await submitRapidAnswer(session.roomCode, session.playerId, choiceIndex); setMessage('Answer locked!'); }
    catch (submitError) { setMessage(submitError.message || 'Could not submit.'); }
    finally { setBusy(false); }
  };
  const roll = async () => {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      await beginRoll(session.playerId);
      const die1 = Math.floor(Math.random() * 6) + 1;
      const die2 = Math.floor(Math.random() * 6) + 1;
      setTimeout(async () => {
        try { await rollForActivePlayer(session.playerId, [die1, die2]); }
        catch (rollError) {
          setMessage(rollError.message || 'Could not roll.');
          try { await updateRoom(session.roomCode, { rolling: null }); } catch {}
        }
        finally { setBusy(false); }
      }, ROLL_ANIMATION_MS);
    } catch (rollError) {
      setMessage(rollError.message || 'Could not roll.');
      setBusy(false);
    }
  };
  const answerChallenge = async (choiceIndex) => {
    setBusy(true); setMessage('');
    try { await submitChallengeChoice(session.playerId, choiceIndex); }
    catch (challengeError) { setMessage(challengeError.message || 'Could not answer.'); }
    finally { setBusy(false); }
  };
  const sendMinigame = async (choiceIndex) => {
    if (miniSubmitted) return;
    setBusy(true); setMessage('');
    try { await submitMinigameAnswer(session.roomCode, session.playerId, choiceIndex); setMessage('Answer locked!'); }
    catch (submitError) { setMessage(submitError.message || 'Could not submit.'); }
    finally { setBusy(false); }
  };

  return <PlayerShell title={room.phase === 'rapid-shot' ? 'Rapid Shot' : room.phase === 'challenge' ? 'Challenge Tile' : 'Player Console'} step={room.phase} me={me} room={room}>
    {room.phase === 'lobby' && <section className="mx-auto max-w-4xl text-center">
      <PhaseLabel step="LOBBY">Get ready</PhaseLabel>
      <div className="rounded-3xl bg-white px-12 py-14 shadow-xl ring-1 ring-black/5">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-3xl bg-[#4d79ff] text-5xl shadow-lg">⏳</div>
        <h1 className="mt-7 text-5xl font-black">Waiting for the host</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg font-bold text-[#737887]">You're in! Keep this screen open. The host will start the game when everyone is ready.</p>
        <div className="mt-10 flex justify-center gap-3">{Object.values(players).map((player, index) => <div key={player.id} title={player.name} className={`h-4 w-4 rounded-full ${player.connected !== false ? 'bg-[#4dff79]' : 'bg-[#d6d9e1]'}`} style={{ opacity: 1 - index * .08 }} />)}</div>
        <p className="mt-3 font-black text-[#4d79ff]">{Object.values(players).filter((player) => player.connected !== false).length} / 6 players connected</p>
      </div>
    </section>}

    {room.phase === 'rapid-shot' && <section className="mx-auto max-w-5xl">
      <PhaseLabel step={`QUESTION ${(room.rapidShot?.questionIndex || 0) + 1} / 3`}>Rapid Shot</PhaseLabel>
      <div className="rounded-3xl bg-white px-10 py-10 shadow-xl ring-1 ring-black/5">
        <h1 className="mx-auto max-w-4xl text-center text-4xl font-black leading-tight">{rapidQuestion?.text}</h1>
        <div className="mt-9 grid grid-cols-2 gap-5">
          {rapidQuestion?.choices?.map((choice, index) => <AnswerButton key={choice} choice={choice} index={index} selected={submitted && room.rapidShot?.answers?.[session.playerId] === index} disabled={submitted || busy} onClick={() => sendRapid(index)} />)}
        </div>
        <div className="mt-7 min-h-8 text-center font-black text-[#4d79ff]">{submitted ? '✓ Answer locked. Waiting for the other players…' : message}</div>
        {submitted && <AnswerReveal question={rapidQuestion} playerChoiceIndex={room.rapidShot?.answers?.[session.playerId]} correct={room.rapidShot?.answers?.[session.playerId] === rapidQuestion?.answerIndex} label="Rapid Shot · Answer" />}
      </div>
    </section>}

    {room.phase === 'order-reveal' && <section className="mx-auto max-w-4xl">
      <PhaseLabel step="START">Starting Order</PhaseLabel>
      <div className="rounded-3xl bg-white p-8 shadow-xl ring-1 ring-black/5">
        <h1 className="text-center text-4xl font-black">You're starting at…</h1>
        <div className="mx-auto mt-8 max-w-2xl space-y-3">{room.turnOrder.map((id, index) => <div key={id} className={`flex items-center gap-5 rounded-2xl px-5 py-4 ${id === session.playerId ? 'bg-[#dff8e7] ring-2 ring-[#3cae61]' : 'bg-[#f4f5f8]'}`}><span className="grid h-10 w-10 place-items-center rounded-full bg-[#18233f] font-black text-white">{index + 1}</span>{players[id]?.avatar && <img src={players[id].avatar} alt={players[id].name} className="h-10 w-10 rounded-full border-2 border-[#18233f] object-cover" />}<span className="flex-1 text-lg font-black">{players[id]?.name}</span><span className="font-black text-[#6c7180]">{room.rapidShot?.scores?.[id] || 0} pts</span></div>)}</div>
      </div>
    </section>}

    {room.phase === 'board' && <section className="mx-auto max-w-4xl text-center">
      <PhaseLabel step="BOARD">{activeId === session.playerId ? 'Your turn' : 'Watch the board'}</PhaseLabel>
      <div className="rounded-3xl bg-white px-10 py-12 shadow-xl ring-1 ring-black/5">
        {activeId === session.playerId ? <><div className="mx-auto grid h-24 w-24 place-items-center rounded-3xl bg-[#ff8c4d] text-5xl shadow-lg">🎲</div><h1 className="mt-6 text-5xl font-black">Your turn!</h1><p className="mt-3 text-lg font-bold text-[#737887]">Roll both dice to move on the projected board.</p><div className="mt-8 flex justify-center"><Dice rolling={Boolean(room.rolling?.playerId === session.playerId)} values={room.lastRoll?.dice || [1, 1]} onRollStart={roll} disabled={busy} /></div></> : <><div className="text-7xl">👀</div>{players[activeId]?.avatar && <img src={players[activeId].avatar} alt={players[activeId].name} className="mx-auto mt-4 h-20 w-20 rounded-full border-4 border-[#18233f] object-cover" />}<h1 className="mt-6 text-5xl font-black">{players[activeId]?.name}'s turn</h1><p className="mt-3 text-lg font-bold text-[#737887]">Watch the projected board. Your turn is coming up!</p><div className="mt-8 flex justify-center"><Dice rolling={Boolean(room.rolling?.playerId === activeId)} values={room.lastRoll?.dice || [1, 1]} /></div></>}
        {room.lastChallenge?.playerId === session.playerId && <p className={`mt-6 rounded-2xl p-4 font-black ${room.lastChallenge.correct ? 'bg-[#dff8e7] text-[#218548]' : 'bg-[#fde4e4] text-[#c43838]'}`}>{room.lastChallenge.correct ? '🎉 Challenge cleared: +3 tiles!' : '❌ Challenge missed: moved back to your checkpoint.'}</p>}
        {challengeRevealActive && room.challenge?.resolved && <AnswerReveal question={challengeQuestion} playerChoiceIndex={room.challenge?.choiceIndex} correct={room.challenge?.correct} label="Challenge Tile · Answer" />}
      </div>
    </section>}

    {room.phase === 'challenge' && <section className="mx-auto max-w-5xl">
      <PhaseLabel step="CHALLENGE">Challenge tile</PhaseLabel>
      <div className="rounded-3xl bg-white px-10 py-10 shadow-xl ring-1 ring-black/5">
        {room.challenge?.teamId === session.playerId ? <><h1 className="mx-auto max-w-4xl text-center text-4xl font-black leading-tight">{challengeQuestion?.prompt}</h1><div className="mt-9 grid grid-cols-2 gap-5">{challengeQuestion?.choices.map((choice, index) => <AnswerButton key={choice} choice={choice} index={index} disabled={busy} onClick={() => answerChallenge(index)} />)}</div></> : <div className="py-12 text-center"><div className="text-7xl">⚡</div>{players[room.challenge?.teamId]?.avatar && <img src={players[room.challenge?.teamId].avatar} alt={players[room.challenge?.teamId].name} className="mx-auto mt-4 h-20 w-20 rounded-full border-4 border-[#18233f] object-cover" />}<h1 className="mt-6 text-4xl font-black">{players[room.challenge?.teamId]?.name} is answering</h1><p className="mt-3 text-lg font-bold text-[#737887]">Watch the projector for the result.</p></div>}
      </div>
    </section>}

    {room.phase === 'minigame' && <section className="mx-auto max-w-5xl">
      <PhaseLabel step="ROUND BREAK">Mini-game</PhaseLabel>
      <div className="rounded-3xl bg-white px-10 py-10 shadow-xl ring-1 ring-black/5">
        <p className="text-center text-[11px] font-black uppercase tracking-[.16em] text-[#ff8c4d]">{room.minigame?.label}</p>
        <h1 className="mx-auto mt-1 max-w-4xl text-center text-4xl font-black leading-tight">{minigameQuestion?.text}</h1>
        <div className="mt-9 grid grid-cols-2 gap-5">
          {minigameQuestion?.choices?.map((choice, index) => <AnswerButton key={choice} choice={choice} index={index} selected={miniSubmitted && room.minigame?.answers?.[session.playerId]?.choiceIndex === index} disabled={miniSubmitted || busy} onClick={() => sendMinigame(index)} />)}
        </div>
        <div className="mt-7 min-h-8 text-center font-black text-[#4d79ff]">{miniSubmitted ? '✓ Answer locked. Waiting for the other players…' : message}</div>
        {miniSubmitted && <AnswerReveal question={minigameQuestion} playerChoiceIndex={room.minigame?.answers?.[session.playerId]?.choiceIndex} correct={room.minigame?.answers?.[session.playerId]?.choiceIndex === minigameQuestion?.answerIndex} label="Round Break · Answer" />}
      </div>
    </section>}

    {room.phase === 'finished' && <section className="mx-auto max-w-4xl text-center"><PhaseLabel step="FINISH">Final results</PhaseLabel><div className="rounded-3xl bg-white px-10 py-12 shadow-xl ring-1 ring-black/5"><div className="text-7xl">🏆</div><h1 className="mt-5 text-5xl font-black">Game complete!</h1><div className="mx-auto mt-8 max-w-2xl space-y-3">{placements.map((id, index) => <div key={id} className={`flex items-center rounded-2xl px-6 py-5 text-left ${index === 0 ? 'bg-[#fff3c4]' : 'bg-[#f4f5f8]'}`}><span className="mr-5 text-3xl">{['🥇', '🥈', '🥉'][index]}</span>{players[id]?.avatar && <img src={players[id].avatar} alt={players[id].name} className="mr-4 h-12 w-12 rounded-full border-2 border-[#18233f] object-cover" />}<span className="flex-1 text-xl font-black">{players[id]?.name}</span><span className="font-black text-[#6c7180]">Tile {(room.boardPositions?.[id] || 0) + 1}</span></div>)}</div><p className="mt-8 font-black text-[#4d79ff]">Great game, {me?.name}!</p></div></section>}

    {message && room.phase !== 'rapid-shot' && <p className="mx-auto mt-5 max-w-4xl rounded-xl bg-white px-5 py-3 text-center font-black text-red-600 shadow-sm">{message}</p>}
  </PlayerShell>;
}
