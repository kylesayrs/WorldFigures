import { motion } from 'framer-motion';
import { countFilledTopics, countTopics, type CategorySection } from '../lib/data';

interface Props {
  sections: CategorySection[];
  variant?: 'chips' | 'contents-page';
}

function scrollToSection(slug: string) {
  document.getElementById(`cat-${slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function TocChips({ sections }: Props) {
  return (
    <nav
      aria-label="Table of contents"
      className="flex gap-2 overflow-x-auto px-4 py-2 sm:px-6 no-scrollbar"
    >
      {sections.map((s) => {
        const filled = countFilledTopics(s);
        return (
          <button
            key={s.slug}
            type="button"
            onClick={() => scrollToSection(s.slug)}
            className="shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-transform active:scale-95"
            style={{ backgroundColor: s.theme.bg, borderColor: s.theme.border, color: s.theme.accent }}
          >
            <span aria-hidden>{s.theme.emoji}</span>
            {s.theme.label}
            {filled > 0 && <span className="opacity-60 text-xs tabular-nums">{filled}</span>}
          </button>
        );
      })}
    </nav>
  );
}

export function ContentsPage({ sections }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border px-5 py-5 sm:px-7 sm:py-6"
      style={{ borderColor: '#e4ddd0', backgroundColor: 'rgba(255,255,255,0.5)' }}
    >
      <h2 className="font-serif text-lg font-semibold mb-3 opacity-80">Contents</h2>
      <ul className="flex flex-col gap-1.5">
        {sections.map((s) => {
          const filled = countFilledTopics(s);
          const total = countTopics(s);
          return (
            <li key={s.slug}>
              <button
                type="button"
                onClick={() => scrollToSection(s.slug)}
                className="w-full flex items-baseline gap-2 text-left py-1 group"
              >
                <span aria-hidden style={{ color: s.theme.accent }}>
                  {s.theme.emoji}
                </span>
                <span className="font-medium" style={{ color: s.theme.accent }}>
                  {s.theme.label}
                </span>
                <span
                  className="flex-1 border-b border-dotted mx-1 translate-y-[-3px]"
                  style={{ borderColor: '#d8d0c0' }}
                  aria-hidden
                />
                <span className="text-xs tabular-nums opacity-50 shrink-0">
                  {filled}/{total}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}
