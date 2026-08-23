import { useEffect, useState } from 'react';
import Board from '../components/MultiplayerBoard.jsx';
import Dice from '../components/Dice.jsx';
import { useRoom } from '../hooks/useRoom.js';
import { getActivePlayerId, getRankings, resolveRapidShotOrder, RAPID_QUESTIONS } from '../services/gameLogic.js';
import { resetGame, rollForActivePlayer, updateRoom } from '../services/roomService.js';
import { TOKEN_COLORS, ACTIVE_META, MINI_GAMES } from '../data/constants.js';
import { PLAYER_ACCOUNTS } from '../data/loginAccounts.js';
import challengeContent from '../content/maulid-nabi/challenge.json';
import boardTiles from '../data/boardTiles.json';

const TOTAL_TILES = boardTiles.length;

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
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border-[2.5px] border-[#18233f] text-xs font-black text-white" style={{ backgroundColor: color }}>#{index + 1}</div>
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
          <span className="h-3.5 w-3.5 rounded-[5px] border-2 border-[#18233f]" style={{ backgroundColor: color }} />
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
        <span className="h-4 w-4 rounded-[5px] border-2 border-[#18233f]" style={{ backgroundColor: color }} />
        <div className="min-w-0 flex-1 text-left"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#ff8c4d]">{labels[index]}</p><p className="truncate font-display text-base text-[#18233f]">{player?.name || id}</p></div>
        <span className="text-xs font-extrabold text-[#7a8395]">Tile {position}</span>
      </div>;
    })}
  </div>;
}

