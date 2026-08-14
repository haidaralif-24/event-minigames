import { useMemo, useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import boardTiles from '../data/boardTiles.json';
import { TEAM_COLORS } from '../data/constants';

const TOTAL_TILES = 67;
const MAP_WIDTH = 2240;
const MAP_HEIGHT = 1300;
const MIN_ZOOM = 0.85;
const MAX_ZOOM = 3.2;

const OUTLINE = '#1a1a2e';
const ASPECT = 1.6;

const PATH_POINTS = [
  { x: 180, y: 1000 }, { x: 250, y: 840 }, { x: 210, y: 660 },
  { x: 310, y: 500 }, { x: 470, y: 410 }, { x: 660, y: 440 },
  { x: 790, y: 570 }, { x: 840, y: 750 }, { x: 780, y: 920 },
  { x: 910, y: 1050 }, { x: 1110, y: 1070 }, { x: 1300, y: 1010 },
  { x: 1440, y: 880 }, { x: 1470, y: 700 }, { x: 1410, y: 540 },
  { x: 1300, y: 420 }, { x: 1400, y: 280 }, { x: 1590, y: 210 },
  { x: 1780, y: 260 }, { x: 1910, y: 380 }, { x: 1940, y: 550 },
  { x: 1880, y: 700 }, { x: 1950, y: 850 }, { x: 2060, y: 1000 },
  { x: 2160, y: 1130 },
];

const TYPE_STYLE = {
  start: { fill: '#45f27b', icon: 'S' },
  finish: { fill: '#ff5555', icon: 'F' },
  normal: { fill: '#fffdf5', icon: null },
  bonus: { fill: '#ffea4d', icon: '★' },
  challenge: { fill: '#4d79ff', icon: '?', light: true },
  penalty: { fill: '#ff8c4d', icon: '!' },
  checkpoint: { fill: '#a64dff', icon: '⌂', light: true },
};

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
  const segment = BOARD_PATH.segments.find(({ start, length }) => d <= start + length) || BOARD_PATH.segments.at(-1);
  const t = segment.length === 0 ? 0 : (d - segment.start) / segment.length;
  return {
    x: segment.a.x + (segment.b.x - segment.a.x) * t,
    y: segment.a.y + (segment.b.y - segment.a.y) * t,
  };
}

function buildTilePositions(total) {
  return Array.from({ length: total }, (_, index) =>
    pointAtDistance(total <= 1 ? 0 : (index / (total - 1)) * BOARD_PATH.totalLength),
  );
}

function catmullRom(pts) {
  let d = '';
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    if (i === 0) d += `M ${p1.x} ${p1.y} `;
    d += `C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y} `;
  }
  return d;
}

function blobPoints(cx, cy, r0, n, phase, aspect = ASPECT) {
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    const jitter = 1 + 0.1 * Math.sin(a * 3 + phase) + 0.05 * Math.sin(a * 5 + phase * 1.7);
    const r = r0 * jitter;
    pts.push({ x: cx + r * Math.cos(a) * aspect, y: cy + r * Math.sin(a) });
  }
  return pts;
}

function smoothBlob(points) {
  const first = points[0];
  const last = points[points.length - 1];
  let d = `M ${(first.x + last.x) / 2} ${(first.y + last.y) / 2} `;
  for (let i = 0; i < points.length; i += 1) {
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    const mx = (curr.x + next.x) / 2;
    const my = (curr.y + next.y) / 2;
    d += `Q ${curr.x} ${curr.y}, ${mx} ${my} `;
  }
  return `${d}Z`;
}

function Palm({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="4" rx="16" ry="5" fill={OUTLINE} opacity=".18" />
      <path d="M0 0C-4 -22 2 -40 -6 -58" fill="none" stroke="#8a5a32" strokeWidth="7" strokeLinecap="round" />
      <g transform="translate(-6 -58)">
        <path d="M0 0C-22 -6 -34 -18 -38 -30C-24 -22 -10 -14 0 0Z" fill="#4bab4c" stroke={OUTLINE} strokeWidth="2.5" />
        <path d="M0 0C20 -8 30 -20 32 -34C20 -24 8 -14 0 0Z" fill="#3f9142" stroke={OUTLINE} strokeWidth="2.5" />
        <path d="M0 0C-14 -20 -12 -34 0 -46C10 -34 12 -20 0 0Z" fill="#4bab4c" stroke={OUTLINE} strokeWidth="2.5" />
        <circle cx="3" cy="4" r="4" fill="#8a5a32" stroke={OUTLINE} strokeWidth="1.5" />
      </g>
    </g>
  );
}

