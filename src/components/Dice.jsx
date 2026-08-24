import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

/**
 * Dice renders TWO dice (a 2-dice race). It mirrors the active player's roll
 * across all clients via the `rolling`/`values` props coming from Firestore,
 * so host, spectator board, and other players see the same synced animation.
 * - interactive (onRollStart provided): clickable button that fires
 *   onRollStart() and lets the parent drive `rolling`/`values` from Firestore.
 * - read-only (no onRollStart): purely reflects `rolling`/`values`, used on
 *   the host and spectator board to mirror the active player's roll.
 */
export default function Dice({ sides = 6, rolling = false, values = [1, 1], onRollStart, disabled = false }) {
  const [display, setDisplay] = useState(values);
  const interactive = typeof onRollStart === 'function';

  useEffect(() => {
    if (!rolling) {
      setDisplay(values);
      return undefined;
    }
    const interval = setInterval(() => {
      setDisplay(Array.from({ length: values.length || 2 }, () => Math.floor(Math.random() * sides) + 1));
    }, 90);
    return () => clearInterval(interval);
  }, [rolling, values, sides]);

  const renderDie = (value, index) => (
    <motion.span
      key={index}
      animate={rolling ? { rotate: [0, 360, 360] } : { rotate: 0 }}
      transition={rolling ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3, type: 'spring', bounce: 0.5 }}
      className="grid h-16 w-16 place-items-center rounded-2xl bg-[#ff4d4d] border-4 border-[#1a1a2e] text-3xl font-black text-white select-none"
    >
      {value}
    </motion.span>
  );

  const body = (
    <div className="flex items-center gap-2" aria-live="polite" aria-label={rolling ? 'Dice rolling' : `Dice showing ${display.join(' + ')}`}>
      {display.map((value, index) => renderDie(value, index))}
    </div>
  );

  if (!interactive) {
    return <div className="flex items-center gap-2">{body}</div>;
  }

  return (
    <button
      onClick={onRollStart}
      disabled={disabled || rolling}
      className="flex items-center gap-2 rounded-2xl bg-transparent p-1 disabled:opacity-60"
      aria-label="Roll dice"
    >
      {body}
    </button>
  );
}
