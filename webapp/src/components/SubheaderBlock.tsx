import { motion } from 'framer-motion';
import type { SubheaderSection } from '../lib/data';
import type { CategoryTheme } from '../lib/theme';
import { TopicCard } from './TopicCard';

interface Props {
  subheader: SubheaderSection;
  theme: CategoryTheme;
}

export function SubheaderBlock({ subheader, theme }: Props) {
  const filledCount = subheader.topics.filter((t) => t.hasData).length;

  return (
    <div>
      <motion.h3
        initial={{ opacity: 0, scale: 0.8 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: false, amount: 0.5 }}
        transition={{ type: 'spring', stiffness: 500, damping: 22, mass: 0.6 }}
        style={{ color: theme.accent }}
        className="flex items-baseline justify-between gap-3 text-sm font-semibold uppercase tracking-wide mb-2 origin-left"
      >
        <span>{subheader.label}</span>
        <span className="text-[11px] font-normal tabular-nums opacity-70 normal-case shrink-0">
          {filledCount}/{subheader.topics.length}
        </span>
      </motion.h3>

      {subheader.topics.length === 0 ? (
        <p className="text-sm italic opacity-60 mb-3">No topics added yet.</p>
      ) : (
        <ul className="flex flex-col gap-3 mb-3">
          {subheader.topics.map((topic) => (
            <TopicCard key={topic.slug} topic={topic} theme={theme} />
          ))}
        </ul>
      )}
    </div>
  );
}
