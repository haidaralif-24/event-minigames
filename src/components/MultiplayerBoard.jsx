import { useEffect, useMemo, useRef } from 'react';
import { animate, motion, useMotionValue } from 'framer-motion';
import boardTiles from '../data/boardTiles.json';
import { TOKEN_COLORS } from '../data/constants.js';

const TOTAL_TILES = boardTiles.length; // 67
const COLS = 10;
const TILE_SIZE = 64;
const GAP = 18;
const ROWS = Math.ceil(TOTAL_TILES / COLS); // 7
const STEP = TILE_SIZE + GAP;
const PAD = 28;
const GRID_W = COLS * STEP + GAP;
const GRID_H = ROWS * STEP + GAP;
const MAP_W = GRID_W + PAD * 2;
const MAP_H = GRID_H + PAD * 2;
const INK = '#1a1a2e';

// Single source of truth for tile coordinates. Used for BOTH the tile grid
// render loop AND token placement, so they can never drift out of sync.
// Boustrophedon (zigzag) order: row 0 left→right, row 1 right→left, etc.
// Row 0 sits at the bottom; tile 0 = bottom-left (Start), tile 66 = Finish.
function tileCenter(index) {
  const row = Math.floor(index / COLS);
  const colInRow = index % COLS;
  const col = row % 2 === 0 ? colInRow : (COLS - 1 - colInRow);
  const x = PAD + col * STEP + TILE_SIZE / 2;
  const y = PAD + (ROWS - 1 - row) * STEP + TILE_SIZE / 2;
  return { x, y };
}

const tileStyle = {
  start: { fill: '#4dff79', icon: 'S', light: false },
  finish: { fill: '#ff5555', icon: 'F', light: true },
  normal: { fill: '#fffdf5' },
  bonus: { fill: '#ffea4d', icon: '★' },
  challenge: { fill: '#4d79ff', icon: '?', light: true },
  penalty: { fill: '#ff8c4d', icon: '!' },
  checkpoint: { fill: '#a64dff', icon: '⌂', light: true },
};

function TurnArrow({ from, to }) {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const len = 12;
  const spread = Math.PI / 7;
  const a1 = angle + Math.PI - spread;
  const a2 = angle + Math.PI + spread;
  return (
    <g stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <line x1={mx} y1={my} x2={mx - len * Math.cos(a1)} y2={my - len * Math.sin(a1)} />
      <line x1={mx} y1={my} x2={mx - len * Math.cos(a2)} y2={my - len * Math.sin(a2)} />
    </g>
  );
}

function TeamAvatar({ playerIndex, color, playerName, avatar }) {
  const index = playerIndex % 6;
  const clipId = `avatar-clip-${index}`;
  // NOTE: the avatar <image> and its clipPath are deliberately kept OUTSIDE
  // the filter="url(#softShadow)" group below. Chromium/Safari have a known
  // bug where an SVG filter on an ancestor of a clip-path'd raster <image>
  // silently drops the clipped content — that was why avatars weren't
  // rendering on the board. Everything else (badge, shadow, stickman
  // fallback) can safely stay filtered; only the avatar bitmap needs to sit
  // outside that subtree.
  return (
    <g className="select-none pointer-events-none">
      <g filter="url(#softShadow)">
        {/* Ground shadow */}
        <ellipse cy="18" rx="15" ry="5" fill={INK} opacity=".25" />

        {/* Floating Team Badge above avatar */}
        <g transform="translate(0, -42)">
          <rect
            x="-25"
            y="-11"
            width="50"
            height="19"
            rx="9.5"
            fill="#fffdf5"
            stroke="#18233f"
            strokeWidth="2.5"
          />
          <rect
            x="-23"
            y="-9"
            width="15"
            height="15"
            rx="7.5"
            fill={color}
          />
          <text
            x="-15.5"
            y="2"
            textAnchor="middle"
            fontSize="9.5"
            fontWeight="900"
            fill="#fff"
            fontFamily="Nunito, sans-serif"
          >
            {index + 1}
          </text>
          <text
            x="8"
            y="2.5"
            textAnchor="middle"
            fontSize="9"
            fontWeight="900"
            fill="#18233f"
            fontFamily="Nunito, sans-serif"
          >
            {playerName.length > 5 ? playerName.slice(0, 4) + '…' : playerName}
          </text>
        </g>

        {avatar ? (
          <circle cx="0" cy="-8" r="20" fill={color} stroke={INK} strokeWidth="3" />
        ) : (
          <>
            {/* Legs & Shoes */}
            <path
              d="M-5 6v10M5 6v10"
              stroke="#18233f"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <ellipse cx="-6" cy="16" rx="4" ry="2.5" fill="#18233f" />
            <ellipse cx="6" cy="16" rx="4" ry="2.5" fill="#18233f" />

            {/* Body / Outfit */}
            <rect
              x="-9"
              y="-3"
              width="18"
              height="12"
              rx="5"
              fill={color}
              stroke="#18233f"
              strokeWidth="3"
            />
            {/* Arms */}
            <path
              d="M-9 0l-5 6M9 0l5 6"
              stroke="#18233f"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <circle cx="-14" cy="6" r="2.5" fill="#ffe0bd" stroke="#18233f" strokeWidth="1.5" />
            <circle cx="14" cy="6" r="2.5" fill="#ffe0bd" stroke="#18233f" strokeWidth="1.5" />

            {/* Head */}
            <circle
              cy="-14"
              r="12"
              fill="#ffe0bd"
              stroke="#18233f"
              strokeWidth="3"
            />
          </>
        )}
      </g>

      {/* Avatar bitmap sits outside the filtered group on purpose (see note above). */}
      {avatar && (
        <>
          <defs>
            <clipPath id={clipId}>
              <circle cx="0" cy="-8" r="20" />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <image
              href={avatar}
              xlinkHref={avatar}
              x="-20"
              y="-28"
              width="40"
              height="40"
              preserveAspectRatio="xMidYMid slice"
            />
          </g>
          <circle cx="0" cy="-8" r="20" fill="none" stroke={INK} strokeWidth="3" />
        </>
      )}
    </g>
  );
}

