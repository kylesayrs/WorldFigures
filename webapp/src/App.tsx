import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { loadCategories } from './lib/data';
import { CategorySection } from './components/CategorySection';
import { TocChips, ContentsPage } from './components/TableOfContents';

function App() {
  const sections = useMemo(() => loadCategories(), []);
  const totalTopics = sections.reduce((n, s) => n + s.topics.length, 0);
  const totalFilled = sections.reduce((n, s) => n + s.topics.filter((t) => t.hasData).length, 0);

  return (
    <div className="min-h-screen paper-bg">
      <header className="sticky top-0 z-10 backdrop-blur bg-[#faf7f2]/90 border-b border-[#e4ddd0]">
        <div className="max-w-2xl mx-auto">
          <div className="px-4 pt-4 pb-1 sm:px-6">
            <h1 className="font-serif text-xl font-semibold" style={{ color: '#3a3226' }}>
              World Figures
            </h1>
            <p className="text-xs opacity-60">
              A pocket handbook of statistics for every country &amp; U.S. state
              {totalTopics > 0 && (
                <span className="tabular-nums"> · {totalFilled}/{totalTopics} chapters researched</span>
              )}
            </p>
          </div>
          <TocChips sections={sections} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 sm:px-6 flex flex-col gap-5">
        <ContentsPage sections={sections} />

        {sections.map((section) => (
          <CategorySection key={section.slug} section={section} />
        ))}

        <motion.footer
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-xs opacity-40 py-6"
        >
          Researched one topic at a time.
        </motion.footer>
      </main>
    </div>
  );
}

export default App;
