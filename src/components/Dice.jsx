import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

/**
 * Dice renders the active player's roll across all clients via the
 * `rolling`/`die1`/`die2` props coming from Firestore, so host, spectator
 * board, and other players see the same synced animation. It renders TWO dice
 * (a 2-dice race): pass `die1` and `die2` for the settled faces; while
 * `rolling` is true it spins both. `value` is accepted as a single-die
 * fallback for older snapshots.
 * - interactive (onRollStart provided): clickable button that fires
 *   onRollStart() and lets the parent drive `rolling`/`die1`/`die2` from Firestore.
 * - read-only (no onRollStart): purely reflects `rolling`/`die1`/`die2`, used
 *   on the host and spectator board to mirror the active player's roll.
 */
export default function Dice({ sides = 6, rolling = false, value = null, die1 = null, die2 = null, onRollStart, disabled = false }) {
  const fallback = value ?? 1;
  const [display1, setDisplay1] = useState(die1 ?? fallback);
  const [display2, setDisplay2] = useState(die2 ?? fallback);
  const interactive = typeof onRollStart === 'function';

  useEffect(() => {
    if (!rolling) {
      setDisplay1(die1 ?? fallback);
      setDisplay2(die2 ?? fallback);
      return undefined;
    }
    const interval = setInterval(() => {
      setDisplay1(Math.floor(Math.random() * sides) + 1);
      setDisplay2(Math.floor(Math.random() * sides) + 1);
    }, 90);
    return () => clearInterval(interval);
  }, [rolling, die1, die2, fallback, sides]);

  const die = (display) => (
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

  const body = (
    <div className="flex items-center gap-2">
      {die(display1)}
      {die(display2)}
    </div>
  );

  if (!interactive) {
    return body;
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
