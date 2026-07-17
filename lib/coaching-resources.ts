/**
 * Curated coaching resources. Each coaching suggestion is matched to a
 * best-practice article (stable, reputable sources) and a topic-targeted
 * YouTube search that always surfaces fresh best-practice videos, plus a
 * short authored summary used for the Text popup and read aloud by the
 * Voice option.
 *
 * Resolution order: keyword match on the coaching title/description
 * first (most specific), then a per-dimension default, then a generic
 * fallback. Videos use YouTube search URLs on purpose so they never
 * dead-link as individual uploads get removed or renamed.
 */

import { normalizeDimension } from "./coaching-derive";

export interface CoachingResource {
  title: string;
  summary: string;
  article: string;
  articleSource: string;
  video: string;
}

function ytSearch(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

interface KeywordEntry {
  keywords: string[];
  resource: CoachingResource;
}

// Most specific first — the first entry whose keyword appears in the
// coaching text wins.
const KEYWORD_RESOURCES: KeywordEntry[] = [
  {
    keywords: ["error handling", "try-catch", "try catch", "exception", "propagation", "throw"],
    resource: {
      title: "Robust error handling",
      summary:
        "Good error handling means anticipating where calls can fail — network requests, parsing, I/O — and handling those failures explicitly instead of letting them bubble up as crashes. Wrap risky calls in try/catch, surface a meaningful message, and decide deliberately whether to recover, retry, or fail fast. Never swallow an error silently; at minimum log it with enough context to debug.",
      article:
        "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Control_flow_and_error_handling",
      articleSource: "MDN Web Docs",
      video: ytSearch("error handling best practices api calls"),
    },
  },
  {
    keywords: ["validation", "validate", "input", "sanitize", "untrusted"],
    resource: {
      title: "Input validation",
      summary:
        "Validate every input that crosses a trust boundary — request bodies, query params, form fields — before you use it. Prefer allow-lists over deny-lists, check type and range, and reject early with a clear error. Treating all external input as untrusted prevents both bugs and security holes like injection.",
      article:
        "https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html",
      articleSource: "OWASP Cheat Sheet Series",
      video: ytSearch("input validation best practices"),
    },
  },
  {
    keywords: ["null", "undefined", "optional chaining", "nullable", "npe"],
    resource: {
      title: "Handling null & undefined safely",
      summary:
        "Most runtime crashes trace back to reading a property of something that turned out to be null or undefined. Guard access with optional chaining and nullish defaults, and narrow types before you dereference. Making the 'absent value' case explicit turns a class of production crashes into handled paths.",
      article:
        "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining",
      articleSource: "MDN Web Docs",
      video: ytSearch("avoiding null reference errors javascript"),
    },
  },
  {
    keywords: ["async", "await", "promise", "race condition", "concurren"],
    resource: {
      title: "Async & promise patterns",
      summary:
        "Asynchronous code is where subtle bugs hide: unawaited promises, unhandled rejections, and race conditions between overlapping requests. Always await or explicitly handle every promise, add rejection handling, and guard state updates against out-of-order responses. Predictable async flow keeps data consistent.",
      article:
        "https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Promises",
      articleSource: "MDN Web Docs",
      video: ytSearch("javascript async await best practices race conditions"),
    },
  },
  {
    keywords: ["security", "injection", "xss", "secret", "credential", "auth"],
    resource: {
      title: "Secure coding basics",
      summary:
        "Security bugs are correctness bugs with higher stakes. Never trust client input, keep secrets out of source and logs, use parameterized queries, and apply least privilege to tokens and roles. A short security checklist on every change catches the common, high-impact mistakes.",
      article: "https://cheatsheetseries.owasp.org/",
      articleSource: "OWASP Cheat Sheet Series",
      video: ytSearch("secure coding best practices web"),
    },
  },
  {
    keywords: ["duplicat", "dry", "repeat", "copy paste", "copy-paste"],
    resource: {
      title: "Don't Repeat Yourself (DRY)",
      summary:
        "Duplicated logic means every fix has to be made in several places, and the ones you miss become bugs. When you see the same code a third time, extract it into a well-named function or module so there's a single source of truth. Deduplicate behaviour, not just text that happens to look alike.",
      article: "https://en.wikipedia.org/wiki/Don%27t_repeat_yourself",
      articleSource: "Wikipedia",
      video: ytSearch("DRY principle avoid code duplication"),
    },
  },
  {
    keywords: ["naming", "rename", "variable name", "readab", "unclear name"],
    resource: {
      title: "Naming for readability",
      summary:
        "Names are the cheapest documentation you have. A good name says what a thing is or does so the reader doesn't have to trace the implementation. Prefer intention-revealing names over abbreviations, keep them consistent across the codebase, and rename freely as your understanding improves.",
      article: "https://martinfowler.com/bliki/TwoHardThings.html",
      articleSource: "martinfowler.com",
      video: ytSearch("clean code naming variables functions"),
    },
  },
  {
    keywords: ["complex", "long function", "long method", "nesting", "cyclomatic", "refactor"],
    resource: {
      title: "Taming complexity",
      summary:
        "Long, deeply nested functions are hard to test and easy to break. Extract cohesive pieces into small functions with clear names, replace nested conditionals with early returns or guard clauses, and keep each function doing one thing. Smaller units are easier to reason about and to cover with tests.",
      article: "https://refactoring.guru/refactoring/smells",
      articleSource: "Refactoring.Guru",
      video: ytSearch("refactoring reduce complexity clean code"),
    },
  },
  {
    keywords: ["coupl", "dependenc", "module boundary", "separation of concern"],
    resource: {
      title: "Reducing coupling",
      summary:
        "Tightly coupled modules ripple change: touching one forces edits across many. Depend on small, stable interfaces rather than concrete details, keep responsibilities separated, and let modules talk through clear boundaries. Loose coupling makes the system safer to change and easier to test in isolation.",
      article: "https://martinfowler.com/architecture/",
      articleSource: "martinfowler.com",
      video: ytSearch("software architecture coupling cohesion principles"),
    },
  },
  {
    keywords: ["test", "coverage", "unit test", "assertion", "mock", "untested"],
    resource: {
      title: "Effective testing",
      summary:
        "Tests are what let you change code with confidence. Aim to cover the behaviour that matters — the happy path plus the edge and failure cases — rather than chasing a coverage percentage. Keep tests fast, focused, and readable so they act as living documentation of what the code is supposed to do.",
      article: "https://martinfowler.com/bliki/UnitTest.html",
      articleSource: "martinfowler.com",
      video: ytSearch("unit testing best practices"),
    },
  },
];

// Per-dimension fallback when no keyword matches.
const DIMENSION_RESOURCES: Record<string, CoachingResource> = {
  bug_risk: {
    title: "Defensive programming",
    summary:
      "Bug-risk is about the failures that reach production. Anticipate what can go wrong — bad input, missing data, failed calls — and handle those cases explicitly with validation, error handling, and guard clauses. Making failure paths visible turns silent crashes into controlled, debuggable behaviour.",
    article:
      "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Control_flow_and_error_handling",
    articleSource: "MDN Web Docs",
    video: ytSearch("defensive programming prevent bugs"),
  },
  code_quality: {
    title: "Clean code & code smells",
    summary:
      "Code quality is how easily the next person — often future you — can read and change the code. Watch for the common smells: long functions, unclear names, duplication, and dead code. Small, well-named, single-purpose units with consistent style keep a codebase healthy as it grows.",
    article: "https://refactoring.guru/refactoring/smells",
    articleSource: "Refactoring.Guru",
    video: ytSearch("clean code best practices"),
  },
  architecture: {
    title: "Software architecture principles",
    summary:
      "Architecture is about the boundaries between parts of your system and how they depend on each other. Keep responsibilities separated, depend on stable interfaces, and avoid tangling unrelated concerns. Good structure makes features cheaper to add and changes safer to make.",
    article: "https://martinfowler.com/architecture/",
    articleSource: "martinfowler.com",
    video: ytSearch("software architecture principles for developers"),
  },
  test_coverage: {
    title: "Test coverage that matters",
    summary:
      "Coverage is a means, not the goal — the point is confidence that the code behaves. Prioritise tests for the logic that would hurt most if it broke, including edge and failure cases, and keep them fast and readable. Meaningful tests let you refactor and ship without fear.",
    article: "https://martinfowler.com/bliki/TestCoverage.html",
    articleSource: "martinfowler.com",
    video: ytSearch("unit testing best practices code coverage"),
  },
};

const GENERIC_RESOURCE: CoachingResource = {
  title: "Engineering best practices",
  summary:
    "Strong engineering habits compound: clear names, small focused functions, explicit error handling, and tests for the behaviour that matters. Review each change against a short quality checklist and leave the code a little better than you found it.",
  article: "https://refactoring.guru/refactoring/smells",
  articleSource: "Refactoring.Guru",
  video: ytSearch("software engineering best practices"),
};

export function resolveCoachingResource(input: {
  dimension?: string | null;
  headline?: string | null;
  body?: string | null;
}): CoachingResource {
  const text = `${input.headline || ""} ${input.body || ""}`.toLowerCase();

  for (const entry of KEYWORD_RESOURCES) {
    if (entry.keywords.some((k) => text.includes(k))) {
      return entry.resource;
    }
  }

  const dimKey = normalizeDimension(input.dimension);
  if (dimKey && dimKey in DIMENSION_RESOURCES) {
    return DIMENSION_RESOURCES[dimKey];
  }

  return GENERIC_RESOURCE;
}
