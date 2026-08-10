import { useMemo, useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import StickmanToken from './StickmanToken.jsx';
import boardTiles from '../data/boardTiles.json';

// Hand-authored winding path points (S-curve style)
const PATH_POINTS = [
  { x: 80, y: 60 },
  { x: 400, y: 60 },
  { x: 400, y: 220 },
  { x: 80, y: 220 },
  { x: 80, y: 380 },
  { x: 400, y: 380 },
  { x: 400, y: 540 },
  { x: 80, y: 540 },
  { x: 220, y: 660 },
];

function interpolatePath(index, total) {
  const t = index / (total - 1);
  // Find segment
  const segmentCount = PATH_POINTS.length - 1;
  const segmentT = t * segmentCount;
  const i = Math.floor(segmentT);
  const j = Math.min(i + 1, segmentCount);
  const localT = segmentT - i;
  const p0 = PATH_POINTS[i];
  const p1 = PATH_POINTS[j];
  return {
    x: p0.x + (p1.x - p0.x) * localT,
    y: p0.y + (p1.y - p0.y) * localT,
  };
}

export default function Board() {
  const [positions, setPositions] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'gameState', 'current'), (snap) => {
      if (snap.exists() && snap.data().boardPositions) {
        setPositions(snap.data().boardPositions);
      }
    });
    return unsub;
  }, []);

  const tiles = useMemo(() => {
    return boardTiles.map((tile) => ({
      ...tile,
      ...interpolatePath(tile.index, boardTiles.length),
    }));
  }, []);

  return (
    <div className="relative w-full h-[720px] overflow-hidden bg-gradient-to-b from-[#eaddb8] to-[#c7e8a4]">
      {/* Background scenery */}
      <div className="absolute inset-0 opacity-40">
        <div className="absolute top-[120px] left-[60px] w-[120px] h-[80px] rounded-full bg-[#a4d8e8]" />
        <div className="absolute bottom-[160px] right-[80px] w-[160px] h-[100px] rounded-full bg-[#a4d8e8]" />
        <div className="absolute top-[300px] right-[200px] w-[60px] h-[60px] rounded-full bg-[#a4e0c7] rotate-12" />
      </div>

      {/* Trail */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <path
          d={PATH_POINTS.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ')}
          fill="none"
          stroke="#bfa86b"
          strokeWidth="24"
          strokeLinecap="round"
          strokeDasharray="8 8"
        />
      </svg>

      {/* Team Tokens (6 teams) */}
      {Object.entries(positions).map(([teamId, tileIndex], idx) => {
        const colors = ['#ff4d4d', '#4d79ff', '#4dff79', '#ffea4d', '#a64dff', '#ff8c4d'];
        const tile = tiles[tileIndex] || tiles[0];
        return (
          <StickmanToken
            key={teamId}
            color={colors[idx % colors.length]}
            x={tile?.x ?? 80}
            y={tile?.y ?? 60}
          />
        );
      })}

      {/* Tiles */}
      {tiles.map((tile) => (
        <div
          key={tile.index}
          className="absolute w-16 h-16 rounded-full border-4 border-[#1a1a2e] flex items-center justify-center text-xs font-bold shadow-lg transition-transform hover:scale-110"
          style={{
            left: `${tile.x - 32}px`,
            top: `${tile.y - 32}px`,
            backgroundColor:
              tile.type === 'start'
                ? '#4dff79'
                : tile.type === 'finish'
                ? '#ff4d4d'
                : tile.type === 'bonus'
                ? '#ffea4d'
                : tile.type === 'penalty'
                ? '#a64dff'
                : '#fff',
          }}
        >
          {tile.index + 1}
        </div>
      ))}
    </div>
  );
}
