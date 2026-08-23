import { useMemo } from 'react';
import boardTiles from '../data/boardTiles.json';
import { TOKEN_COLORS } from '../data/constants.js';

const TOTAL_TILES = boardTiles.length;
const COLS = 10;
const TILE_SIZE = 64;
const GAP = 18;
const ROWS = Math.ceil(TOTAL_TILES / COLS);
const STEP = TILE_SIZE + GAP;
const PAD = 28;
const GRID_W = COLS * STEP + GAP;
const GRID_H = ROWS * STEP + GAP;
const MAP_W = GRID_W + PAD * 2;
const MAP_H = GRID_H + PAD * 2;
const INK = '#1a1a2e';

// The board is a serpentine path: tile 1 is the bottom-left tile, then the
// numbering runs left-to-right on the next row, right-to-left on the row above,
// and so on. The exact same coordinate is used for tiles and player tokens.
function tileCenter(index) {
  const safeIndex = Math.min(TOTAL_TILES - 1, Math.max(0, Number(index) || 0));
  const row = Math.floor(safeIndex / COLS);
  const colInRow = safeIndex % COLS;
  const col = row % 2 === 0 ? colInRow : COLS - 1 - colInRow;
  return {
    x: PAD + col * STEP + TILE_SIZE / 2,
    y: PAD + (ROWS - 1 - row) * STEP + TILE_SIZE / 2,
  };
}

function normalizeTileIndex(position) {
  return Math.min(TOTAL_TILES - 1, Math.max(0, Number(position) || 0));
}

const tileStyle = {
  start: { fill: '#4dff79', icon: 'S' },
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
  const clipId = `avatar-clip-${playerIndex}`;
  const shortName = playerName.length > 7 ? `${playerName.slice(0, 6)}…` : playerName;

  return (
    <g className="select-none pointer-events-none">
      <ellipse cy="25" rx="18" ry="6" fill={INK} opacity=".22" />

      {avatar ? (
        <>
          <circle r="22" fill={color} stroke={INK} strokeWidth="3" />
          <defs>
            <clipPath id={clipId}>
              <circle r="19" />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <image
              href={avatar}
              xlinkHref={avatar}
              x="-19"
              y="-19"
              width="38"
              height="38"
              preserveAspectRatio="xMidYMid slice"
            />
          </g>
          <circle r="19" fill="none" stroke="#fffdf5" strokeWidth="2" />
        </>
      ) : (
        <>
          <path d="M-7 8v15M7 8v15" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="-8" cy="24" rx="5" ry="2.5" fill={INK} />
          <ellipse cx="8" cy="24" rx="5" ry="2.5" fill={INK} />
          <rect x="-11" y="-1" width="22" height="15" rx="6" fill={color} stroke={INK} strokeWidth="3" />
          <path d="M-11 2l-7 7M11 2l7 7" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="-18" cy="9" r="2.5" fill="#ffe0bd" stroke={INK} strokeWidth="1.5" />
          <circle cx="18" cy="9" r="2.5" fill="#ffe0bd" stroke={INK} strokeWidth="1.5" />
          <circle cy="-13" r="13" fill="#ffe0bd" stroke={INK} strokeWidth="3" />
        </>
      )}

      <g transform="translate(0,-48)">
        <rect x="-30" y="-11" width="60" height="20" rx="10" fill="#fffdf5" stroke="#18233f" strokeWidth="2.5" />
        <circle cx="-20" cy="-1" r="7" fill={color} />
        <text x="-20" y="2.5" textAnchor="middle" fontSize="8" fontWeight="900" fill="#fff" fontFamily="Nunito, sans-serif">{playerIndex + 1}</text>
        <text x="7" y="2.5" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#18233f" fontFamily="Nunito, sans-serif">{shortName}</text>
      </g>
    </g>
  );
}

function TrailToken({ playerIndex, playerName, color, avatar, offsetX, offsetY, target }) {
  // Framer Motion's x/y props on an SVG <g> can be affected by CSS/SVG
  // transform-origin behavior. Use the SVG transform attribute directly so
  // the token origin is exactly the same point used to draw the tile.
  return (
    <g transform={`translate(${target.x + offsetX} ${target.y + offsetY})`}>
      <TeamAvatar playerIndex={playerIndex} color={color} playerName={playerName} avatar={avatar} />
    </g>
  );
}

