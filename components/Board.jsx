import { useMemo, useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import boardTiles from '../data/boardTiles.json';

const VIEWBOX = { width: 1120, height: 650 };

// The route is game data, not artwork. The visual map below is HTML/CSS,
// so the board can be redesigned without editing a giant SVG illustration.
const PATH_POINTS = [
  { x: 105, y: 515 }, { x: 155, y: 455 }, { x: 190, y: 380 },
  { x: 175, y: 305 }, { x: 130, y: 235 }, { x: 145, y: 165 },
  { x: 230, y: 115 }, { x: 320, y: 105 }, { x: 395, y: 135 },
  { x: 450, y: 195 }, { x: 470, y: 275 }, { x: 455, y: 355 },
  { x: 420, y: 425 }, { x: 485, y: 475 }, { x: 575, y: 490 },
  { x: 670, y: 475 }, { x: 745, y: 430 }, { x: 790, y: 355 },
  { x: 775, y: 270 }, { x: 735, y: 195 }, { x: 670, y: 145 },
  { x: 750, y: 105 }, { x: 845, y: 120 }, { x: 915, y: 175 },
  { x: 935, y: 255 }, { x: 920, y: 340 }, { x: 945, y: 420 },
  { x: 1000, y: 485 }, { x: 1040, y: 540 },
];

function buildPath(points) {
  const segments = [];
  let totalLength = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    segments.push({ a, b, length, start: totalLength });
    totalLength += length;
  }
  return { segments, totalLength };
}

const BOARD_PATH = buildPath(PATH_POINTS);

function pointAtDistance(distance) {
  const d = Math.max(0, Math.min(distance, BOARD_PATH.totalLength));
  const segment = BOARD_PATH.segments.find(({ start, length }) => d <= start + length)
    || BOARD_PATH.segments.at(-1);
  const t = segment.length ? (d - segment.start) / segment.length : 0;
  return {
    x: segment.a.x + (segment.b.x - segment.a.x) * t,
    y: segment.a.y + (segment.b.y - segment.a.y) * t,
  };
}

function buildTilePositions(total) {
  if (total <= 1) return [pointAtDistance(0)];
  return Array.from({ length: total }, (_, i) => pointAtDistance(
    (i / (total - 1)) * BOARD_PATH.totalLength,
  ));
}

function segmentStyle(a, b, width, color, opacity = 1, zIndex = 1) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  return {
    left: `${a.x}px`,
    top: `${a.y - width / 2}px`,
    width: `${length + 2}px`,
    height: `${width}px`,
    background: color,
    opacity,
    zIndex,
    transform: `rotate(${angle}deg)`,
    transformOrigin: '0 50%',
  };
}

const TEAM_COLORS = ['#ff4d4d', '#4d79ff', '#36c96f', '#f4c842', '#a64dff', '#ff8c4d'];

const trees = [
  [70, 100, 1.15], [145, 80, .8], [365, 95, .95], [500, 75, 1.1],
  [620, 100, .9], [680, 430, 1.1], [805, 500, 1.05], [875, 95, .85],
  [1020, 145, 1.15], [1080, 360, .9], [80, 430, .85], [350, 520, 1], [900, 565, 1],
];

const bushes = [
  [520, 130, .8], [625, 235, 1], [710, 310, .8], [540, 545, 1], [1000, 250, .8], [160, 545, 1],
];

const rocks = [[450, 110, 1], [560, 190, .8], [730, 535, .8], [1010, 390, 1], [110, 350, .7]];

function Tree({ x, y, s = 1 }) {
  return (
    <div className="board-tree" style={{ left: `${x}px`, top: `${y}px`, transform: `scale(${s})` }} aria-hidden="true">
      <span className="tree-shadow" />
      <span className="tree-trunk" />
      <span className="tree-crown tree-crown-back" />
      <span className="tree-crown tree-crown-mid" />
      <span className="tree-crown tree-crown-front" />
      <span className="tree-highlight" />
    </div>
  );
}

function Bush({ x, y, s = 1 }) {
  return (
    <div className="board-bush" style={{ left: `${x}px`, top: `${y}px`, transform: `scale(${s})` }} aria-hidden="true">
      <span /><span /><span /><i />
    </div>
  );
}

function Rock({ x, y, s = 1 }) {
  return (
    <div className="board-rock" style={{ left: `${x}px`, top: `${y}px`, transform: `scale(${s})` }} aria-hidden="true">
      <span />
    </div>
  );
}

function Pawn({ color }) {
  return (
    <div className="pawn" style={{ '--pawn-color': color }} aria-hidden="true">
      <span className="pawn-head" />
      <span className="pawn-body" />
      <span className="pawn-shadow" />
    </div>
  );
}

