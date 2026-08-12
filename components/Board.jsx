import { useMemo, useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import boardTiles from '../data/boardTiles.json';

// A hand-authored adventure route. Tiles are placed by real path distance so
// changing the route never creates the cramped clusters from the old board.
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

function Tree({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity=".96">
      <ellipse cx="0" cy="25" rx="24" ry="8" fill="#557d38" opacity=".3" />
      <path d="M-5 25h10l-2-22h-6z" fill="#76502f" />
      <path d="M0-55C-22-32-22-8-10 2H10C22-8 22-32 0-55Z" fill="#2f6d3b" stroke="#245630" strokeWidth="2" />
      <path d="M0-37C-18-18-17 0-8 8H8C17 0 18-18 0-37Z" fill="#4f8b42" />
      <path d="M0-23C-12-8-11 4-5 11H5C11 4 12-8 0-23Z" fill="#6ba34d" />
    </g>
  );
}

function Bush({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="8" rx="30" ry="8" fill="#527d38" opacity=".25" />
      <circle cx="-18" cy="0" r="14" fill="#4f8b42" />
      <circle cx="0" cy="-7" r="18" fill="#63994a" />
      <circle cx="18" cy="1" r="14" fill="#3f7939" />
      <circle cx="-4" cy="-10" r="5" fill="#83b75d" />
    </g>
  );
}

function Rock({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="8" rx="24" ry="7" fill="#486c42" opacity=".22" />
      <path d="M-20 7L-15-9 0-17 19-7 15 8Z" fill="#8c9a8a" stroke="#667665" strokeWidth="2" />
      <path d="M-9-7L1-12 9-7" fill="none" stroke="#b9c3b5" strokeWidth="3" opacity=".8" />
    </g>
  );
}

function Flower({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 0v12" stroke="#4d873e" strokeWidth="2" />
      <circle cx="0" cy="-1" r="4" fill="#ffd84d" />
      <circle cx="-5" cy="-2" r="4" fill="#f4f0df" />
      <circle cx="5" cy="-2" r="4" fill="#f4f0df" />
      <circle cx="0" cy="-7" r="4" fill="#f4f0df" />
    </g>
  );
}

export default function Board() {
  const [positions, setPositions] = useState({});
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);

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
    setScale((prev) => Math.min(Math.max(prev + delta, 0.3), 3));
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

  const handleMouseUp = () => setIsPanning(false);

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsPanning(true);
      setPanStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
    }
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

  const trailPath = PATH_POINTS.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
  const colors = ['#ff4d4d', '#4d79ff', '#4dff79', '#ffea4d', '#a64dff', '#ff8c4d'];

  return (
    <div
      className="relative w-full h-full min-h-[100vh] min-w-[100vw] overflow-hidden bg-[#8fbe4d]"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => setIsPanning(false)}
      style={{ cursor: isPanning ? 'grabbing' : 'grab', touchAction: 'none' }}
    >
      <svg
        ref={svgRef}
        viewBox="0 0 1120 650"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
        aria-label="Adventure board map"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: '0 0' }}
      >
        <defs>
          <linearGradient id="grass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#b8d96b" />
            <stop offset="1" stopColor="#79ad43" />
          </linearGradient>
          <linearGradient id="water" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#55c8dd" />
            <stop offset="1" stopColor="#228da9" />
          </linearGradient>
          <linearGradient id="trail" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#efd28b" />
            <stop offset="1" stopColor="#c69b52" />
          </linearGradient>
          <filter id="tileShadow" x="-30%" y="-30%" width="160%" height="170%">
            <feDropShadow dx="0" dy="5" stdDeviation="3" floodOpacity=".28" />
          </filter>
          <pattern id="grassTexture" width="42" height="42" patternUnits="userSpaceOnUse">
            <circle cx="5" cy="8" r="2" fill="#5d963c" opacity=".28" />
            <circle cx="28" cy="30" r="2" fill="#e1e99d" opacity=".25" />
            <path d="M15 19l3-6m0 6l-3-3m17 8l3-6m0 6l-3-3" stroke="#4d8c3d" strokeWidth="2" opacity=".3" />
          </pattern>
        </defs>

        {/* Illustrated meadow */}
        <rect width="1120" height="650" fill="url(#grass)" />
        <rect width="1120" height="650" fill="url(#grassTexture)" />

        {/* Pond + stream */}
        <path d="M205 250C245 195 365 195 405 260C430 305 405 375 350 405C275 440 190 395 185 325C180 295 190 270 205 250Z" fill="#257f91" opacity=".35" />
        <path d="M210 245C260 205 350 210 390 260C420 300 390 365 340 390C275 415 205 380 195 320C190 290 195 265 210 245Z" fill="url(#water)" stroke="#3c7880" strokeWidth="7" />
        <path d="M420 175C450 215 440 260 430 300C415 350 440 390 485 430C520 460 555 465 600 470" fill="none" stroke="#237e91" strokeWidth="35" opacity=".45" />
        <path d="M420 175C450 215 440 260 430 300C415 350 440 390 485 430C520 460 555 465 600 470" fill="none" stroke="url(#water)" strokeWidth="25" strokeLinecap="round" />
        <path d="M245 285c30-14 55-15 82-3M265 350c26-11 51-10 72-1M438 215c10 18 11 35 5 50M450 370c13 17 25 26 43 36" fill="none" stroke="#b5eff0" strokeWidth="4" strokeLinecap="round" opacity=".7" />
        <ellipse cx="275" cy="275" rx="16" ry="8" fill="#73b95b" transform="rotate(-15 275 275)" />
        <ellipse cx="345" cy="330" rx="13" ry="7" fill="#73b95b" transform="rotate(20 345 330)" />

        {/* Scenery */}
        <Tree x={70} y={100} s={1.15} /><Tree x={145} y={80} s={.8} />
        <Tree x={365} y={95} s={.95} /><Tree x={500} y={75} s={1.1} />
        <Tree x={620} y={100} s={.9} /><Tree x={680} y={430} s={1.1} />
        <Tree x={805} y={500} s={1.05} /><Tree x={875} y={95} s={.85} />
        <Tree x={1020} y={145} s={1.15} /><Tree x={1080} y={360} s={.9} />
        <Tree x={80} y={430} s={.85} /><Tree x={350} y={520} s={1.0} />
        <Tree x={900} y={565} s={1.0} />
        <Bush x={520} y={130} s={.8} /><Bush x={625} y={235} />
        <Bush x={710} y={310} s={.8} /><Bush x={540} y={545} />
        <Bush x={1000} y={250} s={.8} /><Bush x={160} y={545} />
        <Rock x={450} y={110} /><Rock x={560} y={190} s={.8} /><Rock x={730} y={535} s={.8} />
        <Rock x={1010} y={390} /><Rock x={110} y={350} s={.7} />
        <Flower x={105} y={150} s={.7} /><Flower x={395} y={160} />
        <Flower x={585} y={115} s={.8} /><Flower x={710} y={500} />
        <Flower x={870} y={385} s={.8} /><Flower x={1030} y={330} />
        <Flower x={160} y={410} s={.7} /><Flower x={560} y={365} s={.7} />

        {/* Adventure trail */}
        <path d={trailPath} fill="none" stroke="#805c32" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" opacity=".28" />
        <path d={trailPath} fill="none" stroke="url(#trail)" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
        <path d={trailPath} fill="none" stroke="#f4df9d" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 16" opacity=".9" />

        {/* Little wooden bridge */}
        <g transform="translate(470 438) rotate(13)">
          <rect x="-38" y="-18" width="76" height="36" rx="5" fill="#70421f" stroke="#4f321d" strokeWidth="3" />
          {[-28, -14, 0, 14, 28].map((x) => <rect key={x} x={x - 4} y="-15" width="8" height="30" rx="2" fill="#a96832" />)}
        </g>

        {/* Start / finish signs */}
        <g transform="translate(35 520) rotate(-5)">
          <path d="M8 0v50M90 0v50" stroke="#5c3a24" strokeWidth="7" />
          <rect x="0" y="0" width="98" height="34" rx="4" fill="#8b5a31" stroke="#57351f" strokeWidth="3" />
          <text x="49" y="23" textAnchor="middle" fontSize="18" fontWeight="900" fill="#fff7d8">START</text>
        </g>
        <g transform="translate(1010 535) rotate(5)">
          <path d="M8 0v48M85 0v48" stroke="#5c3a24" strokeWidth="7" />
          <rect x="0" y="0" width="93" height="34" rx="4" fill="#8b5a31" stroke="#57351f" strokeWidth="3" />
          <text x="46" y="23" textAnchor="middle" fontSize="16" fontWeight="900" fill="#fff7d8">FINISH</text>
        </g>

        {/* Tiles: exactly the 30 entries from boardTiles.json */}
        {tiles.map((tile) => {
          const isStart = tile.type === 'start';
          const isFinish = tile.type === 'finish';
          const number = tile.index + 1;
          return (
            <g key={tile.index} transform={`translate(${tile.x} ${tile.y})`} filter="url(#tileShadow)">
              <circle r="29" fill={isStart ? '#55df70' : isFinish ? '#ef5752' : '#f7e4b1'} stroke={isStart ? '#217d3b' : isFinish ? '#a62d2a' : '#9c783e'} strokeWidth="4" />
              <circle r="23" fill={isStart ? '#69ed7d' : isFinish ? '#ff6861' : '#fff0c8'} opacity=".55" />
              <text y="7" textAnchor="middle" fontSize="18" fontWeight="900" fill={isStart || isFinish ? '#fff' : '#4d3a24'} fontFamily="system-ui, sans-serif">{number}</text>
            </g>
          );
        })}

        {/* Team tokens */}
        {Object.entries(positions).map(([teamId, tileIndex], idx) => {
          const tile = tiles[tileIndex] || tiles[0];
          const cx = tile?.x ?? 105;
          const cy = tile?.y ?? 515;
          return (
            <g key={teamId} transform={`translate(${cx - 24} ${cy - 42})`}>
              <circle cx="24" cy="15" r="11" fill={colors[idx % colors.length]} stroke="#fff" strokeWidth="3" />
              <path d="M24 27v18M11 36h26M24 45L13 56M24 45l11 11" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
            </g>
          );
        })}
      </svg>

      {/* Lobby */}
      <div className="absolute top-5 right-5 z-20 w-[280px] rounded-2xl border-4 border-[#22243a] bg-[#fffdf5] p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
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

      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2" onMouseDown={(e) => e.stopPropagation()}>
        <button onClick={() => setScale((prev) => Math.min(prev + 0.2, 3))} className="rounded-xl border-4 border-[#22243a] bg-white p-3 text-xl font-black shadow-lg hover:bg-[#f4e39d]" aria-label="Zoom in">+</button>
        <button onClick={() => setScale((prev) => Math.max(prev - 0.2, 0.3))} className="rounded-xl border-4 border-[#22243a] bg-white p-3 text-xl font-black shadow-lg hover:bg-[#f4e39d]" aria-label="Zoom out">−</button>
        <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} className="rounded-xl border-4 border-[#22243a] bg-white p-3 text-xl font-black shadow-lg hover:bg-[#f4e39d]" aria-label="Reset view">⌂</button>
      </div>
    </div>
  );
}
