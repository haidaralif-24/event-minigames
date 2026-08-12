import { useMemo, useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import boardTiles from '../data/boardTiles.json';

// The board uses a deliberately irregular, spacious route instead of a grid.
// Points are control points for the trail. Tiles are distributed by actual
// path distance so they stay evenly spaced even when segments have different lengths.
const PATH_POINTS = [
  { x: 70, y: 390 },
  { x: 120, y: 315 },
  { x: 85, y: 220 },
  { x: 145, y: 135 },
  { x: 250, y: 105 },
  { x: 350, y: 145 },
  { x: 385, y: 235 },
  { x: 330, y: 325 },
  { x: 250, y: 365 },
  { x: 330, y: 420 },
  { x: 455, y: 415 },
  { x: 555, y: 350 },
  { x: 610, y: 265 },
  { x: 565, y: 185 },
  { x: 480, y: 125 },
  { x: 575, y: 80 },
  { x: 690, y: 100 },
  { x: 735, y: 185 },
  { x: 700, y: 280 },
  { x: 740, y: 365 },
  { x: 690, y: 430 },
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

  const localT = segment.length === 0
    ? 0
    : (d - segment.start) / segment.length;

  return {
    x: segment.a.x + (segment.b.x - segment.a.x) * localT,
    y: segment.a.y + (segment.b.y - segment.a.y) * localT,
  };
}

function buildTilePositions(total) {
  if (total <= 1) return [pointAtDistance(0)];

  return Array.from({ length: total }, (_, index) => {
    const distance = (index / (total - 1)) * BOARD_PATH.totalLength;
    return pointAtDistance(distance);
  });
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
    e.currentTarget.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  };

  const handleMouseUp = (e) => {
    if (!isPanning) return;
    setIsPanning(false);
    e.currentTarget.style.cursor = 'grab';
  };

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
    setPan({
      x: touch.clientX - panStart.x,
      y: touch.clientY - panStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
  };

  const tiles = useMemo(() => {
    const tilePositions = buildTilePositions(boardTiles.length);
    return boardTiles.map((tile, index) => ({
      ...tile,
      ...tilePositions[index],
    }));
  }, []);

  const colors = ['#ff4d4d', '#4d79ff', '#4dff79', '#ffea4d', '#a64dff', '#ff8c4d'];

  const trailPath = PATH_POINTS
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  return (
    <div
      className="relative w-full h-full min-h-[100vh] min-w-[100vw] overflow-hidden bg-[#eaddb8]"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ cursor: isPanning ? 'grabbing' : 'grab', touchAction: 'none' }}
    >
      <svg
        ref={svgRef}
        viewBox="0 0 800 500"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        aria-label="Board exploration map"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Background scenery */}
        <ellipse cx="115" cy="270" rx="85" ry="55" fill="#a4d8e8" opacity="0.3" />
        <ellipse cx="430" cy="245" rx="75" ry="48" fill="#a4e0c7" opacity="0.3" />
        <ellipse cx="650" cy="155" rx="75" ry="48" fill="#a4d8e8" opacity="0.3" />
        <ellipse cx="650" cy="380" rx="60" ry="40" fill="#a4e0c7" opacity="0.3" />

        {/* Wide trail underneath the tiles */}
        <path
          d={trailPath}
          fill="none"
          stroke="#bfa86b"
          strokeWidth="16"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={trailPath}
          fill="none"
          stroke="#d9c48a"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="3 14"
        />

        {/* Tiles */}
        {tiles.map((tile) => (
          <g key={tile.index} transform={`translate(${tile.x - 27}, ${tile.y - 27})`}>
            <circle
              cx="27"
              cy="27"
              r="27"
              fill={tile.type === 'start' ? '#4dff79' : tile.type === 'finish' ? '#ff4d4d' : '#fff'}
              stroke="#1a1a2e"
              strokeWidth="3"
            />
            <text
              x="27"
              y="32"
              textAnchor="middle"
              fontSize="13"
              fontWeight="bold"
              fill="#1a1a2e"
              fontFamily="system-ui, sans-serif"
            >
              {tile.index + 1}
            </text>
          </g>
        ))}

        {/* Team Tokens */}
        {Object.entries(positions).map(([teamId, tileIndex], idx) => {
          const tile = tiles[tileIndex] || tiles[0];
          const cx = tile?.x ?? 70;
          const cy = tile?.y ?? 390;
          return (
            <g key={teamId} transform={`translate(${cx - 24}, ${cy - 30})`}>
              <circle cx="24" cy="15" r="10" fill={colors[idx % colors.length]} stroke="#1a1a2e" strokeWidth="2.5" />
              <line x1="24" y1="27" x2="24" y2="45" stroke={colors[idx % colors.length]} strokeWidth="4" />
              <line x1="11" y1="35" x2="37" y2="35" stroke={colors[idx % colors.length]} strokeWidth="3" />
              <line x1="24" y1="45" x2="13" y2="54" stroke="#1a1a2e" strokeWidth="2.5" />
              <line x1="24" y1="45" x2="35" y2="54" stroke="#1a1a2e" strokeWidth="2.5" />
            </g>
          );
        })}
      </svg>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2">
        <button onClick={() => setScale((prev) => Math.min(prev + 0.2, 3))} className="bg-white border-4 border-[#1a1a2e] rounded-xl p-3 shadow-lg hover:bg-[#ffea4d] transition-colors" aria-label="Zoom in">+</button>
        <button onClick={() => setScale((prev) => Math.max(prev - 0.2, 0.3))} className="bg-white border-4 border-[#1a1a2e] rounded-xl p-3 shadow-lg hover:bg-[#ffea4d] transition-colors" aria-label="Zoom out">−</button>
        <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} className="bg-white border-4 border-[#1a1a2e] rounded-xl p-3 shadow-lg hover:bg-[#ffea4d] transition-colors" aria-label="Reset view">⌂</button>
      </div>
    </div>
  );
}