export default function Board() {
  const [positions, setPositions] = useState({});
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const sceneRef = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'gameState', 'current'), (snap) => {
      if (snap.exists() && snap.data().boardPositions) {
        setPositions(snap.data().boardPositions);
      }
    });
    return unsub;
  }, []);

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((prev) => Math.min(Math.max(prev + delta, 0.65), 2.5));
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };

  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    setIsPanning(true);
    setPanStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
  };

  const handleTouchMove = (e) => {
    if (!isPanning || e.touches.length !== 1) return;
    e.preventDefault();
    const touch = e.touches[0];
    setPan({ x: touch.clientX - panStart.x, y: touch.clientY - panStart.y });
  };

  const tiles = useMemo(() => {
    const tilePositions = buildTilePositions(boardTiles.length);
    return boardTiles.map((tile, index) => ({ ...tile, ...tilePositions[index] }));
  }, []);

  const trailSegments = useMemo(() => PATH_POINTS.slice(0, -1).map((point, i) => ({
    a: point,
    b: PATH_POINTS[i + 1],
  })), []);

  return (
    <>
      <style>{`
        .board-tree,.board-bush,.board-rock,.board-tile,.pawn,.board-stream,.board-trail,.board-bridge,.board-flower{position:absolute;pointer-events:none}
        .board-tree{width:1px;height:1px;z-index:4}
        .tree-shadow{position:absolute;width:52px;height:15px;left:-26px;top:18px;border-radius:50%;background:rgba(53,92,38,.25);filter:blur(2px)}
        .tree-trunk{position:absolute;width:10px;height:34px;left:-5px;top:-8px;border-radius:4px;background:linear-gradient(90deg,#684323,#a36a37,#684323);z-index:0}
        .tree-crown{position:absolute;border-radius:50%;box-shadow:inset -5px -7px 0 rgba(20,70,35,.12)}
        .tree-crown-back{width:48px;height:48px;left:-24px;top:-58px;background:#2d713d}
        .tree-crown-mid{width:38px;height:38px;left:-29px;top:-40px;background:#4d8c43}
        .tree-crown-front{width:35px;height:35px;left:-6px;top:-42px;background:#66a74e}
        .tree-highlight{position:absolute;width:9px;height:9px;border-radius:50%;left:-5px;top:-51px;background:#9ac96a;opacity:.8}
        .board-bush{width:60px;height:28px;z-index:4}
        .board-bush span{position:absolute;border-radius:50%;background:#4f8e42;box-shadow:inset -4px -4px 0 rgba(27,80,35,.15)}
        .board-bush span:nth-child(1){width:28px;height:28px;left:0;top:2px}.board-bush span:nth-child(2){width:36px;height:36px;left:16px;top:-9px;background:#68a74e}.board-bush span:nth-child(3){width:28px;height:28px;right:0;top:3px;background:#3f7c3a}.board-bush i{position:absolute;width:8px;height:8px;border-radius:50%;left:27px;top:-2px;background:#a0ca69}
        .board-rock{width:44px;height:28px;z-index:4}.board-rock:after{content:"";position:absolute;left:0;right:0;bottom:1px;height:9px;border-radius:50%;background:rgba(58,91,53,.22);filter:blur(2px)}.board-rock span{position:absolute;inset:2px 3px 5px;border-radius:48% 45% 38% 50%;background:linear-gradient(145deg,#b7c0b3,#77877a);box-shadow:inset 7px 5px 0 rgba(255,255,255,.25),inset -7px -5px 0 rgba(60,75,65,.18)}
        .board-trail{border-radius:999px;box-shadow:0 3px 0 rgba(101,70,36,.25);pointer-events:none}
        .board-tile{width:58px;height:58px;transform:translate(-29px,-29px);border-radius:50%;display:grid;place-items:center;font-weight:1000;font-size:18px;font-family:ui-sans-serif,system-ui,sans-serif;box-shadow:0 7px 0 rgba(86,60,32,.24),0 10px 18px rgba(48,60,30,.2);border:4px solid #a17c43;z-index:10;transition:transform .18s ease,filter .18s ease}
        .board-tile:after{content:"";position:absolute;inset:5px;border-radius:50%;border:2px solid rgba(255,255,255,.35)}
        .board-tile.start{background:linear-gradient(145deg,#82f49a,#45c968);border-color:#277b3c;color:white}.board-tile.finish{background:linear-gradient(145deg,#ff8076,#e84d4d);border-color:#a62d2a;color:white}
        .board-tile.special{background:linear-gradient(145deg,#fff5d2,#efd38e)}
        .pawn{width:48px;height:62px;z-index:20;transform:translate(-24px,-55px);filter:drop-shadow(0 7px 4px rgba(35,45,30,.28));animation:pawn-bob 1.8s ease-in-out infinite}
        .pawn-head{position:absolute;width:19px;height:19px;left:14px;top:0;border-radius:50%;background:var(--pawn-color);border:3px solid white;z-index:3}.pawn-body{position:absolute;left:9px;top:16px;width:30px;height:32px;background:var(--pawn-color);border:3px solid white;border-radius:13px 13px 8px 8px;clip-path:polygon(50% 0,100% 34%,78% 100%,22% 100%,0 34%)}.pawn-shadow{position:absolute;left:4px;bottom:3px;width:40px;height:9px;border-radius:50%;background:rgba(35,50,25,.25)}
        .board-bridge{width:82px;height:38px;left:429px;top:419px;z-index:7;transform:rotate(13deg);border-radius:6px;background:repeating-linear-gradient(90deg,#a96b34 0 9px,#70421f 9px 14px);border:3px solid #54331c;box-shadow:0 4px 0 rgba(62,39,23,.25)}
        .board-flower{width:10px;height:20px;z-index:5}.board-flower:before{content:"✿";font-size:18px;color:#f7f0dc;text-shadow:0 0 0 #fff}.board-flower:after{content:"";position:absolute;width:4px;height:8px;left:4px;top:15px;background:#4b8c3f;border-radius:3px}
        @keyframes pawn-bob{0%,100%{margin-top:0}50%{margin-top:-4px}}
        @media (max-width:900px){.board-tile{width:52px;height:52px;transform:translate(-26px,-26px);font-size:16px}.pawn{transform:translate(-21px,-50px) scale(.9)}}
      `}</style>

      <div
        className="relative w-full h-full min-h-[100vh] min-w-[100vw] overflow-hidden bg-[#79ad43]"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setIsPanning(false)}
        onMouseLeave={() => setIsPanning(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => setIsPanning(false)}
        style={{ cursor: isPanning ? 'grabbing' : 'grab', touchAction: 'none' }}
      >
        <div className="absolute inset-0 grid place-items-center overflow-hidden">
          <div
            ref={sceneRef}
            className="relative h-[650px] w-[1120px] shrink-0 overflow-hidden rounded-[34px] border-[10px] border-[#355a32] shadow-[0_24px_70px_rgba(20,45,20,.35)]"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              background: `radial-gradient(circle at 18% 25%, rgba(231,239,157,.42) 0 9%, transparent 10%), radial-gradient(circle at 75% 75%, rgba(95,151,59,.28) 0 13%, transparent 14%), radial-gradient(circle at 58% 25%, rgba(216,231,132,.32) 0 8%, transparent 9%), linear-gradient(135deg,#b7d568 0%,#8fbe4d 48%,#74a943 100%)`,
            }}
          >
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(#4e8c3d 1px, transparent 1px)', backgroundSize: '26px 26px' }} />

            {/* Water feature */}
            <div className="absolute left-[180px] top-[190px] z-[2] h-[225px] w-[245px] rotate-[-8deg] rounded-[48%] border-[7px] border-[#3b7e8c] bg-[radial-gradient(circle_at_35%_30%,#73d7df,#3fa9c0_55%,#237f94)] shadow-inner">
              <span className="absolute left-[48px] top-[45px] h-2 w-20 rotate-[-8deg] rounded-full bg-[#b9eef0]/70" />
              <span className="absolute left-[74px] top-[112px] h-2 w-14 rotate-[8deg] rounded-full bg-[#b9eef0]/55" />
              <span className="absolute right-[36px] top-[74px] h-2 w-12 rounded-full bg-[#b9eef0]/60" />
            </div>

            {/* Stream */}
            {[[420,175,450,260],[435,250,430,350],[430,340,520,460],[505,445,600,470]].map(([x1,y1,x2,y2],i)=>(
              <div key={`stream-${i}`} className="absolute rounded-full bg-[#3199b1] opacity-85" style={segmentStyle({x:x1,y:y1},{x:x2,y:y2},34,'#3199b1',.85,2)} />
            ))}
            {[[420,175,450,260],[435,250,430,350],[430,340,520,460],[505,445,600,470]].map(([x1,y1,x2,y2],i)=>(
              <div key={`stream-hi-${i}`} className="absolute rounded-full" style={segmentStyle({x:x1,y:y1},{x:x2,y:y2},22,'#5fc7d3',.95,3)} />
            ))}

            {/* Trail baked as CSS shapes instead of SVG */}
            {trailSegments.map(({a,b},i)=>(
              <div key={`trail-shadow-${i}`} className="board-trail" style={segmentStyle(a,b,39,'#76502f',.28,5)} />
            ))}
            {trailSegments.map(({a,b},i)=>(
              <div key={`trail-${i}`} className="board-trail" style={segmentStyle(a,b,29,'#d5ac64',1,6)} />
            ))}
            {trailSegments.map(({a,b},i)=>(
              <div key={`trail-highlight-${i}`} className="board-trail" style={segmentStyle(a,b,5,'#f5e3ad',.9,7)} />
            ))}

            {trees.map(([x,y,s]) => <Tree key={`tree-${x}-${y}`} x={x} y={y} s={s} />)}
            {bushes.map(([x,y,s]) => <Bush key={`bush-${x}-${y}`} x={x} y={y} s={s} />)}
            {rocks.map(([x,y,s]) => <Rock key={`rock-${x}-${y}`} x={x} y={y} s={s} />)}
            {[[105,150],[395,160],[585,115],[710,500],[870,385],[1030,330],[160,410],[560,365]].map(([x,y]) => <span key={`flower-${x}-${y}`} className="board-flower" style={{left:x,top:y}} />)}

            <div className="board-bridge" />

            <div className="absolute left-[28px] top-[514px] z-[9] -rotate-6 rounded-lg border-[3px] border-[#57351f] bg-[#8b5a31] px-4 py-2 text-[17px] font-black tracking-wide text-[#fff7d8] shadow-lg">START</div>
            <div className="absolute right-[18px] top-[529px] z-[9] rotate-6 rounded-lg border-[3px] border-[#57351f] bg-[#8b5a31] px-4 py-2 text-[17px] font-black tracking-wide text-[#fff7d8] shadow-lg">FINISH</div>

            {tiles.map((tile) => {
              const isStart = tile.type === 'start';
              const isFinish = tile.type === 'finish';
              return (
                <div
                  key={tile.index}
                  className={`board-tile ${isStart ? 'start' : ''} ${isFinish ? 'finish' : 'special'}`}
                  style={{ left: `${tile.x}px`, top: `${tile.y}px` }}
                  title={tile.type || 'board tile'}
                >
                  {tile.index + 1}
                </div>
              );
            })}

            {Object.entries(positions).map(([teamId, tileIndex], idx) => {
              const tile = tiles[tileIndex] || tiles[0];
              if (!tile) return null;
              return (
                <div key={teamId} className="pawn" style={{ left: `${tile.x}px`, top: `${tile.y}px`, '--pawn-color': TEAM_COLORS[idx % TEAM_COLORS.length] }}>
                  <Pawn color={TEAM_COLORS[idx % TEAM_COLORS.length]} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="absolute top-5 right-5 z-30 w-[280px] rounded-2xl border-4 border-[#22243a] bg-[#fffdf5]/95 p-5 shadow-2xl backdrop-blur-sm" onMouseDown={(e) => e.stopPropagation()}>
          <h2 className="mb-3 text-center text-2xl font-black text-[#22243a]">Lobby</h2>
          <p className="mb-4 text-center text-sm font-bold text-[#4f5064]">Teams joined: <span className="text-red-500">0</span> / 6</p>
          <div className="grid grid-cols-3 gap-2">
            {['One', 'Two', 'Three', 'Four', 'Five', 'Six'].map((team) => (
              <button key={team} className="rounded-xl border-4 border-[#22243a] bg-[#fffdf5] px-2 py-2 text-sm font-black text-[#22243a] hover:bg-[#f4e39d]">{team}</button>
            ))}
          </div>
          <button className="mt-5 w-full rounded-xl border-4 border-[#62a96e] bg-[#8ff0a1] py-3 text-base font-black text-[#285b32] shadow-sm hover:brightness-105">Start Game</button>
          <div className="mt-5 border-t-2 border-[#dedbd0] pt-4 text-xs font-bold text-[#55566b]">
            <div className="mb-3 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#7d4bd4] text-xl text-white">★</span><span><b className="block text-sm text-[#292a3e]">Bonus</b>Good events</span></div>
            <div className="mb-3 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#3e9fe8] text-xl text-white">ϟ</span><span><b className="block text-sm text-[#292a3e]">Event</b>Surprises!</span></div>
            <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#ef5752] text-xl text-white">☠</span><span><b className="block text-sm text-[#292a3e]">Challenge</b>Be careful!</span></div>
          </div>
        </div>

        <div className="absolute bottom-4 right-4 z-30 flex flex-col gap-2" onMouseDown={(e) => e.stopPropagation()}>
          <button onClick={() => setScale((prev) => Math.min(prev + 0.2, 2.5))} className="rounded-xl border-4 border-[#22243a] bg-white p-3 text-xl font-black shadow-lg hover:bg-[#f4e39d]" aria-label="Zoom in">+</button>
          <button onClick={() => setScale((prev) => Math.max(prev - 0.2, 0.65))} className="rounded-xl border-4 border-[#22243a] bg-white p-3 text-xl font-black shadow-lg hover:bg-[#f4e39d]" aria-label="Zoom out">−</button>
          <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} className="rounded-xl border-4 border-[#22243a] bg-white p-3 text-xl font-black shadow-lg hover:bg-[#f4e39d]" aria-label="Reset view">⌂</button>
        </div>
      </div>
    </>
  );
}