export default function MultiplayerBoard({ boardPositions = {}, players = {} }) {
  const points = useMemo(
    () => Array.from({ length: TOTAL_TILES }, (_, index) => tileCenter(index)),
    [],
  );
  const trackPath = useMemo(
    () => points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' '),
    [points],
  );
  const playerIds = Object.keys(players).sort();

  return (
    <div
      className="relative w-full overflow-hidden rounded-[2rem] border-4 border-[#18233f] shadow-2xl"
      style={{ aspectRatio: `${MAP_W} / ${MAP_H}`, maxHeight: '80vh', background: '#cfeaf6' }}
    >
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Snake board game map"
      >
        <defs>
          <linearGradient id="mp-bg" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#bfe6f7" />
            <stop offset="1" stopColor="#cdeebf" />
          </linearGradient>
          <filter id="softShadow" x="-40%" y="-40%" width="180%" height="200%">
            <feDropShadow dx="0" dy="6" stdDeviation="4" floodOpacity=".3" />
          </filter>
        </defs>

        <rect x="0" y="0" width={MAP_W} height={MAP_H} rx="28" fill="url(#mp-bg)" />
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
                  <text x={point.x} y={point.y + 6} textAnchor="middle" fontSize="24" fontWeight="900" fill={style.light ? '#fff' : INK} fontFamily="Nunito, sans-serif">{style.icon}</text>
                  <text x={point.x} y={y + TILE_SIZE + 13} textAnchor="middle" fontSize="10" fontWeight="900" fill={INK} fontFamily="Nunito, sans-serif">{tile.type === 'finish' ? 'FINISH' : 'START'}</text>
                </>
              ) : (
                <text x={point.x} y={point.y + 6} textAnchor="middle" fontSize={style.icon ? 24 : 16} fontWeight="900" fill={style.light ? '#fff' : INK} fontFamily="Nunito, sans-serif">{style.icon || index + 1}</text>
              )}
            </g>
          );
        })}

        {points.slice(0, TOTAL_TILES - 1).map((point, index) => (
          Math.floor(index / COLS) !== Math.floor((index + 1) / COLS)
            ? <TurnArrow key={`arrow-${index}`} from={point} to={points[index + 1]} />
            : null
        ))}

        {playerIds.map((playerId, tokenIndex) => {
          const tileIndex = normalizeTileIndex(boardPositions[playerId]);
          const playerIndex = Math.max(0, playerIds.indexOf(playerId));
          const player = players[playerId] || {};
          const offsetX = ((tokenIndex % 3) - 1) * 18;
          const offsetY = Math.floor(tokenIndex / 3) * 18;
          return (
            <TrailToken
              key={playerId}
              playerIndex={playerIndex}
              playerName={player.name || `P${playerIndex + 1}`}
              avatar={player.avatar}
              color={TOKEN_COLORS[playerIndex % TOKEN_COLORS.length]}
              offsetX={offsetX}
              offsetY={offsetY}
              target={points[tileIndex]}
            />
          );
        })}
      </svg>

      <div className="pointer-events-none absolute right-5 top-5 flex max-w-[300px] flex-col gap-1.5 rounded-2xl border-4 border-[#18233f] bg-[#fff8e7]/95 p-3 shadow-[0_4px_0_#18233f]">
        {playerIds.map((playerId, index) => {
          const player = players[playerId] || {};
          const tileIndex = normalizeTileIndex(boardPositions[playerId]);
          return (
            <div key={playerId} className="flex items-center gap-2">
              {player.avatar ? (
                <img src={player.avatar} alt={player.name} className="h-8 w-8 rounded-full border-2 border-[#18233f] object-cover" />
              ) : (
                <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#18233f] text-xs font-black text-white" style={{ backgroundColor: TOKEN_COLORS[index % TOKEN_COLORS.length] }}>{index + 1}</span>
              )}
              <span className="text-sm font-black text-[#18233f]">{player.name || `P${index + 1}`}</span>
              <span className="ml-auto pl-2 text-xs font-extrabold text-[#7a8395]">Tile {tileIndex + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
