import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

/**
 * Dice supports two modes:
 * - interactive (onRollStart provided): renders a clickable button. Clicking
 *   fires onRollStart() and lets the parent drive `rolling`/`value` from
 *   Firestore, so every viewer (host, board, other players) sees the same
 *   synced animation instead of a local-only random spin.
 * - read-only (no onRollStart): purely reflects `rolling`/`value` props,
 *   used on the host and spectator board to mirror the active player's roll.
 */
export default function Dice({ size = 6, rolling = false, value = 1, onRollStart, disabled = false }) {
  const [displayValue, setDisplayValue] = useState(value || 1);
  const interactive = typeof onRollStart === 'function';

  useEffect(() => {
    if (!rolling) {
      setDisplayValue(value || 1);
      return undefined;
    }
    const interval = setInterval(() => {
      setDisplayValue(Math.floor(Math.random() * size) + 1);
    }, 90);
    return () => clearInterval(interval);
  }, [rolling, value, size]);

  const body = (
    <motion.span
      animate={rolling ? { rotate: [0, 360, 360] } : { rotate: 0 }}
      transition={rolling ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3, type: 'spring', bounce: 0.5 }}
    >
      {displayValue}
    </motion.span>
  );

  if (!interactive) {
    return (
      <div
        className="relative w-20 h-20 rounded-2xl bg-[#ff4d4d] border-4 border-[#1a1a2e] shadow-xl flex items-center justify-center text-4xl font-black text-white select-none overflow-hidden"
        aria-live="polite"
        aria-label={rolling ? 'Dice rolling' : `Dice showing ${displayValue}`}
      >
        {body}
      </div>
    );
  }

  return (
    <button
      onClick={onRollStart}
      disabled={disabled || rolling}
      className="relative w-20 h-20 rounded-2xl bg-[#ff4d4d] border-4 border-[#1a1a2e] shadow-xl flex items-center justify-center text-4xl font-black text-white select-none overflow-hidden disabled:opacity-60"
      aria-label="Roll dice"
    >
      {body}
    </button>
  );
}
