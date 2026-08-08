import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { TopicEntry } from '../lib/data';
import type { CategoryTheme } from '../lib/theme';
import { combineVintage, humanizeSlug, scopeLabel } from '../lib/format';
import { PlaceList, SourceFootnote } from './PlaceList';

interface Props {
  topic: TopicEntry;
  theme: CategoryTheme;
}

export function TopicCard({ topic, theme }: Props) {
  const [open, setOpen] = useState(false);
  const firstTitledGroup = topic.entityGroups.find((g) => g.source?.title);
  const title = firstTitledGroup?.source?.title || humanizeSlug(topic.slug);
  const firstDefinedGroup = topic.entityGroups.find((g) => g.source?.definition);
  const vintage = combineVintage(
    topic.entityGroups.filter((g) => g.values.length > 0).map((g) => g.source?.dataYear),
  );
  const description = topic.description || firstDefinedGroup?.source?.definition;
  const totalCoverage = topic.entityGroups.reduce((n, g) => n + g.values.length, 0);
  const maxCoverage = topic.entityGroups.reduce(
    (n, g) => n + (Number(g.source?.coverageTotal) || g.values.length),
    0,
  );

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.2, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="rounded-xl border overflow-hidden"
      style={{
        borderColor: theme.border,
        backgroundColor: topic.hasData ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)',
      }}
    >
      <button
        type="button"
        onClick={() => topic.hasData && setOpen((o) => !o)}
        aria-expanded={open}
        aria-disabled={!topic.hasData}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left ${
          topic.hasData ? 'cursor-pointer' : 'cursor-default'
        }`}
        style={{ opacity: topic.hasData ? 1 : 0.5 }}
      >
        <div className="min-w-0 flex-1">
          <p className="font-serif font-semibold leading-snug truncate" style={{ color: theme.accent }}>
            {title}
          </p>
          {description && (
            <p className="text-xs opacity-70 truncate">
              {description}
              {vintage && ` • ${vintage}`}
            </p>
          )}
        </div>

        {topic.hasData ? (
          <span
            className="text-[11px] font-medium tabular-nums px-2 py-0.5 rounded-full shrink-0"
            style={{ backgroundColor: theme.border, color: theme.accent }}
          >
            {totalCoverage}/{maxCoverage}
          </span>
        ) : (
          <span
            className="text-[11px] font-medium italic opacity-60 shrink-0"
            title={topic.statusDescription || undefined}
          >
            no data yet
          </span>
        )}

        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          style={{ color: theme.accent, opacity: topic.hasData ? 1 : 0.4 }}
          className="shrink-0"
          aria-hidden
        >
          &#9662;
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && topic.hasData && (
          <motion.div
            key="content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="px-4 overflow-hidden"
          >
            <div className="pb-4">
              <p className="text-xs uppercase tracking-wide opacity-60 mb-2">{scopeLabel(topic.scopes)}</p>

              {topic.entityGroups
                .filter((g) => g.values.length > 0)
                .map((group, i, filled) => (
                  <div key={group.entityType} className={i < filled.length - 1 ? 'mb-3' : undefined}>
                    {filled.length > 1 && <p className="text-xs font-medium mb-1 opacity-80">{group.label}</p>}
                    <PlaceList values={group.values} unit={group.source?.unit ?? ''} theme={theme} />
                    {group.source && <SourceFootnote source={group.source} />}
                  </div>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