function Tree({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="26" rx="15" ry="6" fill={OUTLINE} opacity=".18" />
      <path d="M-4 24h8l-1-30h-6z" fill="#8a5a32" stroke={OUTLINE} strokeWidth="2" />
      <circle cx="0" cy="-14" r="20" fill="#3f9142" stroke={OUTLINE} strokeWidth="3" />
      <circle cx="-10" cy="-24" r="13" fill="#4bab4c" stroke={OUTLINE} strokeWidth="3" />
      <circle cx="11" cy="-22" r="14" fill="#4bab4c" stroke={OUTLINE} strokeWidth="3" />
    </g>
  );
}

function Bush({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="9" rx="31" ry="8" fill={OUTLINE} opacity=".22" />
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
      <ellipse cx="0" cy="9" rx="17" ry="5" fill={OUTLINE} opacity=".16" />
      <path d="M-14 7L-10-7 0-13 13-6 10 7Z" fill="#9aa79b" stroke={OUTLINE} strokeWidth="2.5" />
    </g>
  );
}

function Flower({ x, y, color }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle cx="0" cy="0" r="4" fill={color} stroke={OUTLINE} strokeWidth="1.5" />
    </g>
  );
}

function Hut({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="18" rx="24" ry="6" fill={OUTLINE} opacity=".18" />
      <rect x="-14" y="-2" width="28" height="20" fill="#e0c179" stroke={OUTLINE} strokeWidth="2.5" />
      <path d="M-18-2L0-22 18-2Z" fill="#c9673d" stroke={OUTLINE} strokeWidth="2.5" />
    </g>
  );
}

function Dock({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-10" y="-70" width="16" height="110" fill="#8a5a32" stroke={OUTLINE} strokeWidth="3" />
      <path d="M-40 30C-10 50 30 50 55 25C45 45 5 65 -40 30Z" fill="#c9673d" stroke={OUTLINE} strokeWidth="3" />
      <path d="M-2 -66L52 -20L-2 -8Z" fill="#fff8e7" stroke={OUTLINE} strokeWidth="3" />
    </g>
  );
}

