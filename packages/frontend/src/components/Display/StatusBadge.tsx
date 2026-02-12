import { motion } from 'framer-motion';

interface StatusBadgeProps {
  status: 'ongoing' | 'prestart' | 'next' | null;
  theme: any;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, theme, size = 'md' }: StatusBadgeProps) {
  if (!status) return null;

  const isSm = size === 'sm';

  if (status === 'ongoing') {
    return (
      <motion.span
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className={`font-black uppercase tracking-wider rounded ${
          isSm
            ? 'text-[9px] px-1.5 py-0.5'
            : 'text-[10px] px-2 py-1'
        }`}
        style={{
          backgroundColor: `${theme.statusLive || '#10B981'}40`,
          color: theme.statusLive || '#10B981',
        }}
      >
        LÄUFT
      </motion.span>
    );
  }

  if (status === 'prestart') {
    return (
      <span
        className={`font-black uppercase tracking-wider rounded ${
          isSm
            ? 'text-[8px] px-1.5 py-0.5'
            : 'text-[9px] px-2 py-0.5'
        }`}
        style={{
          backgroundColor: `${theme.statusPrestart || '#F59E0B'}40`,
          color: theme.statusPrestart || '#F59E0B',
        }}
      >
        GLEICH
      </span>
    );
  }

  if (status === 'next') {
    return (
      <span
        className={`font-black uppercase tracking-wider rounded ${
          isSm
            ? 'text-[8px] px-1.5 py-0.5'
            : 'text-[9px] px-2 py-0.5'
        }`}
        style={{
          backgroundColor: `${theme.statusNext || theme.accentGold}30`,
          color: theme.statusNext || theme.accentGold,
        }}
      >
        NÄCHSTER
      </span>
    );
  }

  return null;
}
