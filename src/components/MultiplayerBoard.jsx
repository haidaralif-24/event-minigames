import { useEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useMotionValue } from 'framer-motion';
import boardTiles from '../data/boardTiles.json';
import { TOKEN_COLORS } from '../data/constants.js';

const MAP_WIDTH = 2000;
const MAP_HEIGHT = 1150;
const MAP_PADDING = 85;
const TOTAL_TILES = 67;
const CX = 1000;
const CY = 575;
const ASPECT = 1.55;
const INK = '#1a1a2e';

const tileStyle = {
  start: { fill: '#4dff79', icon: 'S' },
  finish: { fill: '#ff5555', icon: 'F', light: true },
  normal: { fill: '#fffdf5' },
  bonus: { fill: '#ffea4d', icon: '★' },
  challenge: { fill: '#4d79ff', icon: '?', light: true },
  penalty: { fill: '#ff8c4d', icon: '!' },
  checkpoint: { fill: '#a64dff', icon: '⌂', light: true },
};

function buildSpiralPoints() {
  const maxRadius = 520;
  const minRadius = 100;
  const startAngle = 0.35;
  const turns = 2.2;
  const pointAt = (progress) => {
    const radius = minRadius + (maxRadius - minRadius) * (1 - progress) ** 0.82;
    const angle = startAngle + progress * turns * Math.PI * 2;
    return {
      x: CX + radius * Math.cos(angle) * ASPECT,
      y: CY + radius * Math.sin(angle),
    };
  };

  // The raw spiral advances by angle, which makes tiles bunch up near the centre.
  // Resampling it by accumulated arc length keeps every step visually consistent.
  const samples = Array.from({ length: 4097 }, (_, index) => pointAt(index / 4096));
  const lengths = [0];
  for (let index = 1; index < samples.length; index += 1) {
    lengths.push(lengths[index - 1] + Math.hypot(samples[index].x - samples[index - 1].x, samples[index].y - samples[index - 1].y));
  }
  const totalLength = lengths[lengths.length - 1];
  let sampleIndex = 1;
  return Array.from({ length: TOTAL_TILES }, (_, index) => {
    const targetLength = (index / (TOTAL_TILES - 1)) * totalLength;
    while (lengths[sampleIndex] < targetLength && sampleIndex < lengths.length - 1) sampleIndex += 1;
    const previousLength = lengths[sampleIndex - 1];
    const segmentLength = lengths[sampleIndex] - previousLength || 1;
    const progress = (targetLength - previousLength) / segmentLength;
    return {
      x: samples[sampleIndex - 1].x + (samples[sampleIndex].x - samples[sampleIndex - 1].x) * progress,
      y: samples[sampleIndex - 1].y + (samples[sampleIndex].y - samples[sampleIndex - 1].y) * progress,
    };
  });
}

function catmullRom(points) {
  let path = '';
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index === 0 ? 0 : index - 1];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2 < points.length ? index + 2 : index + 1];
    if (index === 0) path += `M ${p1.x} ${p1.y} `;
    path += `C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, `;
    path += `${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y} `;
  }
  return path;
}

function blobPoints(radius, count, phase) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const jitter = 1 + 0.1 * Math.sin(angle * 3 + phase) + 0.05 * Math.sin(angle * 5 + phase * 1.7);
    return { x: CX + radius * jitter * Math.cos(angle) * ASPECT, y: CY + radius * jitter * Math.sin(angle) };
  });
}

function smoothBlob(points) {
  const first = points[0];
  const last = points[points.length - 1];
  let path = `M ${(first.x + last.x) / 2} ${(first.y + last.y) / 2} `;
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    path += `Q ${point.x} ${point.y}, ${(point.x + next.x) / 2} ${(point.y + next.y) / 2} `;
  });
  return `${path}Z`;
}

function Palm({ x, y, scale = 1 }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse cy="4" rx="16" ry="5" fill={INK} opacity=".18" />
    <path d="M0 0C-4-22 2-40-6-58" fill="none" stroke="#8a5a32" strokeWidth="7" strokeLinecap="round" />
    <g transform="translate(-6 -58)" fill="#4bab4c" stroke={INK} strokeWidth="2.5">
      <path d="M0 0C-22-6-34-18-38-30C-24-22-10-14 0 0Z" />
      <path d="M0 0C20-8 30-20 32-34C20-24 8-14 0 0Z" fill="#3f9142" />
      <path d="M0 0C-14-20-12-34 0-46C10-34 12-20 0 0Z" />
    </g>
  </g>;
}

