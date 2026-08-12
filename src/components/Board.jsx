import { useMemo, useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import boardTiles from '../data/boardTiles.json';

// More spread out path points - tiles have more breathing room
const PATH_POINTS = [
  { x: 50, y: 250 },   // start
  { x: 180, y: 250 },
  { x: 180, y: 100 },
  { x: 320, y: 100 },
  { x: 320, y: 400 },
  { x: 500, y: 400 },
  { x: 500, y: 100 },
  { x: 680, y: 100 },
  { x: 680, y: 400 },  // finish
];

function interpolatePath(index, total) {
  const t = index / (total - 1);
  const segmentCount = PATH_POINTS.length - 1;
  const segmentT = t * segmentCount;
  const i = Math.floor(segmentT);
  const j = Math.min(i + 1, segmentCount);
  const localT = segmentT - i;
  const p0 = PATH_POINTS[i];
  const p1 = PATH_POINTS[j];
  return { x: p0.x + (p1.x - p0.x) * localT, y: p0.y + (p1.y - p0.y) * localT };
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
      if (snap.exists() && snap.data().boardPositions) setPositions(snap.data().boardPositions);
    });
    return unsub;
  }, []);

  // Zoom with mouse wheel
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.min(Math.max(prev + delta, 0.3), 3));
  };

  // Pan handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // only left click
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    e.target.style.cursor = 'grabbing';
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
    e.target.style.cursor = 'grab';
  };

  // Also handle touch for mobile
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

  const tiles = useMemo(() => boardTiles.map((tile) => ({ ...tile, ...interpolatePath(tile.index, boardTiles.length) })), []);
  const colors = ['#ff4d4d', '#4d79ff', '#4dff79', '#ffea4d', '#a64dff', '#ff8c4d'];

  return (
    <div className="relative w-full h-full min-h-[100vh] min-w-[100vw] overflow-hidden bg-[#eaddb8]" 
         onWheel={handleWheel}
         onMouseDown={handleMouseDown}
         onMouseMove={handleMouseMove}
         onMouseUp={handleMouseUp}
         onMouseLeave={handleMouseUp}
         onTouchStart={handleTouchStart}
         onTouchMove={handleTouchMove}
         onTouchEnd={handleTouchEnd}
         style={{ cursor: isPanning ? 'grabbing' : 'grab', touchAction: 'none' }}>
      <svg ref={svgRef} 
           viewBox="0 0 800 500" 
           preserveAspectRatio="xMidYMid meet" 
           className="w-full h-full" 
           aria-label="Board exploration map"
           style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
        {/* Background scenery */}
        <ellipse cx="80" cy="300" rx="60" ry="40" fill="#a4d8e8" opacity="0.3" />
        <ellipse cx="600" cy="180" rx="70" ry="45" fill="#a4d8e8" opacity="0.3" />
        <ellipse cx="400" cy="80" rx="40" ry="40" fill="#a4e0c7" opacity="0.3" transform="rotate(12 400 80)" />

        {/* Trail */}
        <path d={PATH_POINTS.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ')} fill="none" stroke="#bfa86b" strokeWidth="14" strokeLinecap="round" strokeDasharray="8 8" />

        {/* Tiles */}
        {tiles.map((tile) => (
          <g key={tile.index} transform={`translate(${tile.x - 30}, ${tile.y - 30})`}>
            <circle cx="30" cy="30" r="30" fill={tile.type === 'start' ? '#4dff79' : tile.type === 'finish' ? '#ff4d4d' : '#fff'} stroke="#1a1a2e" strokeWidth="3" />
            <text x="30" y="35" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#1a1a2e" fontFamily="system-ui, sans-serif">{tile.index + 1}</text>
          </g>
        ))}

        {/* Team Tokens */}
        {Object.entries(positions).map(([teamId, tileIndex], idx) => {
          const tile = tiles[tileIndex] || tiles[0];
          const cx = tile?.x ?? 50, cy = tile?.y ?? 250;
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
        <button onClick={() => setScale(prev => Math.min(prev + 0.2, 3))} className="bg-white border-4 border-[#1a1a2e] rounded-xl p-3 shadow-lg hover:bg-[#ffea4d] transition-colors" aria-label="Zoom in">+</button>
        <button onClick={() => setScale(prev => Math.max(prev - 0.2, 0.3))} className="bg-white border-4 border-[#1a1a2e] rounded-xl p-3 shadow-lg hover:bg-[#ffea4d] transition-colors" aria-label="Zoom out">−</button>
        <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} className="bg-white border-4 border-[#1a1a2e] rounded-xl p-3 shadow-lg hover:bg-[#ffea4d] transition-colors" aria-label="Reset view">⌂</button>
      </div>
    </div>
  );
}
