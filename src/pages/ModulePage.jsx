import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { modulesData } from '../data/modules';

const MotionDiv = motion.div;

export default function ModulePage() {
  const { id } = useParams();
  const mod = modulesData.find(m => m.id === id);

  if (!mod) {
    return <Navigate to="/" replace />;
  }

  const slideUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } },
  };

  return (
    <section className="pt-32 pb-24 px-6 bg-[var(--color-bg-alt)] min-h-[calc(100vh-80px)] flex items-center">
      <div className="max-w-6xl mx-auto w-full">
        {/* Back Link */}
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors font-medium text-sm group">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 group-hover:-translate-x-1 transition-transform">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Back to Platform
          </Link>
        </div>

        <MotionDiv
          initial="hidden" animate="visible" variants={slideUp}
          className="bg-white border-airtable rounded-feature p-8 md:p-12 shadow-airtable"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <span className="micro-label text-[11px] text-[var(--color-text-muted)]">{mod.tag}</span>
                <span className="text-xs text-[var(--color-border)]">·</span>
                <span className="micro-label text-[11px] text-[var(--color-text-muted)]">Module {mod.num}</span>
              </div>
              <h1 className="font-bold text-4xl text-display">{mod.title}</h1>
              <p className="font-semibold text-2xl text-[var(--color-text-main)] leading-snug">{mod.headline}</p>
              <p className="text-[var(--color-text-muted)] leading-relaxed text-[17px] text-body">{mod.detail}</p>
            </div>
            <div className="space-y-4 lg:pt-16 bg-[var(--color-bg-alt)] p-6 md:p-8 rounded-feature border border-[var(--color-border)]">
              <p className="micro-label text-[11px] text-[var(--color-text-main)] mb-6">Key Capabilities</p>
              {mod.bullets.map((b, j) => (
                <div key={j} className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-[var(--color-accent)] flex-shrink-0 flex items-center justify-center mt-0.5 shadow-sm">
                    <svg width="12" height="12" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <p className="text-[16px] text-[var(--color-text-secondary)] leading-relaxed text-body font-medium">{b}</p>
                </div>
              ))}
            </div>
          </div>
        </MotionDiv>
      </div>
    </section>
  );
}
