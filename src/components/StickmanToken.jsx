import { motion } from 'framer-motion';

export default function StickmanToken({ color = '#ff4d4d', x = 0, y = 0 }) {
  return (
    <motion.div
      className="absolute w-12 h-16 z-20"
      style={{ left: x - 24, top: y - 32 }}
      animate={{ left: x - 24, top: y - 32 }}
      transition={{ type: 'spring', stiffness: 120, damping: 15 }}
    >
      <svg viewBox="0 0 48 64" width="48" height="64" fill={color} stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round">
        <circle cx="24" cy="16" r="10" />
        <line x1="24" y1="28" x2="24" y2="50" strokeWidth="5" />
        <line x1="12" y1="36" x2="36" y2="36" strokeWidth="4" />
        <line x1="24" y1="50" x2="14" y2="58" strokeWidth="3" />
        <line x1="24" y1="50" x2="34" y2="58" strokeWidth="3" />
      </svg>
    </motion.div>
  );
}
