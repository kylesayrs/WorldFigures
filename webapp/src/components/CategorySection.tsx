import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { CategorySection as CategorySectionData } from '../lib/data';
import { SubheaderBlock } from './SubheaderBlock';

interface Props {
  section: CategorySectionData;
}

export function CategorySection({ section }: Props) {
  const { theme, subheaders } = section;
  const filledCount = subheaders.reduce((n, s) => n + s.topics.filter((t) => t.hasData).length, 0);
  const totalCount = subheaders.reduce((n, s) => n + s.topics.length, 0);
  const [revealed, setRevealed] = useState(false);
  // Observed on a stable, untransformed wrapper rather than the animated
  // element itself — scaling the observed element changes its own
  // getBoundingClientRect, which re-triggers the observer near the
  // threshold and causes the reveal to flicker/oscillate.
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          return;
        }
        // Leaving past the top edge (scrolling down, rect.top < 0) means the
        // chapter has already been read — let it persist instead of
        // popping out. Only reset when it exits back down past the bottom
        // edge (scrolling up, un-reading it), so scrolling down re-reveals it.
        if (entry.boundingClientRect.top < 0) return;
        setRevealed(false);
      },
      // threshold is a fraction of the *target's own* area, not the
      // viewport's — for a section taller than viewport/threshold, no
      // scroll position can ever satisfy it (some chapters, e.g. Industry,
      // are taller than that). rootMargin makes the trigger line a fixed
      // distance from the viewport edge instead, so it works regardless of
      // how tall the section is.
      { threshold: 0, rootMargin: '0px 0px -15% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} id={`cat-${section.slug}`} className="scroll-mt-24">
      <motion.section
        initial={{ opacity: 0, scale: 0.85 }}
        animate={revealed ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
        transition={{ type: 'spring', stiffness: 380, damping: 24, mass: 0.7 }}
        className="rounded-2xl border px-4 py-5 sm:px-6 sm:py-6 origin-top"
        style={{ backgroundColor: theme.bg, borderColor: theme.border }}
      >
        <header className="flex items-baseline justify-between gap-3 mb-4">
          <h2 className="font-serif text-2xl font-semibold flex items-center gap-2" style={{ color: theme.accent }}>
            <span aria-hidden>{theme.emoji}</span>
            {theme.label}
          </h2>
          <span className="text-xs opacity-60 tabular-nums shrink-0">
            {filledCount}/{totalCount} researched
          </span>
        </header>

        {subheaders.length === 0 ? (
          <p className="text-sm italic opacity-60">No topics added to this chapter yet.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {subheaders.map((subheader) => (
              <SubheaderBlock key={subheader.slug} subheader={subheader} theme={theme} />
            ))}
          </div>
        )}
      </motion.section>
    </div>
  );
}