function Castle({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`} filter="url(#softShadow)">
      <circle cx="0" cy="8" r="112" fill="#ffdf62" opacity=".18" />
      <circle cx="0" cy="0" r="98" fill="url(#peakGrad)" stroke="#5a3a20" strokeWidth="7" />
      <circle cx="0" cy="0" r="84" fill="none" stroke="#ffe36b" strokeWidth="6" strokeDasharray="10 12" opacity=".9" />
      <path d="M-70-78L-42-105 0-118 42-105 70-78" fill="none" stroke="#fff3a6" strokeWidth="7" strokeLinecap="round" opacity=".95" />
      <rect x="-31" y="-62" width="62" height="66" rx="4" fill="#f5ead0" stroke={OUTLINE} strokeWidth="4" />
      <path d="M-38-62L0-102 38-62Z" fill="#d94848" stroke={OUTLINE} strokeWidth="4" />
      <path d="M-35-62V-78H-16V-62M16-62V-78H35V-62" fill="#d94848" stroke={OUTLINE} strokeWidth="4" />
      <rect x="-9" y="-30" width="18" height="34" rx="8" fill="#5a3a20" stroke={OUTLINE} strokeWidth="2.5" />
      <path d="M0-102V-135" stroke={OUTLINE} strokeWidth="4" strokeLinecap="round" />
      <path d="M0-134L34-124 0-110Z" fill="#ff5555" stroke={OUTLINE} strokeWidth="2.5" />
      <circle cx="-58" cy="-88" r="7" fill="#fff3a6" stroke={OUTLINE} strokeWidth="2" />
      <circle cx="58" cy="-88" r="7" fill="#fff3a6" stroke={OUTLINE} strokeWidth="2" />
      <path d="M-112 18C-78 34-48 39-18 35M112 18C78 34 48 39 18 35" fill="none" stroke="#fff3a6" strokeWidth="6" strokeLinecap="round" opacity=".9" />
    </g>
  );
}

function Stickman({ color, x, y }) {
  return (
    <g transform={`translate(${x} ${y})`} filter="url(#softShadow)">
      <ellipse cx="0" cy="24" rx="13" ry="4" fill={OUTLINE} opacity=".22" />
      <path d="M0 2v14M-8 8h16M0 16l-8 9M0 16l8 9" stroke={OUTLINE} strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="0" cy="-8" r="10" fill={color} stroke={OUTLINE} strokeWidth="3.5" />
      <circle cx="-3.4" cy="-9" r="1.6" fill={OUTLINE} />
      <circle cx="3.4" cy="-9" r="1.6" fill={OUTLINE} />
      <path d="M-3 -4.5C-1 -3 1 -3 3 -4.5" fill="none" stroke={OUTLINE} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

export default function Board() {
  const [positions, setPositions] = useState({});
  const [zoom, setZoom] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const viewportRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'gameState', 'current'), (snap) => {
      if (snap.exists() && snap.data().boardPositions) setPositions(snap.data().boardPositions);
    });
    return unsub;
  }, []);

  const clampPan = (nextPan, nextScale) => {
    const scaledWidth = MAP_WIDTH * nextScale;
    const scaledHeight = MAP_HEIGHT * nextScale;
    const x = scaledWidth <= viewport.width
      ? (viewport.width - scaledWidth) / 2
      : Math.min(0, Math.max(viewport.width - scaledWidth, nextPan.x));
    const y = scaledHeight <= viewport.height
      ? (viewport.height - scaledHeight) / 2
      : Math.min(0, Math.max(viewport.height - scaledHeight, nextPan.y));
    return { x, y };
  };

  useEffect(() => {
    if (!viewportRef.current) return undefined;
    const updateViewport = () => {
      const rect = viewportRef.current.getBoundingClientRect();
      setViewport({ width: rect.width, height: rect.height });
      const nextFit = Math.min(rect.width / MAP_WIDTH, rect.height / MAP_HEIGHT) * 0.98;
      setFitScale(Math.max(nextFit, 0.1));
      setPan(clampPan(pan, nextFit * zoom));
    };
    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [zoom]);

  const effectiveScale = fitScale * zoom;

  const zoomAt = (nextZoom, clientX, clientY) => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    const oldScale = effectiveScale;
    const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    const nextScale = fitScale * clampedZoom;
    const mapX = (cx - pan.x) / oldScale;
    const mapY = (cy - pan.y) / oldScale;
    const nextPan = { x: cx - mapX * nextScale, y: cy - mapY * nextScale };
    setZoom(clampedZoom);
    setPan(clampPan(nextPan, nextScale));
  };

  const handleWheel = (event) => {
    event.preventDefault();
    const nextZoom = zoom * Math.exp(-event.deltaY * 0.0015);
    zoomAt(nextZoom, event.clientX, event.clientY);
  };

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, pan };
    setIsDragging(true);
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    setPan(clampPan({ x: dragRef.current.pan.x + dx, y: dragRef.current.pan.y + dy }, effectiveScale));
  };

  const stopDragging = () => {
    dragRef.current = null;
    setIsDragging(false);
  };

  const resetView = () => {
    setZoom(1);
    setPan(clampPan({ x: 0, y: 0 }, fitScale));
  };

  const tiles = useMemo(() => {
    const source = boardTiles.slice(0, TOTAL_TILES);
    const tilePositions = buildTilePositions(TOTAL_TILES);
    return source.map((tile, index) => ({ ...tile, index, ...tilePositions[index] }));
  }, []);

  const trailPath = useMemo(() => catmullRom(PATH_POINTS), []);
  // Keep the island fully inside the map bounds so its coastline is not clipped by the SVG viewport.
  const sandPath = useMemo(() => smoothBlob(blobPoints(1120, 650, 620, 26, 0.4)), []);
  const grassPath = useMemo(() => smoothBlob(blobPoints(1120, 650, 580, 26, 1.1)), []);
  const wavePaths = useMemo(
    () => Array.from({ length: Math.ceil((1280 - 760) / 70) + 1 }, (_, i) => {
      const r = 760 + i * 70;
      return smoothBlob(blobPoints(1120, 650, r, 40, r * 0.02)).replace('Z', '');
    }),
    [],
  );

  const startTile = tiles[0];
  const finishTile = tiles[TOTAL_TILES - 1];

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#2c8fae] select-none">
      <div
        ref={viewportRef}
        className="absolute inset-0 overflow-hidden"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onDoubleClick={(event) => zoomAt(zoom * 1.35, event.clientX, event.clientY)}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      >
        <svg
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          aria-label="Illustrated adventure island board"
          style={{
            position: 'absolute', left: 0, top: 0,
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${effectiveScale})`,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
        >
          <defs>
            <linearGradient id="oceanGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3aa8c9" /><stop offset="1" stopColor="#1f7a9c" />
            </linearGradient>
            <linearGradient id="sandGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f2dfa0" /><stop offset="1" stopColor="#e0c179" />
            </linearGradient>
            <linearGradient id="grassGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#c7e8a4" /><stop offset="1" stopColor="#8fc85e" />
            </linearGradient>
            <linearGradient id="trailGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f5e2ac" /><stop offset="1" stopColor="#c99a55" />
            </linearGradient>
            <radialGradient id="peakGrad" cx=".35" cy=".3" r=".8">
              <stop offset="0" stopColor="#c98a5b" /><stop offset="1" stopColor="#8a5a35" />
            </radialGradient>
            <filter id="softShadow" x="-40%" y="-40%" width="180%" height="200%">
              <feDropShadow dx="0" dy="6" stdDeviation="4" floodOpacity=".3" />
            </filter>
            <filter id="tileShadow" x="-30%" y="-30%" width="160%" height="170%">
              <feDropShadow dx="0" dy="5" stdDeviation="3" floodOpacity=".28" />
            </filter>
          </defs>

          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#oceanGrad)" />
          {wavePaths.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.12" />
          ))}

          <path d={sandPath} fill="url(#sandGrad)" stroke="#8a6a3a" strokeWidth="6" filter="url(#softShadow)" />
          <path d={grassPath} fill="url(#grassGrad)" stroke="#5f9c3f" strokeWidth="5" />

          <Palm x={120} y={200} scale={1.6} />
          <Palm x={300} y={150} scale={1.7} />
          <Tree x={560} y={150} scale={1.5} />
          <Palm x={1000} y={120} scale={1.4} />
          <Tree x={1700} y={150} scale={1.6} />
          <Palm x={2050} y={150} scale={1.7} />
          <Tree x={130} y={560} scale={1.5} />
          <Tree x={130} y={780} scale={1.4} />
          <Rock x={330} y={560} scale={1.3} />
          <Tree x={150} y={1180} scale={1.7} />
          <Palm x={1080} y={1200} scale={1.5} />
          <Bush x={1050} y={660} scale={1.6} />
          <Tree x={2180} y={650} scale={1.6} />
          <Rock x={1660} y={860} scale={1.4} />
          <Flower x={260} y={300} color="#ffea4d" />
          <Flower x={600} y={300} color="#ff4da6" />
          <Flower x={960} y={250} color="#ffea4d" />
          <Flower x={1220} y={820} color="#a64dff" />
          <Flower x={1540} y={1040} color="#ff4da6" />
          <Flower x={1840} y={180} color="#4d79ff" />

          {tiles.filter((t) => t.type === 'checkpoint').map((ct) => (
            <Hut key={`hut-${ct.index}`} x={ct.x} y={ct.y - 46} scale={1.3} />
          ))}

          <path d={trailPath} fill="none" stroke="#8b6b38" strokeWidth="30" strokeLinecap="round" opacity=".28" />
          <path d={trailPath} fill="none" stroke="url(#trailGrad)" strokeWidth="22" strokeLinecap="round" />
          <path d={trailPath} fill="none" stroke="#fff6df" strokeWidth="5" strokeLinecap="round" strokeDasharray="1 20" opacity=".85" />

          <Castle x={finishTile.x - 10} y={finishTile.y - 155} />

          {tiles.map((tile) => {
            const style = TYPE_STYLE[tile.type] || TYPE_STYLE.normal;
            const isStart = tile.index === 0;
            const isFinish = tile.index === TOTAL_TILES - 1;
            const size = isStart ? 66 : isFinish ? 82 : 34;
            return (
              <g key={tile.index} transform={`translate(${tile.x} ${tile.y})`} filter="url(#tileShadow)">
                {isStart && (
                  <>
                    <circle cx="0" cy="0" r="58" fill="#45f27b" opacity=".22" />
                    <circle cx="0" cy="0" r="50" fill="none" stroke="#fff8e7" strokeWidth="5" strokeDasharray="8 7" />
                  </>
                )}
                {isFinish && (
                  <>
                    <circle cx="0" cy="0" r="70" fill="#ffe36b" opacity=".34" />
                    <circle cx="0" cy="0" r="57" fill="none" stroke="#fff3a6" strokeWidth="6" strokeDasharray="10 8" />
                    <path d="M-44-58L-66-80M44-58L66-80" stroke="#fff3a6" strokeWidth="6" strokeLinecap="round" />
                    <text x="-72" y="-82" textAnchor="middle" fontSize="22" fontWeight="900" fill="#ffea4d" stroke={OUTLINE} strokeWidth="2" paintOrder="stroke" fontFamily="Fredoka One, cursive">★</text>
                    <text x="72" y="-82" textAnchor="middle" fontSize="22" fontWeight="900" fill="#ffea4d" stroke={OUTLINE} strokeWidth="2" paintOrder="stroke" fontFamily="Fredoka One, cursive">★</text>
                  </>
                )}
                <rect x={-size / 2} y={-size / 2} width={size} height={size} rx={isStart || isFinish ? 20 : 10} fill={style.fill} stroke={OUTLINE} strokeWidth={isStart || isFinish ? 5 : 3.5} />
                {isStart ? (
                  <>
                    <text x="0" y="8" textAnchor="middle" fontSize="31" fontWeight="900" fill={OUTLINE} fontFamily="Fredoka One, cursive">1</text>
                    <text x="0" y="51" textAnchor="middle" fontSize="12" fontWeight="900" fill={OUTLINE} fontFamily="Nunito, sans-serif">START</text>
                  </>
                ) : isFinish ? (
                  <>
                    <text x="0" y="11" textAnchor="middle" fontSize="31" fontWeight="900" fill="#fff8e7" stroke={OUTLINE} strokeWidth="1.5" paintOrder="stroke" fontFamily="Fredoka One, cursive">67</text>
                    <text x="0" y="53" textAnchor="middle" fontSize="13" fontWeight="900" fill={OUTLINE} fontFamily="Nunito, sans-serif">FINISH</text>
                  </>
                ) : style.icon ? (
                  <text x="0" y="5" textAnchor="middle" fontSize="16" fontWeight={900} fill={style.light ? '#fff' : OUTLINE} fontFamily="Fredoka One, cursive">{style.icon}</text>
                ) : (
                  <text x="0" y="4" textAnchor="middle" fontSize={11} fontWeight={900} fill={OUTLINE} fontFamily="Nunito, sans-serif">{tile.index + 1}</text>
                )}
              </g>
            );
          })}

          <Dock x={startTile.x + 70} y={startTile.y + 30} />

          {Object.entries(positions).map(([teamId, tileIndex], idx) => {
            const tile = tiles[tileIndex] || tiles[0];
            const offset = idx % 2 === 0 ? -16 : 16;
            return (
              <Stickman
                key={teamId}
                color={TEAM_COLORS[idx % TEAM_COLORS.length]}
                x={tile.x + offset}
                y={tile.y - 30}
              />
            );
          })}
        </svg>
      </div>

      <div className="pointer-events-none absolute left-5 top-5 z-20 flex flex-col gap-2">
        <div className="rounded-2xl border-[3px] border-[#1a1a2e] bg-[#fff8e7] px-4 py-2 shadow-[0_4px_0_#1a1a2e]">
          <h1 className="font-display text-lg text-[#1a1a2e]">Adventure Island</h1>
          <p className="text-[11px] font-bold text-[#5b5470]">Race to the castle · {TOTAL_TILES} tiles</p>
        </div>
        <div className="rounded-2xl border-[3px] border-[#1a1a2e] bg-[#fff8e7] px-4 py-3 shadow-[0_4px_0_#1a1a2e]">
          <h2 className="mb-1 font-display text-xs text-[#1a1a2e]">Tile key</h2>
          <div className="flex flex-col gap-1.5 text-[11px] font-bold text-[#1a1a2e]">
            <div className="flex items-center gap-2"><span className="flex h-[18px] w-[18px] items-center justify-center rounded-md border-[2.5px] border-[#1a1a2e] bg-[#45f27b] text-[10px]">S</span> Start</div>
            <div className="flex items-center gap-2"><span className="flex h-[18px] w-[18px] items-center justify-center rounded-md border-[2.5px] border-[#1a1a2e] bg-[#fffdf5] text-[10px]">·</span> Trail</div>
            <div className="flex items-center gap-2"><span className="flex h-[18px] w-[18px] items-center justify-center rounded-md border-[2.5px] border-[#1a1a2e] bg-[#ffea4d] text-[10px]">★</span> Bonus</div>
            <div className="flex items-center gap-2"><span className="flex h-[18px] w-[18px] items-center justify-center rounded-md border-[2.5px] border-[#1a1a2e] bg-[#4d79ff] text-[10px] text-white">?</span> Challenge</div>
            <div className="flex items-center gap-2"><span className="flex h-[18px] w-[18px] items-center justify-center rounded-md border-[2.5px] border-[#1a1a2e] bg-[#ff8c4d] text-[10px]">!</span> Trap</div>
            <div className="flex items-center gap-2"><span className="flex h-[18px] w-[18px] items-center justify-center rounded-md border-[2.5px] border-[#1a1a2e] bg-[#a64dff] text-[10px] text-white">⌂</span> Checkpoint</div>
            <div className="flex items-center gap-2"><span className="flex h-[18px] w-[18px] items-center justify-center rounded-md border-[2.5px] border-[#1a1a2e] bg-[#ff5555] text-[10px]">F</span> Finish</div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-5 left-5 z-20 flex items-center gap-2 rounded-2xl border-[3px] border-[#1a1a2e] bg-[#fff8e7] p-2 shadow-[0_4px_0_#1a1a2e]">
        <button onClick={(e) => zoomAt(zoom * 1.25, e.clientX, e.clientY)} className="h-10 w-10 rounded-xl border-[3px] border-[#1a1a2e] bg-white text-xl font-black hover:bg-[#ffea4d]" aria-label="Zoom in">+</button>
        <div className="min-w-14 text-center text-sm font-black text-[#1a1a2e]">{Math.round(zoom * 100)}%</div>
        <button onClick={(e) => zoomAt(zoom / 1.25, e.clientX, e.clientY)} className="h-10 w-10 rounded-xl border-[3px] border-[#1a1a2e] bg-white text-xl font-black hover:bg-[#ffea4d]" aria-label="Zoom out">−</button>
        <button onClick={resetView} className="h-10 rounded-xl border-[3px] border-[#1a1a2e] bg-white px-3 text-xs font-black hover:bg-[#ffea4d]">Reset</button>
      </div>

      <div className="pointer-events-none absolute bottom-5 right-5 z-20 rounded-xl border-[2px] border-[#1a1a2e] bg-[#fff8e7]/90 px-3 py-2 text-xs font-bold text-[#1a1a2e] backdrop-blur">
        Drag to explore · Scroll to zoom · Double-click to zoom
      </div>
    </div>
  );
}
