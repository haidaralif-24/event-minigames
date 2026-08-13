import { useMemo, useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import boardTiles from '../data/boardTiles.json';

const TOTAL_TILES = 68;
const MAP_WIDTH = 2240;
const MAP_HEIGHT = 1300;
const MIN_ZOOM = 0.85;
const MAX_ZOOM = 3.2;

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

function Tree({ x, y, scale = 1 }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse cx="0" cy="26" rx="25" ry="8" fill="#315d2d" opacity=".25" />
    <path d="M-6 25h12l-2-27h-8z" fill="#75502e" />
    <path d="M0-62C-28-38-28-10-12 2H12C28-10 28-38 0-62Z" fill="#2f6d3b" stroke="#23572f" strokeWidth="2" />
    <path d="M0-42C-20-23-20-3-9 9H9C20-3 20-23 0-42Z" fill="#4e8c42" />
    <path d="M0-25C-12-11-12 3-5 11H5C12 3 12-11 0-25Z" fill="#6da34d" />
  </g>;
}

function Bush({ x, y, scale = 1 }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse cx="0" cy="9" rx="31" ry="8" fill="#315d2d" opacity=".22" />
    <circle cx="-18" cy="0" r="15" fill="#4b873d" /><circle cx="0" cy="-8" r="19" fill="#629b47" />
    <circle cx="18" cy="1" r="15" fill="#3f7b38" /><circle cx="-5" cy="-11" r="5" fill="#86b95d" />
  </g>;
}

function Rock({ x, y, scale = 1 }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse cx="0" cy="9" rx="25" ry="7" fill="#315d2d" opacity=".2" />
    <path d="M-20 8L-15-9 0-18 19-8 15 8Z" fill="#879688" stroke="#647264" strokeWidth="2" />
    <path d="M-9-7L1-13 9-7" fill="none" stroke="#c0c9bd" strokeWidth="3" opacity=".8" />
  </g>;
}

function Flower({ x, y }) {
  return <g transform={`translate(${x} ${y})`}>
    <path d="M0 0v13" stroke="#4d873e" strokeWidth="2" />
    <circle cx="0" cy="-2" r="4" fill="#ffd84d" /><circle cx="-5" cy="-3" r="4" fill="#fff5df" />
    <circle cx="5" cy="-3" r="4" fill="#fff5df" /><circle cx="0" cy="-8" r="4" fill="#fff5df" />
  </g>;
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

  const trailPath = PATH_POINTS.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const colors = ['#ff4d4d', '#4d79ff', '#4dff79', '#ffea4d', '#a64dff', '#ff8c4d'];

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#6fa53e] select-none">
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
          aria-label="Illustrated adventure board"
          style={{
            position: 'absolute', left: 0, top: 0,
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${effectiveScale})`,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
        >
          <defs>
            <linearGradient id="meadow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b8d96b" /><stop offset="1" stopColor="#79ad43" /></linearGradient>
            <linearGradient id="water" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#63d1df" /><stop offset="1" stopColor="#258ea8" /></linearGradient>
            <linearGradient id="trail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#efd494" /><stop offset="1" stopColor="#bf8d48" /></linearGradient>
            <pattern id="grassTexture" width="44" height="44" patternUnits="userSpaceOnUse">
              <circle cx="7" cy="9" r="2" fill="#4c873b" opacity=".22" /><circle cx="30" cy="31" r="2" fill="#e6eeaa" opacity=".25" />
              <path d="M17 22l3-6m0 6l-3-3M35 12l3-6m0 6l-3-3" stroke="#4c873b" strokeWidth="2" opacity=".25" />
            </pattern>
            <filter id="tileShadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="5" stdDeviation="3" floodOpacity=".28" /></filter>
          </defs>

          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#meadow)" />
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#grassTexture)" />

          <g transform="scale(2)">
            <path d="M185 220C235 170 350 180 390 245C420 295 390 360 330 385C255 415 170 370 165 305C160 270 170 240 185 220Z" fill="#236f82" opacity=".3" />
            <path d="M195 215C245 180 340 190 375 245C400 285 375 345 325 370C265 395 185 355 180 300C177 265 182 235 195 215Z" fill="url(#water)" stroke="#397987" strokeWidth="7" />
            <path d="M395 155C430 205 425 250 410 300C395 350 420 395 470 430C515 462 550 470 605 480" fill="none" stroke="#216f83" strokeWidth="36" opacity=".35" />
            <path d="M395 155C430 205 425 250 410 300C395 350 420 395 470 430C515 462 550 470 605 480" fill="none" stroke="url(#water)" strokeWidth="25" strokeLinecap="round" />
            <path d="M230 255c28-13 55-14 82-3M250 325c25-10 48-10 69-2M415 210c10 17 12 34 6 51M440 375c16 17 28 26 45 34" fill="none" stroke="#c1f3f0" strokeWidth="4" strokeLinecap="round" opacity=".7" />
            <ellipse cx="255" cy="250" rx="16" ry="8" fill="#78b85a" transform="rotate(-15 255 250)" />
            <ellipse cx="335" cy="320" rx="13" ry="7" fill="#78b85a" transform="rotate(20 335 320)" />

            <g transform="translate(415 300)"><rect x="-28" y="-17" width="56" height="34" rx="6" fill="#8a5a32" stroke="#5e3d25" strokeWidth="3" /><path d="M-21-10h42M-21 0h42M-21 10h42" stroke="#c38a4c" strokeWidth="5" /><path d="M-29-20h58M-29 20h58" stroke="#654127" strokeWidth="5" /></g>
          </g>

          <Tree x={130} y={200} scale={2.2} /><Tree x={290} y={170} scale={1.6} /><Tree x={730} y={180} scale={1.8} />
          <Tree x={1020} y={150} scale={2.2} /><Tree x={1250} y={190} scale={1.8} /><Tree x={1350} y={910} scale={2.2} />
          <Tree x={1610} y={1030} scale={2.1} /><Tree x={1760} y={160} scale={1.7} /><Tree x={2060} y={270} scale={2.2} />
          <Tree x={2160} y={720} scale={1.8} /><Tree x={150} y={900} scale={1.7} /><Tree x={700} y={1100} scale={2} /><Tree x={1800} y={1170} scale={2} />
          <Bush x={1030} y={250} scale={1.6} /><Bush x={1250} y={470} scale={2} /><Bush x={1430} y={630} scale={1.6} />
          <Bush x={1080} y={1110} scale={2} /><Bush x={2020} y={500} scale={1.6} /><Bush x={320} y={860} scale={2} /><Bush x={1860} y={940} scale={2} />
          <Rock x={560} y={240} scale={2} /><Rock x={1060} y={360} scale={1.6} /><Rock x={1650} y={860} scale={2} /><Rock x={920} y={1160} scale={1.6} />
          <Flower x={270} y={310} /><Flower x={600} y={310} /><Flower x={960} y={260} /><Flower x={1220} y={820} /><Flower x={1540} y={1040} /><Flower x={1840} y={180} />

          <path d={trailPath} fill="none" stroke="#8b6b38" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" opacity=".32" />
          <path d={trailPath} fill="none" stroke="url(#trail)" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />
          <path d={trailPath} fill="none" stroke="#f5dfad" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 22" opacity=".9" />

          {tiles.map((tile) => (
            <g key={tile.index} transform={`translate(${tile.x - 18} ${tile.y - 18})`} filter="url(#tileShadow)">
              <circle cx="18" cy="18" r="18" fill={tile.type === 'start' ? '#45f27b' : tile.type === 'finish' ? '#ff5555' : '#fffdf5'} stroke="#18233f" strokeWidth="3" />
              <circle cx="18" cy="18" r="14" fill="none" stroke="#ffffff" strokeWidth="2" opacity=".7" />
              <text x="18" y="22" textAnchor="middle" fontSize="11" fontWeight="900" fill="#18233f" fontFamily="system-ui, sans-serif">{tile.index + 1}</text>
            </g>
          ))}

          <g transform={`translate(${tiles[0].x - 30} ${tiles[0].y - 76})`}><path d="M0 0v45" stroke="#5d3c25" strokeWidth="5" /><path d="M2 0h55l-14 16 14 16H2Z" fill="#45f27b" stroke="#18233f" strokeWidth="3" /><text x="29" y="22" textAnchor="middle" fontSize="11" fontWeight="900" fill="#18233f">START</text></g>
          <g transform={`translate(${tiles[67].x + 8} ${tiles[67].y - 75})`}><path d="M0 0v45" stroke="#5d3c25" strokeWidth="5" /><path d="M2 0h55l-14 16 14 16H2Z" fill="#ff5555" stroke="#18233f" strokeWidth="3" /><text x="29" y="22" textAnchor="middle" fontSize="11" fontWeight="900" fill="#18233f">FINISH</text></g>

          {Object.entries(positions).map(([teamId, tileIndex], idx) => {
            const tile = tiles[tileIndex] || tiles[0];
            return <g key={teamId} transform={`translate(${tile.x - 13} ${tile.y - 26})`}>
              <circle cx="13" cy="9" r="8" fill={colors[idx % colors.length]} stroke="#18233f" strokeWidth="2.5" />
              <circle cx="13" cy="9" r="3" fill="#fff" opacity=".8" />
              <path d="M13 18v13M5 24h16M13 31l-7 7M13 31l7 7" stroke="#18233f" strokeWidth="2.5" strokeLinecap="round" />
            </g>;
          })}
        </svg>
      </div>

      <div className="absolute bottom-5 left-5 z-20 flex items-center gap-2 rounded-2xl border-2 border-[#18233f] bg-white/90 p-2 shadow-xl backdrop-blur">
        <button onClick={(e) => zoomAt(zoom * 1.25, e.clientX, e.clientY)} className="h-10 w-10 rounded-xl border-2 border-[#18233f] bg-white text-xl font-black hover:bg-[#ffea4d]" aria-label="Zoom in">+</button>
        <div className="min-w-14 text-center text-sm font-black text-[#18233f]">{Math.round(zoom * 100)}%</div>
        <button onClick={(e) => zoomAt(zoom / 1.25, e.clientX, e.clientY)} className="h-10 w-10 rounded-xl border-2 border-[#18233f] bg-white text-xl font-black hover:bg-[#ffea4d]" aria-label="Zoom out">−</button>
        <button onClick={resetView} className="h-10 rounded-xl border-2 border-[#18233f] bg-white px-3 text-xs font-black hover:bg-[#ffea4d]">Reset</button>
      </div>

      <div className="pointer-events-none absolute bottom-5 right-5 z-20 rounded-xl bg-[#18233f]/75 px-3 py-2 text-xs font-bold text-white backdrop-blur">
        Drag to explore · Scroll to zoom · Double-click to zoom
      </div>
    </div>
  );
}
