import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

/**
 * Dice renders the active player's roll across all clients via the
 * `rolling`/`value` props coming from Firestore, so host, spectator
 * board, and other players see the same synced animation. `value` is the
 * settled face; while `rolling` is true it spins.
 * - interactive (onRollStart provided): clickable button that fires
 *   onRollStart() and lets the parent drive `rolling`/`value` from Firestore.
 * - read-only (no onRollStart): purely reflects `rolling`/`value`, used
 *   on the host and spectator board to mirror the active player's roll.
 */
export default function Dice({ sides = 6, rolling = false, value = null, onRollStart, disabled = false }) {
  const [display, setDisplay] = useState(value ?? 1);
  const interactive = typeof onRollStart === 'function';

  useEffect(() => {
    if (!rolling) {
      setDisplay(value ?? 1);
      return undefined;
    }
    const interval = setInterval(() => setDisplay(Math.floor(Math.random() * sides) + 1), 90);
    return () => clearInterval(interval);
  }, [rolling, value, sides]);

  const body = (
    <motion.span
      animate={rolling ? { rotate: [0, 360, 360] } : { rotate: 0 }}
      transition={rolling ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3, type: 'spring', bounce: 0.5 }}
      className="grid h-16 w-16 place-items-center rounded-2xl bg-[#ff4d4d] border-4 border-[#1a1a2e] text-3xl font-black text-white select-none"
      aria-live="polite"
      aria-label={rolling ? 'Die rolling' : `Die showing ${display}`}
    >
      {display}
    </motion.span>
  );

  if (!interactive) {
    return body;
  }

  return (
    <button
      onClick={onRollStart}
      disabled={disabled || rolling}
      className="rounded-2xl bg-transparent p-1 disabled:opacity-60"
      aria-label="Roll die"
    >
      {body}
    </button>
  );
}