function Tree({ x, y, scale = 1 }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse cy="26" rx="15" ry="6" fill={INK} opacity=".18" />
    <path d="M-4 24h8l-1-30h-6z" fill="#8a5a32" stroke={INK} strokeWidth="2" />
    <circle cy="-14" r="20" fill="#3f9142" stroke={INK} strokeWidth="3" />
    <circle cx="-10" cy="-24" r="13" fill="#4bab4c" stroke={INK} strokeWidth="3" />
    <circle cx="11" cy="-22" r="14" fill="#4bab4c" stroke={INK} strokeWidth="3" />
  </g>;
}

function Rock({ x, y, scale = 1 }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse cy="9" rx="17" ry="5" fill={INK} opacity=".16" />
    <path d="M-14 7L-10-7 0-13 13-6 10 7Z" fill="#9aa79b" stroke={INK} strokeWidth="2.5" />
  </g>;
}

function Hut({ x, y, scale = 1 }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse cy="18" rx="24" ry="6" fill={INK} opacity=".18" />
    <rect x="-14" y="-2" width="28" height="20" fill="#e0c179" stroke={INK} strokeWidth="2.5" />
    <path d="M-18-2L0-22 18-2Z" fill="#c9673d" stroke={INK} strokeWidth="2.5" />
  </g>;
}

function Dock({ x, y }) {
  return <g transform={`translate(${x} ${y})`}>
    <rect x="-10" y="-70" width="16" height="110" fill="#8a5a32" stroke={INK} strokeWidth="3" />
    <path d="M-40 30C-10 50 30 50 55 25C45 45 5 65-40 30Z" fill="#c9673d" stroke={INK} strokeWidth="3" />
    <path d="M-2-66L52-20-2-8Z" fill="#fff8e7" stroke={INK} strokeWidth="3" />
  </g>;
}

