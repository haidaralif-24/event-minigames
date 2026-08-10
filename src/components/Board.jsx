import { useMemo, useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import boardTiles from '../data/boardTiles.json';

const PATH_POINTS = [
  { x: 80, y: 60 }, { x: 400, y: 60 }, { x: 400, y: 220 }, { x: 80, y: 220 },
  { x: 80, y: 380 }, { x: 400, y: 380 }, { x: 400, y: 540 }, { x: 80, y: 540 },
  { x: 220, y: 660 },
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
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'gameState', 'current'), (snap) => {
      if (snap.exists() && snap.data().boardPositions) setPositions(snap.data().boardPositions);
    });
    return unsub;
  }, []);

  const tiles = useMemo(() => boardTiles.map((tile) => ({ ...tile, ...interpolatePath(tile.index, boardTiles.length) })), []);
  const colors = ['#ff4d4d', '#4d79ff', '#4dff79', '#ffea4d', '#a64dff', '#ff8c4d'];

  return (
    <svg viewBox="0 0 520 700" preserveAspectRatio="xMidYMid meet" className="w-full h-full bg-gradient-to-b from-[#eaddb8] to-[#c7e8a4]" aria-label="Board exploration map">
      <ellipse cx="140" cy="140" rx="60" ry="40" fill="#a4d8e8" opacity="0.4" />
      <ellipse cx="380" cy="620" rx="80" ry="50" fill="#a4d8e8" opacity="0.4" />
      <ellipse cx="360" cy="360" rx="30" ry="30" fill="#a4e0c7" opacity="0.4" transform="rotate(12 360 360)" />
      <path d={PATH_POINTS.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ')} fill="none" stroke="#bfa86b" strokeWidth="24" strokeLinecap="round" strokeDasharray="8 8" />
      {tiles.map((tile) => (
        <g key={tile.index} transform={`translate(${tile.x - 32}, ${tile.y - 32})`}>
          <circle cx="32" cy="32" r="32" fill={tile.type === 'start' ? '#4dff79' : tile.type === 'finish' ? '#ff4d4d' : '#fff'} stroke="#1a1a2e" strokeWidth="4" />
          <text x="32" y="36" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#1a1a2e" fontFamily="system-ui, sans-serif">{tile.index + 1}</text>
        </g>
      ))}
      {Object.entries(positions).map(([teamId, tileIndex], idx) => {
        const tile = tiles[tileIndex] || tiles[0];
        const cx = tile?.x ?? 80, cy = tile?.y ?? 60;
        return (
          <g key={teamId} transform={`translate(${cx - 24}, ${cy - 32})`}>
            <circle cx="24" cy="16" r="10" fill={colors[idx % colors.length]} stroke="#1a1a2e" strokeWidth="3" />
            <line x1="24" y1="28" x2="24" y2="50" stroke={colors[idx % colors.length]} strokeWidth="5" />
            <line x1="12" y1="36" x2="36" y2="36" stroke={colors[idx % colors.length]} strokeWidth="4" />
            <line x1="24" y1="50" x2="14" y2="58" stroke="#1a1a2e" strokeWidth="3" />
            <line x1="24" y1="50" x2="34" y2="58" stroke="#1a1a2e" strokeWidth="3" />
          </g>
        );
      })}
    </svg>
  );
}
