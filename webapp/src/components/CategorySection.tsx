import { motion } from 'framer-motion';
import type { CategorySection as CategorySectionData } from '../lib/data';
import { SubheaderBlock } from './SubheaderBlock';
import { useScrollFade } from '../hooks/useScrollFade';

interface Props {
  section: CategorySectionData;
}

export function CategorySection({ section }: Props) {
  const { theme, subheaders } = section;
  const filledCount = subheaders.reduce((n, s) => n + s.topics.filter((t) => t.hasData).length, 0);
  const totalCount = subheaders.reduce((n, s) => n + s.topics.length, 0);
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
          {filledCount}/{totalCount} researched
        </span>
      </motion.header>

      {subheaders.length === 0 ? (
        <p className="text-sm italic opacity-60">No topics added to this chapter yet.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {subheaders.map((subheader) => (
            <SubheaderBlock key={subheader.slug} subheader={subheader} theme={theme} />
          ))}
        </div>
      )}
    </section>
  );
}