function TeamAvatar({ playerIndex, color, playerName }) {
  const index = playerIndex % 6;
  return (
    <g filter="url(#softShadow)" className="select-none pointer-events-none">
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

      {/* Eyes & Cheeks */}
      <circle cx="-4" cy="-14" r="1.8" fill="#18233f" />
      <circle cx="4" cy="-14" r="1.8" fill="#18233f" />
      <circle cx="-3.4" cy="-14.6" r="0.6" fill="#fff" />
      <circle cx="4.6" cy="-14.6" r="0.6" fill="#fff" />
      <circle cx="-7" cy="-11" r="1.5" fill="#ff8c8c" opacity=".6" />
      <circle cx="7" cy="-11" r="1.5" fill="#ff8c8c" opacity=".6" />

      {/* Distinct Headgear per Team (0 to 5) */}
      {index === 0 && (
        /* Team 1 (Red): Fiery Ninja Headband with flowing tails */
        <g>
          <path d="M-13-18h26v5h-26z" fill="#ef4444" stroke="#18233f" strokeWidth="2.5" />
          <path d="M12-16l8-4-2 6 6 5-12-3z" fill="#ef4444" stroke="#18233f" strokeWidth="2" />
          <circle cx="0" cy="-15.5" r="2" fill="#ffea4d" stroke="#18233f" strokeWidth="1" />
          <path d="M-3-9c2 2 4 2 6 0" fill="none" stroke="#18233f" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      )}

      {index === 1 && (
        /* Team 2 (Green): Dino Horns & Sprout Leaf */
        <g>
          <path d="M-10-22c0-5 10-8 20-3-4 7-14 6-20 3z" fill="#22c55e" stroke="#18233f" strokeWidth="2" />
          <path d="M0-24c0-7 6-9 8-6-1 5-5 6-8 6z" fill="#86efac" stroke="#18233f" strokeWidth="1.5" />
          <path d="M-5-22l-2-4 4 2z" fill="#ffea4d" stroke="#18233f" strokeWidth="1.5" />
          <path d="M-3-9c2 2.5 4 2.5 6 0" fill="none" stroke="#18233f" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}

      {index === 2 && (
        /* Team 3 (Blue): Cyber Gamer Headphones & Cool Visor */
        <g>
          <path d="M-13-16c0-10 26-10 26 0" fill="none" stroke="#18233f" strokeWidth="3" strokeLinecap="round" />
          <rect x="-16" y="-18" width="5" height="9" rx="2" fill="#3b82f6" stroke="#18233f" strokeWidth="2" />
          <rect x="11" y="-18" width="5" height="9" rx="2" fill="#3b82f6" stroke="#18233f" strokeWidth="2" />
          <rect x="-7" y="-17" width="14" height="4" rx="2" fill="#60a5fa" stroke="#18233f" strokeWidth="1.5" />
          <path d="M-3-9h6" stroke="#18233f" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}

      {index === 3 && (
        /* Team 4 (Yellow): Golden Crown with Star Gem */
        <g>
          <path d="M-10-22l4 4 6-7 6 7 4-4v6h-20z" fill="#f59e0b" stroke="#18233f" strokeWidth="2.5" />
          <circle cx="0" cy="-21" r="2" fill="#fff" stroke="#18233f" strokeWidth="1" />
          <circle cx="-6" cy="-19" r="1.2" fill="#ef4444" />
          <circle cx="6" cy="-19" r="1.2" fill="#3b82f6" />
          <path d="M-3-8c2 3 4 3 6 0" fill="none" stroke="#18233f" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}

      {index === 4 && (
        /* Team 5 (Purple): Mystic Wizard Hat with Sparkles */
        <g>
          <path d="M-14-22h28l-14-14z" fill="#a855f7" stroke="#18233f" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M-15-20c10-2 20-2 30 0" stroke="#ffea4d" strokeWidth="3" strokeLinecap="round" />
          <polygon points="0,-29 1.5,-26 4,-26 2,-24 3,-21 0,-23 -3,-21 -2,-24 -4,-26 -1.5,-26" fill="#ffea4d" />
          <path d="M-2-9c2 1.5 4 1.5 5 0" fill="none" stroke="#18233f" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      )}

      {index === 5 && (
        /* Team 6 (Pink): Cute Bunny Ears with Bow */
        <g>
          <path d="M-8-23c-2-8 3-12 5-11 2 2 0 8-3 12z" fill="#ec4899" stroke="#18233f" strokeWidth="2" />
          <path d="M-7-23c-1-5 2-8 3-7 1 1 0 5-2 8z" fill="#fbcfe8" />
          <path d="M8-23c2-8-3-12-5-11-2 2 0 8 3 12z" fill="#ec4899" stroke="#18233f" strokeWidth="2" />
          <path d="M7-23c1-5-2-8-3-7-1 1 0 5 2 8z" fill="#fbcfe8" />
          <circle cx="0" cy="-22" r="3" fill="#ffea4d" stroke="#18233f" strokeWidth="1.5" />
          <path d="M-3-8c2 2 4 2 6 0" fill="none" stroke="#18233f" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
    </g>
  );
}

function TrailToken({ playerIndex, playerName, color, offsetX, offsetY, pathRef, tileIndex, tileLengths }) {
  const trailLength = useMotionValue(0);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [placed, setPlaced] = useState(false);
  const initialized = useRef(false);
  const previousTile = useRef(tileIndex);
  useEffect(() => {
    const path = pathRef.current;
    const target = tileLengths[tileIndex];
    if (!path || target === undefined) return undefined;
    const place = (length, hop = 0) => {
      const point = path.getPointAtLength(length);
      x.set(point.x + offsetX);
      y.set(point.y - 18 + offsetY - hop);
    };
    if (!initialized.current) {
      initialized.current = true;
      previousTile.current = tileIndex;
      trailLength.set(target);
      place(target);
      setPlaced(true);
      return undefined;
    }
    const from = trailLength.get();
    const distance = Math.max(1, Math.abs(tileIndex - previousTile.current));
    previousTile.current = tileIndex;
    if (Math.abs(target - from) < 0.5) return undefined;
    const controls = animate(trailLength, target, {
      duration: distance * 0.175,
      ease: [0.34, 1.32, 0.64, 1],
      onUpdate: (length) => {
        const progress = Math.min(1, Math.abs(length - from) / Math.abs(target - from));
        place(length, Math.abs(Math.sin(progress * Math.PI * distance)) * 26);
      },
      onComplete: () => place(target),
    });
    return () => controls.stop();
  }, [offsetX, offsetY, pathRef, tileIndex, tileLengths, trailLength, x, y]);
  return <motion.g style={{ x, y, opacity: placed ? 1 : 0 }}><TeamAvatar playerIndex={playerIndex} color={color} playerName={playerName} /></motion.g>;
}

export default function MultiplayerBoard({ boardPositions = {}, players = {} }) {
  const points = useMemo(buildSpiralPoints, []);
  const trailPath = useMemo(() => catmullRom(points), [points]);
  const sandPath = useMemo(() => smoothBlob(blobPoints(600, 26, 0.4)), []);
  const grassPath = useMemo(() => smoothBlob(blobPoints(530, 26, 1.1)), []);
  const playerIds = Object.keys(players).sort();
  const trailGeometryRef = useRef(null);
  const [tileLengths, setTileLengths] = useState({});

  useEffect(() => {
    const path = trailGeometryRef.current;
    if (!path) return;
    const totalLength = path.getTotalLength();
    const sampleCount = Math.max(1, Math.ceil(totalLength / 2));
    const samples = Array.from({ length: sampleCount + 1 }, (_, index) => {
      const length = (index / sampleCount) * totalLength;
      const point = path.getPointAtLength(length);
      return { length, x: point.x, y: point.y };
    });
    setTileLengths(Object.fromEntries(points.map((point, index) => {
      const closest = samples.reduce((best, sample) => ((sample.x - point.x) ** 2 + (sample.y - point.y) ** 2 < (best.x - point.x) ** 2 + (best.y - point.y) ** 2 ? sample : best));
      return [index, closest.length];
    })));
  }, [points, trailPath]);

  return <div className="relative w-full overflow-hidden rounded-[2rem] border-4 border-[#18233f] bg-[#2c8fae] shadow-2xl" style={{ height: 'clamp(620px, 92vh, 980px)' }}>
    <svg className="h-full w-full" viewBox={`${-MAP_PADDING} ${-MAP_PADDING} ${MAP_WIDTH + MAP_PADDING * 2} ${MAP_HEIGHT + MAP_PADDING * 2}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label="Adventure Island board map">
      <defs>
        <linearGradient id="mp-ocean" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#3aa8c9" /><stop offset="1" stopColor="#1f7a9c" /></linearGradient>
        <linearGradient id="mp-sand" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f2dfa0" /><stop offset="1" stopColor="#e0c179" /></linearGradient>
        <linearGradient id="mp-grass" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#c7e8a4" /><stop offset="1" stopColor="#8fc85e" /></linearGradient>
        <linearGradient id="mp-trail" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f5e2ac" /><stop offset="1" stopColor="#c99a55" /></linearGradient>
        <radialGradient id="mp-peak" cx=".35" cy=".3" r=".8"><stop stopColor="#c98a5b" /><stop offset="1" stopColor="#8a5a35" /></radialGradient>
        <filter id="softShadow" x="-40%" y="-40%" width="180%" height="200%"><feDropShadow dx="0" dy="6" stdDeviation="4" floodOpacity=".3" /></filter>
      </defs>
      <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#mp-ocean)" />
      {[700, 780, 860, 940].map((radius) => <ellipse key={radius} cx={CX} cy={CY} rx={radius * ASPECT} ry={radius} fill="none" stroke="#fff" strokeWidth="2" opacity=".13" />)}
      <path d={sandPath} fill="url(#mp-sand)" stroke="#8a6a3a" strokeWidth="6" filter="url(#softShadow)" />
      <path d={grassPath} fill="url(#mp-grass)" stroke="#5f9c3f" strokeWidth="5" />

      <Palm x={279} y={255} scale={1.6} /><Palm x={1708} y={275} scale={1.7} /><Palm x={225} y={855} scale={1.6} /><Palm x={1748} y={835} scale={1.5} />
      <Palm x={1000} y={145} scale={1.4} /><Palm x={1000} y={1015} scale={1.5} /><Tree x={559} y={185} scale={1.5} /><Tree x={1428} y={205} scale={1.4} />
      <Tree x={439} y={955} scale={1.4} /><Tree x={1575} y={935} scale={1.6} />
      <Rock x={760} y={225} scale={1.5} /><Rock x={1281} y={935} scale={1.4} /><Rock x={332} y={555} scale={1.3} /><Rock x={1668} y={555} scale={1.4} />
      {[[626, 315, '#ffea4d'], [1240, 295, '#ff4da6'], [492, 715, '#ffea4d'], [1481, 715, '#ff4da6'], [866, 955, '#a64dff'], [1134, 175, '#4d79ff']].map(([x, y, color]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill={color} stroke={INK} strokeWidth="1.5" />)}
      {points.map((point, index) => boardTiles[index]?.type === 'checkpoint' ? <Hut key={`hut-${index}`} x={point.x} y={point.y - 46} scale={1.3} /> : null)}

      <path d={trailPath} fill="none" stroke="#8b6b38" strokeWidth="30" strokeLinecap="round" opacity=".28" />
      <path d={trailPath} fill="none" stroke="url(#mp-trail)" strokeWidth="22" strokeLinecap="round" />
      <path d={trailPath} fill="none" stroke="#fff6df" strokeWidth="5" strokeLinecap="round" strokeDasharray="1 20" opacity=".85" />
      <path ref={trailGeometryRef} d={trailPath} fill="none" stroke="none" visibility="hidden" />

      <g transform={`translate(${CX} ${CY})`} filter="url(#softShadow)">
        <circle r="92" fill="url(#mp-peak)" stroke="#5a3a20" strokeWidth="6" />
        <rect x="-28" y="-64" width="56" height="60" fill="#e7ddc8" stroke={INK} strokeWidth="4" />
        <path d="M-34-64L0-98 34-64Z" fill="#c9673d" stroke={INK} strokeWidth="4" />
        <rect x="-8" y="-30" width="16" height="26" fill="#5a3a20" stroke={INK} strokeWidth="2.5" />
        <path d="M0-98v-22" stroke={INK} strokeWidth="3" />
        <path d="M0-120L26-120 13-107Z" fill="#ff4d4d" stroke={INK} strokeWidth="2.5" />
      </g>

      <Dock x={points[0].x + 70} y={points[0].y + 30} />

      {points.map((point, index) => {
        const tile = boardTiles[index] || { type: 'normal' };
        const style = tileStyle[tile.type] || tileStyle.normal;
        const prominent = tile.type === 'start' || tile.type === 'finish';
        const size = tile.type === 'finish' ? 82 : prominent ? 44 : 34;
        return <g key={index} transform={`translate(${point.x} ${point.y})`} filter="url(#softShadow)">
          {tile.type === 'finish' && <>
            <circle r="66" fill="#ffe36b" opacity=".34" />
            <circle r="57" fill="none" stroke="#fff3a6" strokeWidth="6" strokeDasharray="10 8" />
            <path d="M-37-48L-61-76M37-48L61-76" stroke="#fff3a6" strokeWidth="6" strokeLinecap="round" />
            <text x="-66" y="-70" textAnchor="middle" fontSize="23" fill="#ffea4d" stroke={INK} strokeWidth="2" paintOrder="stroke" fontFamily="Nunito, sans-serif">★</text>
            <text x="66" y="-70" textAnchor="middle" fontSize="23" fill="#ffea4d" stroke={INK} strokeWidth="2" paintOrder="stroke" fontFamily="Nunito, sans-serif">★</text>
          </>}
          <rect x={-size / 2} y={-size / 2} width={size} height={size} rx={tile.type === 'finish' ? 20 : 10} fill={style.fill} stroke={INK} strokeWidth={tile.type === 'finish' ? 5 : 3.5} />
          {tile.type === 'finish' ? <>
            <text y="9" textAnchor="middle" fontSize="31" fontWeight="900" fill="#fff8e7" stroke={INK} strokeWidth="1.5" paintOrder="stroke" fontFamily="Nunito, sans-serif">67</text>
            <text y="51" textAnchor="middle" fontSize="12" fontWeight="900" fill={INK} fontFamily="Nunito, sans-serif">FINISH</text>
          </> : <text y="5" textAnchor="middle" fontSize={style.icon ? 16 : 11} fontWeight="900" fill={style.light ? '#fff' : INK} fontFamily="Nunito, sans-serif">{style.icon || index + 1}</text>}
        </g>;
      })}

      {Object.entries(boardPositions).map(([playerId, rawPosition], tokenIndex) => {
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
            color={TOKEN_COLORS[playerIndex % TOKEN_COLORS.length]}
            offsetX={offsetX}
            offsetY={offsetY}
            pathRef={trailGeometryRef}
            tileIndex={tileIndex}
            tileLengths={tileLengths}
          />
        );
      })}
    </svg>
    <div className="pointer-events-none absolute left-5 top-5 rounded-2xl border-4 border-[#18233f] bg-[#fff8e7]/95 px-4 py-3 shadow-[0_4px_0_#18233f]">
      <p className="text-[10px] font-black uppercase tracking-widest text-[#ff8c4d]">Adventure Island</p>
      <p className="font-display text-lg text-[#18233f]">67 tiles · 6 players</p>
    </div>
  </div>;
}
