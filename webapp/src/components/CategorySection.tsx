import { motion } from 'framer-motion';
import type { CategorySection as CategorySectionData } from '../lib/data';
import { TopicCard } from './TopicCard';
import { useScrollFade } from '../hooks/useScrollFade';

interface Props {
  section: CategorySectionData;
}

export function CategorySection({ section }: Props) {
  const { theme, topics } = section;
  const filledCount = topics.filter((t) => t.hasData).length;
  const header = useScrollFade<HTMLDivElement>();

  return (
    <section
      id={`cat-${section.slug}`}
      className="scroll-mt-24 rounded-2xl border px-4 py-5 sm:px-6 sm:py-6"
      style={{ backgroundColor: theme.bg, borderColor: theme.border }}
    >
      <motion.header
        ref={header.ref}
        style={{ opacity: header.opacity, y: header.y }}
        className="flex items-baseline justify-between gap-3 mb-4"
      >
        <h2 className="font-serif text-2xl font-semibold flex items-center gap-2" style={{ color: theme.accent }}>
          <span aria-hidden>{theme.emoji}</span>
          {theme.label}
        </h2>
        <span className="text-xs opacity-60 tabular-nums shrink-0">
          {filledCount}/{topics.length} researched
        </span>
      </motion.header>

      {topics.length === 0 ? (
        <p className="text-sm italic opacity-60">No topics added to this chapter yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {topics.map((topic) => (
            <TopicCard key={topic.slug} topic={topic} theme={theme} />
          ))}
        </ul>
      )}
    </section>
  );
}
