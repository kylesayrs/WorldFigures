import { motion } from 'framer-motion';
import type { SubheaderSection } from '../lib/data';
import type { CategoryTheme } from '../lib/theme';
import { useScrollFade } from '../hooks/useScrollFade';
import { TopicCard } from './TopicCard';

interface Props {
  subheader: SubheaderSection;
  theme: CategoryTheme;
}

export function SubheaderBlock({ subheader, theme }: Props) {
  const filledCount = subheader.topics.filter((t) => t.hasData).length;
  const header = useScrollFade<HTMLHeadingElement>();

  return (
    <div>
      <motion.h3
        ref={header.ref}
        style={{ opacity: header.opacity, y: header.y, color: theme.accent }}
        className="flex items-baseline justify-between gap-3 text-sm font-semibold uppercase tracking-wide mb-2"
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
