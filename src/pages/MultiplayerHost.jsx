import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Board from '../components/MultiplayerBoard.jsx';
import Dice from '../components/Dice.jsx';
import { useRoom } from '../hooks/useRoom.js';
import { getActivePlayerId, getRankings, resolveRapidShotOrder, RAPID_QUESTIONS } from '../services/gameLogic.js';
import { resetGame, updateRoom, pickMinigameQuestion, MINIGAME_QUESTIONS } from '../services/roomService.js';
import { TOKEN_COLORS, ACTIVE_META, MINI_GAMES } from '../data/constants.js';
import { PLAYER_ACCOUNTS } from '../data/loginAccounts.js';
import challengeContent from '../content/maulid-nabi/challenge.json';
import boardTiles from '../data/boardTiles.json';

const TOTAL_TILES = boardTiles.length;
const MIN_MINIGAME_DISPLAY_MS = 3500;

function PhaseBadge({ phase, round }) {
  const labels = {
    lobby: 'Lobby',
    'rapid-shot': `Rapid Shot ${round || 1}`,
    'order-reveal': 'Starting Order',
    board: `Round ${round || 1} · Rolling`,
    minigame: 'Mini-game',
    finished: 'Finished',
  };
  const isLive = phase === 'board' || phase === 'rapid-shot' || phase === 'minigame';
  return <div className="flex flex-col items-end rounded-2xl border-2 border-white/10 bg-[#132352] px-4 py-2">
    <span className="text-[10px] font-black uppercase tracking-[.18em] text-[#8a93b8]">Phase</span>
    <span className={`text-sm font-black ${isLive ? 'text-[#45f27b]' : 'text-white'}`}>{labels[phase] || 'Lobby'}</span>
  </div>;
}

function PlayerRow({ player, index, started, position }) {
  const color = TOKEN_COLORS[index % TOKEN_COLORS.length];
  const progress = Math.round((Math.max(0, position || 0) / (TOTAL_TILES - 1)) * 100);
  return <div className="flex items-center gap-2.5 rounded-xl px-1.5 py-2">
    {player.avatar ? (
      <img src={player.avatar} alt={player.name} className="h-9 w-9 shrink-0 rounded-[10px] border-[2.5px] border-[#18233f] object-cover" />
    ) : (
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border-[2.5px] border-[#18233f] text-xs font-black text-white" style={{ backgroundColor: color }}>#{index + 1}</div>
    )}
    <div className="min-w-0 flex-1">
      <p className="truncate text-[13px] font-black text-[#18233f]">{player.name}</p>
      <p className="text-[10.5px] font-extrabold text-[#7a8395]">{player.connected ? (started ? `Tile ${(position || 0) + 1} / ${TOTAL_TILES}` : 'Connected') : 'Waiting to join'}</p>
    </div>
    {started && <div className="h-1.5 w-14 shrink-0 overflow-hidden rounded bg-[#e7e2cf]"><span className="block h-full rounded" style={{ width: `${progress}%`, backgroundColor: color }} /></div>}
    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${player.connected ? 'bg-[#45f27b] shadow-[0_0_0_3px_rgba(69,242,123,.25)]' : 'bg-[#c7cadb]'}`} />
  </div>;
}

function Leaderboard({ rankings, players, boardPositions }) {
  if (!rankings.length) return <div className="py-5 text-center"><div className="mb-1 text-3xl">🏆</div><p className="text-xs font-extrabold text-[#7a8395]">Leaderboard appears once the race begins.</p></div>;
  return <div className="space-y-1">
    {rankings.map((id, index) => {
      const player = players[id];
      const color = TOKEN_COLORS[Math.max(0, Object.keys(players).sort().indexOf(id)) % TOKEN_COLORS.length];
      const position = boardPositions?.[id] || 0;
      const progress = Math.round((position / (TOTAL_TILES - 1)) * 100);
      const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1;
      return <div key={id} className={`rounded-xl px-2 py-2 ${index === 0 ? 'bg-[#fff3c4]' : ''}`}>
        <div className="flex items-center gap-2">
          <span className="w-6 text-center text-sm font-black text-[#18233f]">{rank}</span>
          {player?.avatar ? (
            <img src={player.avatar} alt={player.name} className="h-4 w-4 shrink-0 rounded-[4px] border-2 border-[#18233f] object-cover" />
          ) : (
            <span className="h-3.5 w-3.5 rounded-[5px] border-2 border-[#18233f]" style={{ backgroundColor: color }} />
          )}
          <span className="min-w-0 flex-1 truncate text-xs font-black text-[#18233f]">{player?.name || id}</span>
          <span className="text-[11px] font-extrabold text-[#7a8395]">{position + 1}/{TOTAL_TILES}</span>
        </div>
        <div className="ml-8 mt-1.5 h-1.5 overflow-hidden rounded bg-[#e7e2cf]"><span className="block h-full rounded" style={{ width: `${progress}%`, backgroundColor: color }} /></div>
      </div>;
    })}
  </div>;
}

function FinishPodium({ placementIds, players, boardPositions }) {
  const labels = ['Winner', '2nd Place', '3rd Place'];
  const medals = ['🏆', '🥈', '🥉'];
  const playerIds = Object.keys(players).sort();
  return <div className="space-y-2">
    {placementIds.map((id, index) => {
      const player = players[id];
      const color = TOKEN_COLORS[Math.max(0, playerIds.indexOf(id)) % TOKEN_COLORS.length];
      const position = (boardPositions?.[id] || 0) + 1;
      return <div key={id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${index === 0 ? 'bg-[#fff3c4]' : 'bg-[#f1ecd9]'}`}>
        <span className="text-2xl">{medals[index]}</span>
        {player?.avatar ? (
          <img src={player.avatar} alt={player.name} className="h-8 w-8 shrink-0 rounded-[8px] border-2 border-[#18233f] object-cover" />
        ) : (
          <span className="h-4 w-4 rounded-[5px] border-2 border-[#18233f]" style={{ backgroundColor: color }} />
        )}
        <div className="min-w-0 flex-1 text-left"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#ff8c4d]">{labels[index]}</p><p className="truncate font-display text-base text-[#18233f]">{player?.name || id}</p></div>
        <span className="text-xs font-extrabold text-[#7a8395]">Tile {position}</span>
      </div>;
    })}
  </div>;
}

