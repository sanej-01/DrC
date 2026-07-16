'use client';

import { useState } from 'react';

export default function ScoringChecklistAccordion() {
  const [open, setOpen] = useState(false);

  const dimensions = [
    {
      name: 'Code Quality',
      criteria: [
        'Readability: Clear variable names, function structure',
        'Maintainability: Modularity, DRY principle, no duplication',
        'Best Practices: Follows language conventions, error handling',
      ],
      bands: [
        { score: '80+', desc: 'Well-written, maintainable code' },
        { score: '60-79', desc: 'Decent quality, some improvements needed' },
        { score: '40-59', desc: 'Notable issues, refactoring recommended' },
        { score: '0-39', desc: 'Significant quality concerns' },
      ],
    },
    {
      name: 'Bug Risk',
      note: '(lower score = higher risk)',
      criteria: [
        'Edge Case Handling: Null checks, boundary conditions',
        'Error Handling: Try-catch, error propagation, recovery',
        'Type Safety: Proper typing, no unsafe casts',
        'Logic Correctness: Algorithms correct, no off-by-one errors',
      ],
      bands: [
        { score: '80+', desc: 'Very low risk, robust code' },
        { score: '60-79', desc: 'Acceptable risk, minor edge cases' },
        { score: '40-59', desc: 'Notable risks, potential bugs' },
        { score: '0-39', desc: 'High risk, likely bugs present' },
      ],
    },
    {
      name: 'Architecture',
      criteria: [
        'Separation of Concerns: Modules have single responsibility',
        'Design Patterns: Appropriate patterns used correctly',
        'Scalability: Can handle growth, no obvious bottlenecks',
        'Dependency Management: Minimal coupling, good cohesion',
      ],
      bands: [
        { score: '80+', desc: 'Well-architected, scalable' },
        { score: '60-79', desc: 'Solid design, minor improvements' },
        { score: '40-59', desc: 'Some architectural concerns' },
        { score: '0-39', desc: 'Poor architecture, refactoring needed' },
      ],
    },
    {
      name: 'Test Coverage',
      criteria: [
        'Unit Tests: Functions tested with good assertions',
        'Integration Tests: E2E scenarios covered',
        'Test Quality: Tests are clear, not just coverage checkers',
        'Coverage Percentage: 70%+ is good, 80%+ is excellent',
      ],
      bands: [
        { score: '80+', desc: 'Comprehensive testing' },
        { score: '60-79', desc: 'Good coverage, some gaps' },
        { score: '40-59', desc: 'Partial coverage, needs improvement' },
        { score: '0-39', desc: 'Minimal testing or absent' },
      ],
    },
  ];

  const feedbackTypes = [
    { type: 'GOOD', desc: 'Excellent code, patterns, practices' },
    { type: 'IMPROVE', desc: 'Enhancements for better code' },
    { type: 'FIX', desc: 'Bugs, errors, serious issues (must fix)' },
    { type: 'SUGGEST', desc: 'Alternative approaches or optimizations' },
  ];

  return (
    <div
      className="rounded-[14px] overflow-hidden"
      style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}
    >
      {/* Header toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4"
        style={{ background: 'var(--surface)' }}
      >
        <span className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
          Scoring Checklist
        </span>
        <span
          className="text-[16px] transition-transform duration-200"
          style={{
            color: 'var(--ink-3)',
            display: 'inline-block',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          ▾
        </span>
      </button>

      {/* Collapsible body */}
      {open && (
        <div
          className="px-5 pb-5 space-y-6"
          style={{ borderTop: '1px solid var(--line)' }}
        >
          {/* Four dimensions */}
          {dimensions.map((dim) => (
            <div key={dim.name}>
              <h4 className="text-[14px] font-semibold mb-3" style={{ color: 'var(--ink)' }}>
                {dim.name} {dim.note && <span style={{ color: 'var(--ink-3)', fontWeight: 'normal' }}>{dim.note}</span>}
              </h4>

              {/* Criteria */}
              <div className="mb-3 ml-3 space-y-1">
                {dim.criteria.map((crit, i) => (
                  <p key={i} className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
                    • {crit}
                  </p>
                ))}
              </div>

              {/* Score bands */}
              <div className="space-y-1 ml-3">
                {dim.bands.map((band, i) => (
                  <div key={i} className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
                    <span className="font-semibold">{band.score}:</span> {band.desc}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Feedback types */}
          <div>
            <h4 className="text-[14px] font-semibold mb-3" style={{ color: 'var(--ink)' }}>
              Feedback Types
            </h4>
            <div className="ml-3 space-y-1">
              {feedbackTypes.map((fb, i) => (
                <p key={i} className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
                  <span className="font-semibold">{fb.type}:</span> {fb.desc}
                </p>
              ))}
            </div>
            <p className="text-[12px] mt-3" style={{ color: 'var(--ink-3)' }}>
              Each scan produces 3–5 specific, actionable feedback items with file paths and line numbers where applicable.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