export default function MultiplayerHost() {
  const { room, loading, error, session } = useRoom();
  const [rollBusy, setRollBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#0e1a3a] text-white">Loading game…</div>;
  if (error || !room) return <div className="grid min-h-screen place-items-center bg-[#0e1a3a] text-red-300">Game unavailable. Ask a player to log in first.</div>;
  if (session?.role !== 'host') return <div className="grid min-h-screen place-items-center bg-[#0e1a3a] text-red-300">Host login required.</div>;

  const players = room.players || {};
  const sortedPlayers = Object.values(players).sort((a, b) => a.id.localeCompare(b.id));
  const playerSlots = PLAYER_ACCOUNTS.map((account) => players[account.playerId] || {
    id: account.playerId,
    name: account.name,
    connected: false,
  });
  const activePlayers = sortedPlayers.filter((player) => player.connected !== false);
  const activeId = getActivePlayerId(room);
  const rankings = getRankings(room, players);
  const finishPlacements = room.winner
    ? [room.winner, ...rankings.filter((id) => id !== room.winner)].slice(0, 3)
    : rankings.slice(0, 3);
  const activeChallenge = challengeContent.questions.find((question) => question.id === room.challenge?.questionId);
  const hasStarted = !['lobby', 'rapid-shot', 'order-reveal'].includes(room.phase);
  const update = (updates) => updateRoom('current', updates);

  const startRapid = () => {
    const active = activePlayers.length > 0 ? activePlayers : sortedPlayers;
    if (!active.length) return;
    update({
      phase: 'rapid-shot',
      round: 1,
      turnOrder: [],
      activePlayerIndex: 0,
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
  const beginBoard = () => update({ phase: 'board', round: room.round || 1, activePlayerIndex: 0, lastRoll: null });
  const roll = async (value) => {
    if (rollBusy || room.phase !== 'board' || !activeId || players[activeId]?.connected === false) return;
    setRollBusy(true);
    try { await rollForActivePlayer(activeId, value); } finally { setTimeout(() => setRollBusy(false), 350); }
  };
  const nextTurn = () => {
    if (room.winner || !room.turnOrder?.length) return;
    const order = room.turnOrder.filter((id) => players[id]?.connected !== false);
    const current = order.indexOf(activeId);
    if (current < 0 || current >= order.length - 1) {
      const options = MINI_GAMES.filter((game) => game.id !== room.minigame?.type);
      const game = (options.length ? options : MINI_GAMES)[Math.floor(Math.random() * (options.length ? options.length : MINI_GAMES.length))];
      return update({ phase: 'minigame', minigame: { type: game.id, label: game.label, description: game.description, results: {}, startedAt: Date.now() } });
    }
    return update({ activePlayerIndex: room.turnOrder.indexOf(order[current + 1]), lastRoll: null });
  };
  const recordResult = async (id) => {
    const results = { ...(room.minigame?.results || {}) };
    if (results[id]) return;
    results[id] = Object.keys(results).length + 1;
    if (Object.keys(results).length >= activePlayers.length) {
      const turnOrder = Object.entries(results).sort((a, b) => a[1] - b[1]).map(([playerId]) => playerId);
      await update({ phase: 'board', round: (room.round || 1) + 1, turnOrder, activePlayerIndex: 0, lastRoll: null, minigame: { ...room.minigame, results } });
    } else await update({ 'minigame.results': results });
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

  return <div className="min-h-screen bg-[#0e1a3a] px-5 py-7 text-white md:px-7 md:pb-10">
    <header className="mx-auto mb-5 flex max-w-[1520px] flex-wrap items-start justify-between gap-4">
      <div><p className="mb-1 text-[11px] font-black uppercase tracking-[.22em] text-[#ff8c4d]">{ACTIVE_META.title}</p><h1 className="font-display text-4xl md:text-[38px]">Projected Host / Spectator</h1><p className="mt-1.5 text-[13px] font-bold text-[#aab2d4]">Single lobby · Host account: {session.username}</p></div>
      <div className="flex items-center gap-2.5"><PhaseBadge phase={room.phase} round={room.round} /><button onClick={toggleFullscreen} className="rounded-xl border-2 border-white/15 bg-[#132352] px-4 py-3 font-display text-[13px] text-white">{isFullscreen ? 'Exit Fullscreen' : 'Present Fullscreen'}</button><button onClick={reset} disabled={resetBusy} className="rounded-xl bg-[#ff8c4d] px-5 py-3 font-display text-[13px] text-[#18233f] shadow-[0_4px_0_rgba(0,0,0,.25)] disabled:opacity-50">{resetBusy ? 'Resetting…' : 'Reset Game'}</button></div>
    </header>

    <main className="mx-auto grid max-w-[1520px] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section><Board boardPositions={room.boardPositions} players={players} /></section>
      <aside>
        {room.phase === 'board' && <section className="mb-4 rounded-[20px] bg-[#fff8e7] p-[18px] text-[#18233f]"><h2 className="mb-3 font-display text-base">This Turn</h2><div className="flex items-center gap-3"><div className="grid h-[52px] w-[52px] place-items-center rounded-[14px] border-[3px] border-[#18233f] bg-white text-2xl font-black">{room.lastRoll?.value || '🎲'}</div><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#ff8c4d]">Rolling now</p><p className="text-base font-black">{players[activeId]?.name || '—'}</p></div></div></section>}

        <section className="mb-4 rounded-[20px] bg-[#fff8e7] p-[18px] text-[#18233f]"><div className="mb-2 flex items-center justify-between"><h2 className="font-display text-base">Players</h2><span className="text-[13px] font-black text-[#ff8c4d]">{activePlayers.length}/7</span></div>{playerSlots.map((player, index) => <PlayerRow key={player.id} player={player} index={index} started={hasStarted} position={room.boardPositions?.[player.id]} />)}</section>

        <section className="mb-4 rounded-[20px] bg-[#fff8e7] p-[18px] text-[#18233f]"><h2 className="mb-2 font-display text-base">Leaderboard</h2><Leaderboard rankings={hasStarted ? rankings : []} players={players} boardPositions={room.boardPositions} /></section>

        <section className="rounded-[20px] bg-[#fff8e7] p-[18px] text-[#18233f]">
          {room.phase === 'lobby' && <><p className="mb-3 text-center text-[11.5px] font-extrabold text-[#7a8395]">{activePlayers.length === 0 ? 'Waiting for player accounts to log in.' : `${activePlayers.length} player${activePlayers.length > 1 ? 's' : ''} connected.`}</p><button disabled={activePlayers.length === 0} onClick={startRapid} className="w-full rounded-xl bg-[#45f27b] px-4 py-3 font-display text-[13px] shadow-[0_4px_0_rgba(0,0,0,.18)] disabled:bg-[#e4dfc9] disabled:text-[#a39c85] disabled:shadow-none">Start 3 Rapid Shots {activePlayers.length > 0 ? `(${activePlayers.length} Player${activePlayers.length > 1 ? 's' : ''})` : ''}</button></>}
          {room.phase === 'rapid-shot' && <><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#ff8c4d]">Rapid Shot {(room.rapidShot?.questionIndex || 0) + 1}/3</p><h2 className="my-2 font-display text-lg">{RAPID_QUESTIONS[room.rapidShot?.questionIndex || 0]?.text}</h2><p className="mb-3 text-xs font-extrabold text-[#7a8395]">Submitted {Object.keys(room.rapidShot?.submitted || {}).length}/{activePlayers.length}</p><button onClick={advanceRapid} className="w-full rounded-xl bg-[#4d79ff] px-4 py-3 font-display text-[13px] text-white shadow-[0_4px_0_rgba(0,0,0,.18)]">{room.rapidShot?.questionIndex === 2 ? 'Calculate Starting Order' : 'Next Question'}</button></>}
          {room.phase === 'order-reveal' && <><h2 className="mb-3 font-display text-lg">Starting Order</h2>{room.turnOrder.map((id, index) => <div key={id} className="flex justify-between border-b border-[#18233f]/10 py-2 text-sm font-bold"><span>#{index + 1} {players[id]?.name}</span><span>{room.rapidShot?.scores?.[id] || 0}</span></div>)}<button onClick={beginBoard} className="mt-4 w-full rounded-xl bg-[#45f27b] px-4 py-3 font-display text-[13px] shadow-[0_4px_0_rgba(0,0,0,.18)]">Start Board</button></>}
          {room.phase === 'board' && <><div className="mb-3 flex justify-center"><Dice onRoll={roll} /></div><button onClick={nextTurn} disabled={!room.lastRoll || rollBusy} className="w-full rounded-xl bg-[#45f27b] px-4 py-3 font-display text-[13px] shadow-[0_4px_0_rgba(0,0,0,.18)] disabled:opacity-40">Next Player →</button></>}
          {room.phase === 'challenge' && <div className="text-center"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#4d79ff]">Challenge Tile</p><h2 className="mt-2 font-display text-xl">{players[room.challenge?.teamId]?.name}</h2><p className="mt-3 text-sm font-bold text-[#7a8395]">{activeChallenge?.prompt}</p><p className="mt-4 text-xs font-black text-[#ff8c4d]">They answer on their device · Correct +{challengeContent.winTiles}, wrong −{challengeContent.loseTiles} to checkpoint</p></div>}
          {room.phase === 'minigame' && <><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#ff8c4d]">Random Mini-game</p><h2 className="mt-1 font-display text-lg">{room.minigame?.label}</h2><p className="my-2 text-xs font-bold text-[#7a8395]">{room.minigame?.description}</p>{activePlayers.map((player) => <button key={player.id} disabled={Boolean(room.minigame?.results?.[player.id])} onClick={() => recordResult(player.id)} className="mb-2 flex w-full justify-between rounded-xl bg-[#18233f] px-3 py-2.5 text-sm font-black text-white disabled:opacity-40"><span>{player.name}</span><span>{room.minigame?.results?.[player.id] || '—'}</span></button>)}</>}
          {room.phase === 'finished' && <div className="text-center"><div className="mb-1 text-5xl">🏆</div><h2 className="mb-3 font-display text-2xl text-[#ff5555]">Final Results</h2><FinishPodium placementIds={finishPlacements} players={players} boardPositions={room.boardPositions} /><p className="mt-3 text-xs font-bold text-[#7a8395]">Places two and three are ranked by their current tile position.</p></div>}
        </section>
      </aside>
    </main>
  </div>;
}
