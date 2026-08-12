import { useMemo, useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import boardTiles from '../data/boardTiles.json';

const TOTAL_TILES = 30;

// Long, irregular adventure route. Tiles are placed by real distance along
// the route, not by segment count, which keeps their spacing consistent.
const PATH_POINTS = [
  { x: 90, y: 500 },
  { x: 125, y: 420 },
  { x: 105, y: 330 },
  { x: 155, y: 250 },
  { x: 235, y: 205 },
  { x: 330, y: 220 },
  { x: 395, y: 285 },
  { x: 420, y: 375 },
  { x: 390, y: 460 },
  { x: 455, y: 525 },
  { x: 555, y: 535 },
  { x: 650, y: 505 },
  { x: 720, y: 440 },
  { x: 735, y: 350 },
  { x: 705, y: 270 },
  { x: 650, y: 210 },
  { x: 700, y: 140 },
  { x: 795, y: 105 },
  { x: 890, y: 130 },
  { x: 955, y: 190 },
  { x: 970, y: 275 },
  { x: 940, y: 350 },
  { x: 975, y: 425 },
  { x: 1030, y: 500 },
  { x: 1080, y: 565 },
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
  const segment = BOARD_PATH.segments.find(
    ({ start, length }) => d <= start + length,
  ) || BOARD_PATH.segments.at(-1);

  const t = segment.length === 0 ? 0 : (d - segment.start) / segment.length;

  return {
    x: segment.a.x + (segment.b.x - segment.a.x) * t,
    y: segment.a.y + (segment.b.y - segment.a.y) * t,
  };
}

function buildTilePositions(total) {
  if (total <= 1) return [pointAtDistance(0)];

  return Array.from({ length: total }, (_, index) =>
    pointAtDistance((index / (total - 1)) * BOARD_PATH.totalLength),
  );
}

function Tree({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="26" rx="25" ry="8" fill="#315d2d" opacity=".25" />
      <path d="M-6 25h12l-2-27h-8z" fill="#75502e" />
      <path d="M0-62C-28-38-28-10-12 2H12C28-10 28-38 0-62Z" fill="#2f6d3b" stroke="#23572f" strokeWidth="2" />
      <path d="M0-42C-20-23-20-3-9 9H9C20-3 20-23 0-42Z" fill="#4e8c42" />
      <path d="M0-25C-12-11-12 3-5 11H5C12 3 12-11 0-25Z" fill="#6da34d" />
    </g>
  );
}

function Bush({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="9" rx="31" ry="8" fill="#315d2d" opacity=".22" />
      <circle cx="-18" cy="0" r="15" fill="#4b873d" />
      <circle cx="0" cy="-8" r="19" fill="#629b47" />
      <circle cx="18" cy="1" r="15" fill="#3f7b38" />
      <circle cx="-5" cy="-11" r="5" fill="#86b95d" />
    </g>
  );
}

function Rock({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="9" rx="25" ry="7" fill="#315d2d" opacity=".2" />
      <path d="M-20 8L-15-9 0-18 19-8 15 8Z" fill="#879688" stroke="#647264" strokeWidth="2" />
      <path d="M-9-7L1-13 9-7" fill="none" stroke="#c0c9bd" strokeWidth="3" opacity=".8" />
    </g>
  );
}

function Flower({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M0 0v13" stroke="#4d873e" strokeWidth="2" />
      <circle cx="0" cy="-2" r="4" fill="#ffd84d" />
      <circle cx="-5" cy="-3" r="4" fill="#fff5df" />
      <circle cx="5" cy="-3" r="4" fill="#fff5df" />
      <circle cx="0" cy="-8" r="4" fill="#fff5df" />
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

  const handleWheel = (event) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    setScale((prev) => Math.min(Math.max(prev + delta, 0.3), 3));
  };

  const handleMouseDown = (event) => {
    if (event.button !== 0) return;
    setIsPanning(true);
    setPanStart({ x: event.clientX - pan.x, y: event.clientY - pan.y });
  };

  const handleMouseMove = (event) => {
    if (!isPanning) return;
    setPan({ x: event.clientX - panStart.x, y: event.clientY - panStart.y });
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleTouchStart = (event) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    setIsPanning(true);
    setPanStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
  };

  const handleTouchMove = (event) => {
    if (!isPanning || event.touches.length !== 1) return;
    event.preventDefault();
    const touch = event.touches[0];
    setPan({ x: touch.clientX - panStart.x, y: touch.clientY - panStart.y });
  };

  const tiles = useMemo(() => {
    const source = boardTiles.slice(0, TOTAL_TILES);
    const tilePositions = buildTilePositions(TOTAL_TILES);

    return source.map((tile, index) => ({
      ...tile,
      index,
      ...tilePositions[index],
    }));
  }, []);

  const trailPath = PATH_POINTS
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  const colors = ['#ff4d4d', '#4d79ff', '#4dff79', '#ffea4d', '#a64dff', '#ff8c4d'];

  return (
    <div
      className="relative w-full h-full min-h-[100vh] min-w-[100vw] overflow-hidden bg-[#79ad43]"
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
        aria-label="Illustrated adventure board"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >
        <defs>
          <linearGradient id="meadow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#b8d96b" />
            <stop offset="1" stopColor="#79ad43" />
          </linearGradient>
          <linearGradient id="water" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#63d1df" />
            <stop offset="1" stopColor="#258ea8" />
          </linearGradient>
          <linearGradient id="trail" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#efd494" />
            <stop offset="1" stopColor="#bf8d48" />
          </linearGradient>
          <pattern id="grassTexture" width="44" height="44" patternUnits="userSpaceOnUse">
            <circle cx="7" cy="9" r="2" fill="#4c873b" opacity=".22" />
            <circle cx="30" cy="31" r="2" fill="#e6eeaa" opacity=".25" />
            <path d="M17 22l3-6m0 6l-3-3M35 12l3-6m0 6l-3-3" stroke="#4c873b" strokeWidth="2" opacity=".25" />
          </pattern>
          <filter id="tileShadow" x="-30%" y="-30%" width="160%" height="170%">
            <feDropShadow dx="0" dy="5" stdDeviation="3" floodOpacity=".28" />
          </filter>
        </defs>

        {/* Meadow */}
        <rect width="1120" height="650" fill="url(#meadow)" />
        <rect width="1120" height="650" fill="url(#grassTexture)" />

        {/* Pond and winding stream */}
        <path
          d="M185 220C235 170 350 180 390 245C420 295 390 360 330 385C255 415 170 370 165 305C160 270 170 240 185 220Z"
          fill="#236f82"
          opacity=".3"
        />
        <path
          d="M195 215C245 180 340 190 375 245C400 285 375 345 325 370C265 395 185 355 180 300C177 265 182 235 195 215Z"
          fill="url(#water)"
          stroke="#397987"
          strokeWidth="7"
        />
        <path
          d="M395 155C430 205 425 250 410 300C395 350 420 395 470 430C515 462 550 470 605 480"
          fill="none"
          stroke="#216f83"
          strokeWidth="36"
          opacity=".35"
        />
        <path
          d="M395 155C430 205 425 250 410 300C395 350 420 395 470 430C515 462 550 470 605 480"
          fill="none"
          stroke="url(#water)"
          strokeWidth="25"
          strokeLinecap="round"
        />
        <path d="M230 255c28-13 55-14 82-3M250 325c25-10 48-10 69-2M415 210c10 17 12 34 6 51M440 375c16 17 28 26 45 34" fill="none" stroke="#c1f3f0" strokeWidth="4" strokeLinecap="round" opacity=".7" />
        <ellipse cx="255" cy="250" rx="16" ry="8" fill="#78b85a" transform="rotate(-15 255 250)" />
        <ellipse cx="335" cy="320" rx="13" ry="7" fill="#78b85a" transform="rotate(20 335 320)" />

        {/* Bridge */}
        <g transform="translate(415 300)">
          <rect x="-28" y="-17" width="56" height="34" rx="6" fill="#8a5a32" stroke="#5e3d25" strokeWidth="3" />
          <path d="M-21-10h42M-21 0h42M-21 10h42" stroke="#c38a4c" strokeWidth="5" />
          <path d="M-29-20h58M-29 20h58" stroke="#654127" strokeWidth="5" />
        </g>

        {/* Scenery */}
        <Tree x={65} y={100} scale={1.1} />
        <Tree x={145} y={85} scale={.8} />
        <Tree x={365} y={90} scale={.9} />
        <Tree x={510} y={75} scale={1.1} />
        <Tree x={625} y={95} scale={.9} />
        <Tree x={675} y={455} scale={1.1} />
        <Tree x={805} y={515} scale={1.05} />
        <Tree x={880} y={80} scale={.85} />
        <Tree x={1030} y={135} scale={1.1} />
        <Tree x={1080} y={360} scale={.9} />
        <Tree x={75} y={450} scale={.85} />
        <Tree x={350} y={550} />
        <Tree x={900} y={585} />
        <Bush x={515} y={125} scale={.8} />
        <Bush x={625} y={235} />
        <Bush x={715} y={315} scale={.8} />
        <Bush x={540} y={555} />
        <Bush x={1010} y={250} scale={.8} />
        <Bush x={160} y={555} />
        <Rock x={455} y={105} />
        <Rock x={560} y={185} scale={.8} />
        <Rock x={740} y={545} scale={.8} />
        <Rock x={1010} y={390} />
        <Rock x={115} y={355} scale={.7} />
        <Flower x={105} y={150} scale={.7} />
        <Flower x={395} y={160} />
        <Flower x={585} y={115} scale={.8} />
        <Flower x={710} y={500} />
        <Flower x={870} y={385} scale={.8} />
        <Flower x={1030} y={330} />
        <Flower x={160} y={410} scale={.7} />
        <Flower x={560} y={365} scale={.7} />

        {/* Main adventure trail */}
        <path d={trailPath} fill="none" stroke="#6f4b2c" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" opacity=".3" />
        <path d={trailPath} fill="none" stroke="url(#trail)" strokeWidth="25" strokeLinecap="round" strokeLinejoin="round" />
        <path d={trailPath} fill="none" stroke="#f7e0a8" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 18" opacity=".8" />

        {/* Start and finish flags */}
        <g transform="translate(82 455)">
          <path d="M0 0v-65" stroke="#604126" strokeWidth="5" />
          <path d="M3-63h48l-24 17 24 17H3z" fill="#4dff79" stroke="#245630" strokeWidth="2" />
          <text x="25" y="-72" textAnchor="middle" fontSize="13" fontWeight="900" fill="#245630">START</text>
        </g>
        <g transform="translate(1080 555)">
          <path d="M0 0v-65" stroke="#604126" strokeWidth="5" />
          <path d="M3-63h50l-25 17 25 17H3z" fill="#ff4d4d" stroke="#702b2b" strokeWidth="2" />
          <text x="27" y="-72" textAnchor="middle" fontSize="13" fontWeight="900" fill="#702b2b">FINISH</text>
        </g>

        {/* Exactly 30 playable tiles */}
        {tiles.map((tile) => (
          <g key={tile.index} transform={`translate(${tile.x} ${tile.y})`} filter="url(#tileShadow)">
            <circle
              r="25"
              fill={tile.index === 0 ? '#4dff79' : tile.index === TOTAL_TILES - 1 ? '#ff4d4d' : '#fffdf8'}
              stroke="#172039"
              strokeWidth="3.5"
            />
            <circle r="20" fill="none" stroke="#d9d5c9" strokeWidth="1.5" opacity=".75" />
            <text
              x="0"
              y="6"
              textAnchor="middle"
              fontSize="14"
              fontWeight="900"
              fill="#172039"
              fontFamily="system-ui, sans-serif"
            >
              {tile.index + 1}
            </text>
          </g>
        ))}

        {/* Team tokens */}
        {Object.entries(positions).map(([teamId, tileIndex], idx) => {
          const tile = tiles[tileIndex] || tiles[0];
          const cx = tile?.x ?? 90;
          const cy = tile?.y ?? 500;
          const color = colors[idx % colors.length];

          return (
            <g key={teamId} transform={`translate(${cx - 24} ${cy - 35})`}>
              <circle cx="24" cy="15" r="10" fill={color} stroke="#172039" strokeWidth="2.5" />
              <line x1="24" y1="27" x2="24" y2="45" stroke={color} strokeWidth="4" />
              <line x1="11" y1="35" x2="37" y2="35" stroke={color} strokeWidth="3" />
              <line x1="24" y1="45" x2="13" y2="54" stroke="#172039" strokeWidth="2.5" />
              <line x1="24" y1="45" x2="35" y2="54" stroke="#172039" strokeWidth="2.5" />
            </g>
          );
        })}
      </svg>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2">
        <button onClick={() => setScale((prev) => Math.min(prev + 0.2, 3))} className="bg-white border-4 border-[#172039] rounded-xl p-3 shadow-lg hover:bg-[#ffea4d] transition-colors" aria-label="Zoom in">+</button>
        <button onClick={() => setScale((prev) => Math.max(prev - 0.2, 0.3))} className="bg-white border-4 border-[#172039] rounded-xl p-3 shadow-lg hover:bg-[#ffea4d] transition-colors" aria-label="Zoom out">−</button>
        <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} className="bg-white border-4 border-[#172039] rounded-xl p-3 shadow-lg hover:bg-[#ffea4d] transition-colors" aria-label="Reset view">⌂</button>
      </div>
    </div>
  );
}