function TrailToken({ playerIndex, playerName, color, avatar, offsetX, offsetY, points, tileIndex }) {
  const x = useMotionValue(points[tileIndex].x + offsetX);
  const y = useMotionValue(points[tileIndex].y - 18 + offsetY);
  const progress = useMotionValue(0);
  const previousTile = useRef(tileIndex);

  useEffect(() => {
    const fromPoint = points[previousTile.current];
    const targetPoint = points[tileIndex];
    const fromX = fromPoint.x + offsetX;
    const fromY = fromPoint.y - 18 + offsetY;
    const targetX = targetPoint.x + offsetX;
    const targetY = targetPoint.y - 18 + offsetY;
    const distance = Math.max(1, Math.abs(tileIndex - previousTile.current));
    previousTile.current = tileIndex;

    progress.set(0);
    const controls = animate(progress, 1, {
      duration: distance * 0.175,
      ease: [0.34, 1.32, 0.64, 1],
      onUpdate: () => {
        const p = progress.get();
        const hop = Math.abs(Math.sin(p * Math.PI * distance)) * 26;
        const currentX = fromX + (targetX - fromX) * p;
        const currentY = fromY + (targetY - fromY) * p - hop;
        x.set(currentX);
        y.set(currentY);
      },
      onComplete: () => {
        x.set(targetX);
        y.set(targetY);
      },
    });
    return () => controls.stop();
  }, [tileIndex, points, offsetX, offsetY, progress, x, y]);

  return <motion.g style={{ x, y, opacity: 1 }}><TeamAvatar playerIndex={playerIndex} color={color} playerName={playerName} avatar={avatar} /></motion.g>;
}

