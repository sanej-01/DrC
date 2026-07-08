/**
 * PR Scoring Prompt & Schema
 * Phase 4.1: Structured 4-rubric scoring prompt
 *
 * Four dimensions, each 0-100:
 * - code_quality: Readability, maintainability, best practices
 * - bug_risk: Potential bugs, edge cases, error handling
 * - architecture: Design patterns, separation of concerns, scalability
 * - test_coverage: Unit tests, integration tests, test quality
 *
 * Feedback types: GOOD, IMPROVE, FIX, SUGGEST
 */

export interface ScoringDimension {
  name: "code_quality" | "bug_risk" | "architecture" | "test_coverage";
  score: number; // 0-100
  reasoning: string; // Why this score
}

export interface ScoringFeedback {
  type: "GOOD" | "IMPROVE" | "FIX" | "SUGGEST";
  dimension: string;
  title: string;
  description: string;
  severity?: "low" | "medium" | "high";
  file_path?: string;
  line_number?: number;
}

export interface ScoringResult {
  code_quality: number;
  bug_risk: number;
  architecture: number;
  test_coverage: number;
  overall_assessment: string; // 1-2 sentence summary
  feedback: ScoringFeedback[];
}

/**
 * Build the scoring prompt for Sonnet
 * Includes diff, PR metadata, and scoring rubrics
 */
export function buildScoringPrompt(
  prNumber: number,
  title: string,
  author: string,
  files_changed: number,
  additions: number,
  deletions: number,
  diff: string
): string {
  const diffPreview = diff.length > 10000 ? diff.substring(0, 10000) + "\n...[truncated]" : diff;

  return `You are an expert code reviewer assessing a GitHub Pull Request for code quality, bug risk, architecture, and test coverage.

## PR Information
- **PR #${prNumber}**: ${title}
- **Author**: ${author}
- **Files Changed**: ${files_changed}
- **Additions**: ${additions}
- **Deletions**: ${deletions}

## PR Diff
\`\`\`
${diffPreview}
\`\`\`

## Scoring Rubric

You must score each dimension on a scale of 0-100:

### 1. Code Quality (0-100)
Score based on:
- Readability: Clear variable names, function structure
- Maintainability: Modularity, DRY principle, no duplication
- Best Practices: Follows language conventions, error handling
- Score 80+: Well-written, maintainable code
- Score 60-79: Decent quality, some improvements needed
- Score 40-59: Notable issues, refactoring recommended
- Score 0-39: Significant quality concerns

### 2. Bug Risk (0-100)
Lower score = higher risk. Score based on:
- Edge Case Handling: Null checks, boundary conditions
- Error Handling: Try-catch, error propagation, recovery
- Type Safety: Proper typing, no unsafe casts
- Logic Correctness: Algorithms correct, no off-by-one errors
- Score 80+: Very low risk, robust code
- Score 60-79: Acceptable risk, minor edge cases
- Score 40-59: Notable risks, potential bugs
- Score 0-39: High risk, likely bugs present

### 3. Architecture (0-100)
Score based on:
- Separation of Concerns: Modules have single responsibility
- Design Patterns: Appropriate patterns used correctly
- Scalability: Can handle growth, no obvious bottlenecks
- Dependency Management: Minimal coupling, good cohesion
- Score 80+: Well-architected, scalable
- Score 60-79: Solid design, minor improvements
- Score 40-59: Some architectural concerns
- Score 0-39: Poor architecture, refactoring needed

### 4. Test Coverage (0-100)
Score based on:
- Unit Tests: Functions tested with good assertions
- Integration Tests: E2E scenarios covered
- Test Quality: Tests are clear, not just coverage checkers
- Coverage Percentage: 70%+ is good, 80%+ is excellent
- Score 80+: Comprehensive testing
- Score 60-79: Good coverage, some gaps
- Score 40-59: Partial coverage, needs improvement
- Score 0-39: Minimal testing or absent

## Output Format

You MUST respond with ONLY a valid JSON object (no markdown, no explanation) in this exact format:

\`\`\`json
{
  "code_quality": <0-100>,
  "bug_risk": <0-100>,
  "architecture": <0-100>,
  "test_coverage": <0-100>,
  "overall_assessment": "<1-2 sentence summary>",
  "feedback": [
    {
      "type": "GOOD|IMPROVE|FIX|SUGGEST",
      "dimension": "code_quality|bug_risk|architecture|test_coverage",
      "title": "<short title>",
      "description": "<detailed description>",
      "severity": "low|medium|high",
      "file_path": "<optional file path>",
      "line_number": <optional line number>
    }
  ]
}
\`\`\`

## Feedback Guidelines

- **GOOD**: Highlight excellent code, patterns, or practices
- **IMPROVE**: Suggest enhancements that would improve code
- **FIX**: Flag bugs, errors, or serious issues
- **SUGGEST**: Propose alternative approaches or optimizations

Include 3-5 feedback items covering all dimensions. Be specific and actionable.`;
}

/**
 * Build triage prompt (quick assessment, cheaper Haiku model)
 * Used to determine if full scoring is needed
 */
export function buildTriagePrompt(
  prNumber: number,
  title: string,
  author: string,
  files_changed: number,
  additions: number,
  deletions: number
): string {
  return `Quick triage assessment of GitHub PR.

PR #${prNumber}: ${title}
- Author: ${author}
- Files: ${files_changed}, +${additions}/-${deletions}

Assess if this PR likely needs full scoring (Sonnet) or can be skipped (empty/trivial).
Respond with JSON:
{
  "should_score": true/false,
  "reason": "string",
  "confidence": 0.0-1.0
}`;
}

/**
 * Validate scoring result schema
 */
export function validateScoringResult(result: any): result is ScoringResult {
  if (!result || typeof result !== "object") return false;

  const hasScores =
    typeof result.code_quality === "number" &&
    typeof result.bug_risk === "number" &&
    typeof result.architecture === "number" &&
    typeof result.test_coverage === "number" &&
    result.code_quality >= 0 &&
    result.code_quality <= 100 &&
    result.bug_risk >= 0 &&
    result.bug_risk <= 100 &&
    result.architecture >= 0 &&
    result.architecture <= 100 &&
    result.test_coverage >= 0 &&
    result.test_coverage <= 100;

  const hasAssessment =
    typeof result.overall_assessment === "string" && result.overall_assessment.length > 0;

  const hasFeedback =
    Array.isArray(result.feedback) &&
    result.feedback.every(
      (f) =>
        ["GOOD", "IMPROVE", "FIX", "SUGGEST"].includes(f.type) &&
        ["code_quality", "bug_risk", "architecture", "test_coverage"].includes(f.dimension) &&
        typeof f.title === "string" &&
        typeof f.description === "string"
    );

  return hasScores && hasAssessment && hasFeedback;
}
