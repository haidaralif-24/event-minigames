import { motion } from 'framer-motion';
import { useState } from 'react';

export default function Dice({ size = 6, onRoll }) {
  const [value, setValue] = useState(1);
  const [rolling, setRolling] = useState(false);

  const roll = () => {
    if (rolling) return;
    setRolling(true);
    let count = 0;
    const interval = setInterval(() => {
      setValue(Math.floor(Math.random() * size) + 1);
      count++;
      if (count >= 10) {
        clearInterval(interval);
        const final = Math.floor(Math.random() * size) + 1;
        setValue(final);
        setRolling(false);
        onRoll?.(final);
      }
    }, 60);
  };

  return (
    <button
      onClick={roll}
      disabled={rolling}
      className="relative w-20 h-20 rounded-2xl bg-[#ff4d4d] border-4 border-[#1a1a2e] shadow-xl flex items-center justify-center text-4xl font-black text-white select-none overflow-hidden"
      aria-label="Roll dice"
    >
      <motion.span
        animate={rolling ? { rotate: [0, 360, 360] } : { rotate: 0 }}
        transition={rolling ? { duration: 0.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
      >
        {value}
      </motion.span>
    </button>
  );
}