export default function MultiplayerBoard({ boardPositions = {}, players = {} }) {
  const points = useMemo(() => Array.from({ length: TOTAL_TILES }, (_, index) => tileCenter(index)), []);
  const trackPath = useMemo(() => points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' '), [points]);
  const playerIds = Object.keys(players).sort();

  return <div className="relative w-full overflow-hidden rounded-[2rem] border-4 border-[#18233f] shadow-2xl" style={{ aspectRatio: `${MAP_W} / ${MAP_H}`, maxHeight: '80vh', background: '#cfeaf6' }}>
    <svg className="h-full w-full" viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Snake board game map">
      <defs>
        <linearGradient id="mp-bg" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#bfe6f7" />
          <stop offset="1" stopColor="#cdeebf" />
        </linearGradient>
        <filter id="softShadow" x="-40%" y="-40%" width="180%" height="200%"><feDropShadow dx="0" dy="6" stdDeviation="4" floodOpacity=".3" /></filter>
      </defs>

      <rect x="0" y="0" width={MAP_W} height={MAP_H} rx="28" fill="url(#mp-bg)" />

      {/* Visual track connecting tile centres, drawn under the tiles. */}
      <path d={trackPath} fill="none" stroke="#cdb48a" strokeWidth="10" strokeLinejoin="round" strokeLinecap="round" opacity=".55" />

      {points.map((point, index) => {
        const tile = boardTiles[index] || { type: 'normal' };
        const style = tileStyle[tile.type] || tileStyle.normal;
        const x = point.x - TILE_SIZE / 2;
        const y = point.y - TILE_SIZE / 2;
        const isEndpoint = tile.type === 'start' || tile.type === 'finish';
        return (
          <g key={index}>
            <rect x={x} y={y} width={TILE_SIZE} height={TILE_SIZE} rx={14} fill={style.fill} stroke={INK} strokeWidth={3.5} filter="url(#softShadow)" />
            {isEndpoint ? (
              <>
                <text x={point.x} y={point.y + 6} textAnchor="middle" fontSize="24" fontWeight="900" fill={style.light ? '#fff' : '#1a1a2e'} fontFamily="Nunito, sans-serif">{style.icon}</text>
                <text x={point.x} y={y + TILE_SIZE + 13} textAnchor="middle" fontSize="10" fontWeight="900" fill={INK} fontFamily="Nunito, sans-serif">{tile.type === 'finish' ? 'FINISH' : 'START'}</text>
              </>
            ) : (
              <text x={point.x} y={point.y + 6} textAnchor="middle" fontSize={style.icon ? 24 : 16} fontWeight="900" fill={style.light ? '#fff' : INK} fontFamily="Nunito, sans-serif">{style.icon || index + 1}</text>
            )}
          </g>
        );
      })}

      {/* Turn-direction chevrons at each row-end where the path reverses. */}
      {points.slice(0, TOTAL_TILES - 1).map((point, index) => (
        Math.floor(index / COLS) !== Math.floor((index + 1) / COLS)
          ? <TurnArrow key={`arrow-${index}`} from={point} to={points[index + 1]} />
          : null
      ))}

      {playerIds.map((playerId, tokenIndex) => {
        const rawPosition = boardPositions[playerId];
        const tileIndex = Math.min(TOTAL_TILES - 1, Math.max(0, Number(rawPosition) || 0));
        const playerIndex = Math.max(0, playerIds.indexOf(playerId));
        const player = players[playerId] || {};
        const playerName = player.name || `P${playerIndex + 1}`;
        const offsetX = ((tokenIndex % 3) - 1) * 22;
        const offsetY = Math.floor(tokenIndex / 3) * 20;
        return (
          <TrailToken
            key={playerId}
            playerIndex={playerIndex}
            playerName={playerName}
            avatar={player.avatar}
            color={TOKEN_COLORS[playerIndex % TOKEN_COLORS.length]}
            offsetX={offsetX}
            offsetY={offsetY}
            points={points}
            tileIndex={tileIndex}
          />
        );
      })}
    </svg>
    <div className="pointer-events-none absolute left-5 top-5 rounded-2xl border-4 border-[#18233f] bg-[#fff8e7]/95 px-4 py-3 shadow-[0_4px_0_#18233f]">
      <p className="text-[10px] font-black uppercase tracking-widest text-[#ff8c4d]">Game Board</p>
      <p className="font-display text-lg text-[#18233f]">{TOTAL_TILES} tiles · 6 players</p>
    </div>
    <div className="pointer-events-none absolute right-5 top-5 flex flex-col gap-1.5 rounded-2xl border-4 border-[#18233f] bg-[#fff8e7]/95 p-3 shadow-[0_4px_0_#18233f]">
      {playerIds.map((playerId, index) => {
        const player = players[playerId] || {};
        const rawPosition = boardPositions[playerId];
        const tile = Math.min(TOTAL_TILES - 1, Math.max(0, Number(rawPosition) || 0)) + 1;
        return (
          <div key={playerId} className="flex items-center gap-2">
            {player.avatar ? (
              <img src={player.avatar} alt={player.name} className="h-8 w-8 rounded-full border-2 border-[#18233f] object-cover" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#18233f] text-xs font-black text-white" style={{ backgroundColor: TOKEN_COLORS[index % TOKEN_COLORS.length] }}>{index + 1}</span>
            )}
            <span className="text-sm font-black text-[#18233f]">{player.name || `P${index + 1}`}</span>
            <span className="ml-auto pl-2 text-xs font-extrabold text-[#7a8395]">Tile {tile}</span>
          </div>
        );
      })}
    </div>
  </div>;
}