export default function MultiplayerHost() {
  const { room, loading, error, session } = useRoom();
  const [resetBusy, setResetBusy] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [rapidCountdown, setRapidCountdown] = useState(5);
  const [orderCountdown, setOrderCountdown] = useState(5);
  const [miniCountdown, setMiniCountdown] = useState(12);
  const [advanceError, setAdvanceError] = useState(null);

  // These refs let effects below always call the *latest* handler (defined
  // further down, after the early returns) without needing to restart their
  // timers every render. All hooks in this component must be declared
  // unconditionally, above any early return — see the effects' internal
  // `if (!room) return` guards instead of skipping the hook itself.
  const advanceRapidRef = useRef(() => {});
  const beginBoardRef = useRef(() => {});
  const nextTurnRef = useRef(() => {});
  const resolveMinigameRef = useRef(() => {});
  const minigameResolvedRef = useRef(false);
  const handledRollRef = useRef(null);
  const autoAdvanceTimeoutRef = useRef(null);
  // Always holds the last *valid* room snapshot. Handlers read from this instead
  // of a captured closure so a transient null/error room can never freeze them.
  const roomRef = useRef(null);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  useEffect(() => {
    if (room?.phase !== 'rapid-shot') return undefined;
    setRapidCountdown(5);
    const tick = setInterval(() => setRapidCountdown((seconds) => Math.max(0, seconds - 1)), 1000);
    const advance = setTimeout(() => advanceRapidRef.current(), 5000);
    return () => { clearInterval(tick); clearTimeout(advance); };
  }, [room?.phase, room?.rapidShot?.questionIndex]);

  // Auto-advance from the starting-order reveal straight into the board —
  // host only had to click Start once, this reads the order out loud then
  // moves on by itself.
  useEffect(() => {
    if (room?.phase !== 'order-reveal') return undefined;
    setOrderCountdown(5);
    const tick = setInterval(() => setOrderCountdown((seconds) => Math.max(0, seconds - 1)), 1000);
    const advance = setTimeout(() => beginBoardRef.current(), 5000);
    return () => { clearInterval(tick); clearTimeout(advance); };
  }, [room?.phase]);

  // Mini-game round break: count down the chosen game's timeLimit, then
  // resolve the round into a new turn order. Resets the one-shot resolve
  // guard whenever a fresh mini-game question begins.
  useEffect(() => {
    if (room?.phase !== 'minigame') return undefined;
    minigameResolvedRef.current = false;
    const game = MINI_GAMES.find((item) => item.id === room.minigame?.type) || { timeLimit: 12 };
    setMiniCountdown(game.timeLimit);
    const tick = setInterval(() => setMiniCountdown((seconds) => Math.max(0, seconds - 1)), 1000);
    const advance = setTimeout(() => resolveMinigameRef.current(), game.timeLimit * 1000);
    return () => { clearInterval(tick); clearTimeout(advance); };
  }, [room?.phase, room?.minigame?.questionId]);

  // Resolve the moment every active player has submitted an answer, so the
  // round doesn't wait out the full timer when nobody's left to answer.
  // Gated behind MIN_MINIGAME_DISPLAY_MS so a lagging client that hasn't
  // finished receiving/rendering the question yet still gets a fair window
  // to see and answer before the round flips back to 'board'.
  useEffect(() => {
    if (room?.phase !== 'minigame') return undefined;
    const activeIds = Object.values(room.players || {}).filter((player) => player.connected !== false).map((player) => player.id);
    const submittedCount = activeIds.filter((id) => room.minigame?.submitted?.[id]).length;
    const elapsed = Date.now() - (room.minigame?.startedAt || Date.now());
    if (activeIds.length > 0 && submittedCount >= activeIds.length) {
      if (elapsed >= MIN_MINIGAME_DISPLAY_MS) {
        resolveMinigameRef.current();
      } else {
        const remaining = MIN_MINIGAME_DISPLAY_MS - elapsed;
        const timeout = setTimeout(() => resolveMinigameRef.current(), remaining);
        return () => clearTimeout(timeout);
      }
    }
    return undefined;
  }, [room?.phase, room?.minigame?.submitted, room?.minigame?.questionId, room?.players, room?.minigame?.startedAt]);

  // Auto-advance turns on the board once a roll (and any tile effect, e.g. a
  // challenge) has resolved, so the host never has to click "Next Player".
  // Keyed off the resolved roll so it only fires once per turn, even across
  // a detour through the challenge phase and back.
  //
  // IMPORTANT: this effect must NOT clear the pending timeout on cleanup. A
  // transient onSnapshot flicker to a null/error room makes `room?.phase`
  // briefly undefined, which would otherwise cancel the scheduled nextTurn
  // and — because handledRollRef is already set — never reschedule it. That
  // silently stalls the lap and is exactly what made the minigame stop
  // appearing after round 2+. So we clear only when a *new* roll supersedes
  // it, never on transient re-renders.
  useEffect(() => {
    if (room?.phase !== 'board' || room?.rolling || !room?.lastRoll) return undefined;
    const key = `${room.round}-${room.activePlayerIndex}-${room.lastRoll.finalPosition ?? room.lastRoll.landedPosition}`;
    if (handledRollRef.current === key) return undefined;
    handledRollRef.current = key;
    if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
    autoAdvanceTimeoutRef.current = setTimeout(() => { autoAdvanceTimeoutRef.current = null; nextTurnRef.current(); }, 2200);
    return undefined;
  }, [room?.phase, room?.rolling, room?.lastRoll, room?.round, room?.activePlayerIndex]);

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#0e1a3a] text-white">Loading game…</div>;
  if (error || !room) return <div className="grid min-h-screen place-items-center bg-[#0e1a3a] text-red-300">Game unavailable. Ask a player to log in first.</div>;
  if (session?.role !== 'host') return <div className="grid min-h-screen place-items-center bg-[#0e1a3a] text-red-300">Host login required.</div>;
  if (room.phase === 'finished') return <Navigate to="/podium" replace />;

  const players = room.players || {};
  const sortedPlayers = Object.values(players).sort((a, b) => a.id.localeCompare(b.id));
  const playerSlots = PLAYER_ACCOUNTS.map((account) => players[account.playerId] || {
    id: account.playerId,
    name: account.name,
    avatar: account.avatar,
    connected: false,
  });
  const activePlayers = sortedPlayers.filter((player) => player.connected !== false);
  const activeId = getActivePlayerId(room);
  const rankings = getRankings(room, players);
  const finishPlacements = room.winner
    ? [room.winner, ...rankings.filter((id) => id !== room.winner)].slice(0, 3)
    : rankings.slice(0, 3);
  const activeChallenge = challengeContent.questions.find((question) => question.id === room?.challenge?.questionId);
  const hasStarted = !['lobby', 'rapid-shot', 'order-reveal'].includes(room.phase);
  const update = (updates) => updateRoom('current', updates);

  // Wraps a Firestore write so a transient failure (network blip, etc.) can't
  // silently drop a phase transition. Logs loudly and surfaces a visible
  // "retrying" banner to the host, then retries once before giving up (at
  // which point the host can use Force Next Turn).
  const safeUpdate = async (label, performWrite, retries = 1) => {
    try {
      await performWrite();
      setAdvanceError(null);
    } catch (writeError) {
      console.error(`[host] ${label} write failed:`, writeError);
      if (retries > 0) {
        setAdvanceError(`${label} failed — retrying…`);
        setTimeout(() => { setAdvanceError(null); safeUpdate(label, performWrite, retries - 1); }, 1500);
      } else {
        setAdvanceError(`${label} failed — use Force Next Turn if stuck.`);
      }
    }
  };

  const startRapid = () => {
    const active = activePlayers.length > 0 ? activePlayers : sortedPlayers;
    if (!active.length) return;
    update({
      phase: 'rapid-shot',
      round: 1,
      turnOrder: [],
      activePlayerIndex: 0,
      challengeBag: [],
      minigameBag: [],
      boardPositions: Object.fromEntries(active.map((player) => [player.id, 0])),
      playerCheckpoints: Object.fromEntries(active.map((player) => [player.id, 0])),
      winner: null,
      rapidShot: {
        questionIndex: 0,
        answers: {},
        scores: Object.fromEntries(active.map((player) => [player.id, 0])),
        submitted: {},
      },
    });
  };
  const advanceRapid = async () => {
    const questionIndex = room.rapidShot?.questionIndex || 0;
    if (questionIndex < RAPID_QUESTIONS.length - 1) return update({ 'rapidShot.questionIndex': questionIndex + 1, 'rapidShot.answers': {}, 'rapidShot.submitted': {} });
    const activeMap = Object.fromEntries(activePlayers.map((p) => [p.id, p]));
    return update({ phase: 'order-reveal', turnOrder: resolveRapidShotOrder(activeMap, room.rapidShot?.scores || {}), activePlayerIndex: 0, round: 1 });
  };
  const beginBoard = () => update({ phase: 'board', round: room.round || 1, activePlayerIndex: 0, lastRoll: null, rolling: null });
  const nextTurn = () => {
    const g = roomRef.current;
    if (!g || g.winner || !g.turnOrder?.length) return;
    const players = g.players || {};
    const order = g.turnOrder;
    const total = order.length;
    const currentIndex = Math.min(total - 1, Math.max(0, g.activePlayerIndex ?? 0));
    // Walk forward (wrapping) to the next *connected* player so a disconnected
    // team is skipped rather than breaking advancement. The previous version
    // filtered the order by `connected` then looked up the active player in
    // that filtered list — when the active player was disconnected, indexOf
    // returned -1 and the game wrongly dropped into the end-of-round minigame
    // (resetting activePlayerIndex to 0), which bounced every turn back to team
    // 1 and froze turns 2–6.
    let nextIndex = -1;
    for (let step = 1; step <= total; step += 1) {
      const candidate = (currentIndex + step) % total;
      if (players[order[candidate]]?.connected !== false) { nextIndex = candidate; break; }
    }
    if (nextIndex === -1) nextIndex = currentIndex; // no other connected player
    if (nextIndex <= currentIndex) {
      console.log(`[host] nextTurn → entering 'minigame' (round ${g.round || 1}, previous type: ${g.minigame?.type || 'none'})`);
      const options = MINI_GAMES.filter((game) => game.id !== g.minigame?.type);
      const game = (options.length ? options : MINI_GAMES)[Math.floor(Math.random() * (options.length ? options.length : MINI_GAMES.length))];
      const { id: minigameQuestionId, bag: minigameBag } = pickMinigameQuestion(g.minigameBag, g.minigame?.questionId);
      return safeUpdate('Start mini-game', () => update({
        phase: 'minigame',
        minigame: {
          type: game.id, label: game.label, description: game.description,
          questionId: minigameQuestionId, answers: {}, submitted: {},
          startedAt: Date.now(),
        },
        minigameBag,
      }));
    }
    console.log(`[host] nextTurn → advancing to player index ${nextIndex} (round ${g.round || 1})`);
    return safeUpdate('Advance turn', () => update({ activePlayerIndex: nextIndex, lastRoll: null }));
  };
  const resolveMinigame = async () => {
    if (minigameResolvedRef.current) { console.log('[host] resolveMinigame skipped — already resolved'); return; }
    const g = roomRef.current;
    if (!g || g.phase !== 'minigame') { console.log('[host] resolveMinigame skipped — not in minigame'); return; }
    const question = MINIGAME_QUESTIONS.find((item) => item.id === g.minigame?.questionId);
    minigameResolvedRef.current = true;
    const activePlayers = Object.values(g.players || {}).filter((player) => player.connected !== false);
    const ranking = [...activePlayers.map((player) => player.id)].sort((a, b) => {
      const aCorrect = g.minigame?.answers?.[a]?.choiceIndex === question?.answerIndex;
      const bCorrect = g.minigame?.answers?.[b]?.choiceIndex === question?.answerIndex;
      if (aCorrect !== bCorrect) return aCorrect ? -1 : 1;
      const aTime = g.minigame?.answers?.[a]?.answeredAt ?? Infinity;
      const bTime = g.minigame?.answers?.[b]?.answeredAt ?? Infinity;
      return aTime - bTime;
    });
    const results = Object.fromEntries(ranking.map((id, index) => [id, index + 1]));
    console.log(`[host] resolveMinigame → leaving 'minigame', round ${(g.round || 1) + 1}, new turnOrder:`, ranking);
    await safeUpdate('Resolve mini-game', () => update({ phase: 'board', round: (g.round || 1) + 1, turnOrder: ranking, activePlayerIndex: 0, lastRoll: null, rolling: null, minigame: { ...g.minigame, results } }));
  };
  const reset = async () => {
    if (!window.confirm('Reset the entire game and return everyone to the login lobby?')) return;
    setResetBusy(true);
    try { await resetGame(); } finally { setResetBusy(false); }
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (fullscreenError) {
      console.error('Fullscreen mode is unavailable.', fullscreenError);
    }
  };

  // Keep the refs pointed at this render's freshest closures (see hook
  // declarations above) — plain assignments, not hook calls, so it's safe
  // for this to happen after the early returns. Also stash the last valid
  // room so nextTurn/resolveMinigame never operate on a stale snapshot.
  roomRef.current = room;
  advanceRapidRef.current = advanceRapid;
  beginBoardRef.current = beginBoard;
  nextTurnRef.current = nextTurn;
  resolveMinigameRef.current = resolveMinigame;

  // Manual safety-net for the host (per AGENTS.md: host can force-advance if
  // a player is stuck/disconnected). Cancels any pending auto-advance first
  // so a turn never gets skipped by both firing.
  const forceNextTurn = () => {
    if (autoAdvanceTimeoutRef.current) { clearTimeout(autoAdvanceTimeoutRef.current); autoAdvanceTimeoutRef.current = null; }
    nextTurn();
  };

  return <div className="h-screen overflow-y-auto bg-[#0e1a3a] px-5 py-7 text-white md:px-7 md:pb-10">
    <header className="mx-auto mb-5 flex max-w-[1520px] flex-wrap items-start justify-between gap-4">
      <div><p className="mb-1 text-[11px] font-black uppercase tracking-[.22em] text-[#ff8c4d]">{ACTIVE_META.title}</p><h1 className="font-display text-4xl md:text-[38px]">Projected Host / Spectator</h1><p className="mt-1.5 text-[13px] font-bold text-[#aab2d4]">Single lobby · Host account: {session.username}</p></div>
      <div className="flex items-center gap-2.5"><PhaseBadge phase={room.phase} round={room.round} /><button onClick={toggleFullscreen} className="rounded-xl border-2 border-white/15 bg-[#132352] px-4 py-3 font-display text-[13px] text-white">{isFullscreen ? 'Exit Fullscreen' : 'Present Fullscreen'}</button><button onClick={reset} disabled={resetBusy} className="rounded-xl bg-[#ff8c4d] px-5 py-3 font-display text-[13px] text-[#18233f] shadow-[0_4px_0_rgba(0,0,0,.25)] disabled:opacity-50">{resetBusy ? 'Resetting…' : 'Reset Game'}</button></div>
    </header>

    <main className="mx-auto grid max-w-[1520px] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section><Board boardPositions={room.boardPositions} players={players} /></section>
        <aside>
          {advanceError && <div className="mb-4 rounded-2xl border-2 border-[#ff8c4d] bg-[#fff3c4] px-4 py-3 text-sm font-black text-[#18233f]">{advanceError}</div>}
        {room.phase === 'board' && <section className="mb-4 rounded-[20px] bg-[#fff8e7] p-[18px] text-[#18233f]"><h2 className="mb-3 font-display text-base">This Turn</h2><div className="flex items-center gap-3"><Dice rolling={Boolean(room.rolling?.playerId)} value={room.lastRoll?.value || 1} /><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#ff8c4d]">{room.rolling?.playerId ? 'Rolling now' : 'Up next'}</p><p className="text-base font-black">{players[activeId]?.name || '—'}</p><p className="text-xs font-extrabold text-[#7a8395]">{room.lastRoll?.value ? `Rolled ${room.lastRoll.value}` : ''}</p></div></div></section>}

        <section className="mb-4 rounded-[20px] bg-[#fff8e7] p-[18px] text-[#18233f]"><div className="mb-2 flex items-center justify-between"><h2 className="font-display text-base">Players</h2><span className="text-[13px] font-black text-[#ff8c4d]">{activePlayers.length}/6</span></div>{playerSlots.map((player, index) => <PlayerRow key={player.id} player={player} index={index} started={hasStarted} position={room.boardPositions?.[player.id]} />)}</section>

        <section className="mb-4 rounded-[20px] bg-[#fff8e7] p-[18px] text-[#18233f]"><h2 className="mb-2 font-display text-base">Leaderboard</h2><Leaderboard rankings={hasStarted ? rankings : []} players={players} boardPositions={room.boardPositions} /></section>

        <section className="rounded-[20px] bg-[#fff8e7] p-[18px] text-[#18233f]">
          {room.phase === 'lobby' && <><p className="mb-3 text-center text-[11.5px] font-extrabold text-[#7a8395]">{activePlayers.length === 0 ? 'Waiting for player accounts to log in.' : `${activePlayers.length} player${activePlayers.length > 1 ? 's' : ''} connected.`}</p><button disabled={activePlayers.length === 0} onClick={startRapid} className="w-full rounded-xl bg-[#45f27b] px-4 py-3 font-display text-[13px] shadow-[0_4px_0_rgba(0,0,0,.18)] disabled:bg-[#e4dfc9] disabled:text-[#a39c85] disabled:shadow-none">Start 3 Rapid Shots {activePlayers.length > 0 ? `(${activePlayers.length} Player${activePlayers.length > 1 ? 's' : ''})` : ''}</button></>}
          {room.phase === 'rapid-shot' && <><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#ff8c4d]">Rapid Shot {(room.rapidShot?.questionIndex || 0) + 1}/3</p><h2 className="my-2 font-display text-lg">{RAPID_QUESTIONS[room.rapidShot?.questionIndex || 0]?.text}</h2><div className="my-3 grid grid-cols-2 gap-2">{RAPID_QUESTIONS[room.rapidShot?.questionIndex || 0]?.choices?.map((choice, index) => <div key={choice} className="rounded-xl border-2 border-[#18233f]/10 bg-[#f8f5eb] p-2 text-xs font-bold"><span className="mr-1 font-black text-[#ff8c4d]">{['A', 'B', 'C', 'D'][index]}.</span>{choice}</div>)}</div><p className="mb-3 text-xs font-extrabold text-[#7a8395]">Submitted {Object.keys(room.rapidShot?.submitted || {}).length}/{activePlayers.length}</p><button onClick={advanceRapid} className="w-full rounded-xl bg-[#4d79ff] px-4 py-3 font-display text-[13px] text-white shadow-[0_4px_0_rgba(0,0,0,.18)]">{room.rapidShot?.questionIndex === 2 ? 'Calculate Starting Order' : 'Next Question'} · {rapidCountdown}s</button></>}
          {room.phase === 'order-reveal' && <><h2 className="mb-3 font-display text-lg">Starting Order</h2>{room.turnOrder.map((id, index) => <div key={id} className="flex justify-between border-b border-[#18233f]/10 py-2 text-sm font-bold"><span>#{index + 1} {players[id]?.name}</span><span>{room.rapidShot?.scores?.[id] || 0}</span></div>)}<button onClick={beginBoard} className="mt-4 w-full rounded-xl bg-[#45f27b] px-4 py-3 font-display text-[13px] shadow-[0_4px_0_rgba(0,0,0,.18)]">Start Board Now · {orderCountdown}s</button></>}
          {room.phase === 'board' && <><p className="mb-3 text-center text-[11.5px] font-extrabold text-[#7a8395]">{room.rolling?.playerId ? `${players[room.rolling.playerId]?.name || 'Player'} is rolling…` : room.lastRoll ? 'Advancing to the next player…' : `Waiting for ${players[activeId]?.name || 'the active player'} to roll.`}</p><button onClick={forceNextTurn} disabled={!activeId} className="w-full rounded-xl border-2 border-[#18233f]/15 bg-transparent px-4 py-2.5 font-display text-[12px] text-[#7a8395] disabled:opacity-40">Force Next Turn ⏭</button></>}
          {room.phase === 'challenge' && <div className="text-center"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#4d79ff]">Challenge Tile</p><h2 className="mt-2 font-display text-xl">{players[room.challenge?.teamId]?.name}</h2><p className="mt-3 text-sm font-bold text-[#7a8395]">{activeChallenge?.prompt}</p><p className="mt-4 text-xs font-black text-[#ff8c4d]">They answer on their device · Correct +{challengeContent.winTiles}, wrong −{challengeContent.loseTiles} to checkpoint</p></div>}
          {room.phase === 'minigame' && (() => {
            const question = MINIGAME_QUESTIONS.find((item) => item.id === room.minigame?.questionId);
            const answered = activePlayers.filter((player) => room.minigame?.submitted?.[player.id]).length;
            return <><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#ff8c4d]">Round Break · {room.minigame?.label}</p><h2 className="my-2 font-display text-lg">{question?.text}</h2><div className="my-3 grid grid-cols-2 gap-2">{question?.choices?.map((choice, index) => <div key={choice} className="rounded-xl border-2 border-[#18233f]/10 bg-[#f8f5eb] p-2 text-xs font-bold"><span className="mr-1 font-black text-[#ff8c4d]">{['A', 'B', 'C', 'D'][index]}.</span>{choice}</div>)}</div><p className="mb-3 text-xs font-extrabold text-[#7a8395]">Answered {answered}/{activePlayers.length}</p><button onClick={resolveMinigameRef.current} className="w-full rounded-xl bg-[#4d79ff] px-4 py-3 font-display text-[13px] text-white shadow-[0_4px_0_rgba(0,0,0,.18)]">Resolve Now · {miniCountdown}s</button></>;
          })()}
          {room.phase === 'finished' && <div className="text-center"><div className="mb-1 text-5xl">🏆</div><h2 className="mb-3 font-display text-2xl text-[#ff5555]">Final Results</h2><FinishPodium placementIds={finishPlacements} players={players} boardPositions={room.boardPositions} /><p className="mt-3 text-xs font-bold text-[#7a8395]">Places two and three are ranked by their current tile position.</p></div>}
        </section>
      </aside>
    </main>
  </div>;
}
