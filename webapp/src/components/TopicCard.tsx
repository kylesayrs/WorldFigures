import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { TopicEntry } from '../lib/data';
import type { CategoryTheme } from '../lib/theme';
import { humanizeSlug, scopeLabel } from '../lib/format';
import { PlaceList, SourceFootnote } from './PlaceList';

interface Props {
  topic: TopicEntry;
  theme: CategoryTheme;
}

export function TopicCard({ topic, theme }: Props) {
  const [open, setOpen] = useState(false);
  const title = topic.source?.title || humanizeSlug(topic.slug);
  const totalCoverage = topic.countryValues.length + topic.stateValues.length;
  const maxCoverage =
    Number(topic.source?.coverageTotal) ||
    (topic.scopes.includes('countries') ? 197 : 0) + (topic.scopes.includes('states') ? 51 : 0);

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
          {(topic.description || topic.source?.definition) && (
            <p className="text-xs opacity-70 truncate">{topic.description || topic.source?.definition}</p>
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

              {topic.countryValues.length > 0 && (
                <div className="mb-3">
                  {topic.stateValues.length > 0 && (
                    <p className="text-xs font-medium mb-1 opacity-80">Countries</p>
                  )}
                  <PlaceList values={topic.countryValues} unit={topic.source?.unit ?? ''} theme={theme} />
                </div>
              )}

              {topic.stateValues.length > 0 && (
                <div>
                  {topic.countryValues.length > 0 && (
                    <p className="text-xs font-medium mb-1 opacity-80">U.S. States</p>
                  )}
                  <PlaceList values={topic.stateValues} unit={topic.source?.unit ?? ''} theme={theme} />
                </div>
              )}

              {topic.source && <SourceFootnote source={topic.source} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
