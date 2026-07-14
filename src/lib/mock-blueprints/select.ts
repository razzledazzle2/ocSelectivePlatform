import type { BlueprintQuestion, MockBlueprintSpec } from '@/lib/mock-blueprints/types'

/** A candidate question the selector may pick, plus fields used only for ranking. */
export interface SelectionCandidate extends BlueprintQuestion {
  questionId: string
  /** Normalised question text, used to avoid near-duplicate stems. */
  normalizedText?: string
  /** True when the question was used recently (recent mock / recent attempt). */
  recentlyUsed?: boolean
}

export interface SelectionOptions {
  /** Seed for deterministic tie-breaking. Same seed + same pool → same result. */
  seed?: number
  /** Question ids to exclude (already selected elsewhere). */
  exclude?: Set<string>
  /** Target count when the blueprint has no explicit total. */
  targetCount?: number
}

export interface SelectionResult {
  selected: SelectionCandidate[]
  notes: string[]
}

/** Small, fast, deterministic PRNG so tie-breaks are stable without Math.random. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface SelectionState {
  domainCounts: Map<string, number>
  difficultyCounts: Map<number, number>
  subtopicCounts: Map<string, number>
  patternKeys: Set<string>
  answerCounts: Map<string, number>
  textKeys: Set<string>
}

/** The requested target before clamping to the pool (used to warn on shortfall). */
function desiredTarget(spec: MockBlueprintSpec, options: SelectionOptions, poolSize: number): number {
  const fromSpec = spec.totalQuestions?.max ?? spec.totalQuestions?.min
  return Math.max(0, fromSpec ?? options.targetCount ?? poolSize)
}

/**
 * Deterministically select questions from `pool` to best satisfy `spec`.
 *
 * The selector is greedy and constraint-ordered, matching the required ranking:
 *   satisfy required subtopics first → prioritise scarce constraints →
 *   fill domain targets → fill difficulty targets → maximise distinct pattern
 *   keys → avoid recently-used → avoid near-duplicate text → improve answer
 *   distribution. Ties break via a seeded PRNG so the same inputs always give
 *   the same paper (optional seeded randomness, never model-driven).
 */
export function selectQuestionsForBlueprint(
  pool: SelectionCandidate[],
  spec: MockBlueprintSpec,
  options: SelectionOptions = {}
): SelectionResult {
  const exclude = options.exclude ?? new Set<string>()
  const rand = mulberry32(options.seed ?? 1)
  const notes: string[] = []

  const available = pool.filter((candidate) => !exclude.has(candidate.questionId))
  const desired = desiredTarget(spec, options, available.length)
  const target = Math.min(desired, available.length)

  if (desired > available.length) {
    notes.push(`Only ${available.length} eligible question${available.length === 1 ? '' : 's'} for a target of ${desired}.`)
  }

  const state: SelectionState = {
    domainCounts: new Map(),
    difficultyCounts: new Map(),
    subtopicCounts: new Map(),
    patternKeys: new Set(),
    answerCounts: new Map(),
    textKeys: new Set(),
  }

  const selected: SelectionCandidate[] = []
  const remaining = [...available]

  while (selected.length < target && remaining.length > 0) {
    let bestIndex = -1
    let bestScore = -Infinity
    for (let index = 0; index < remaining.length; index += 1) {
      const score = scoreCandidate(remaining[index], spec, state, rand)
      if (score > bestScore) {
        bestScore = score
        bestIndex = index
      }
    }
    if (bestIndex === -1) break
    const [chosen] = remaining.splice(bestIndex, 1)
    applyToState(chosen, state)
    selected.push(chosen)
  }

  return { selected, notes }
}

/**
 * Higher score = better next pick given the current selection state. Weights are
 * ordered so earlier concerns dominate later ones. A tiny seeded jitter breaks
 * exact ties deterministically.
 */
function scoreCandidate(
  candidate: SelectionCandidate,
  spec: MockBlueprintSpec,
  state: SelectionState,
  rand: () => number
): number {
  let score = 0

  // 1. Required subtopics still unmet — strongest pull.
  if (candidate.subtopicCode) {
    const req = spec.requiredSubtopics?.find((entry) => entry.subtopicCode === candidate.subtopicCode)
    if (req) {
      const have = state.subtopicCounts.get(candidate.subtopicCode) ?? 0
      if (have < (req.min ?? 1)) score += 1000
    }
  }

  // 2. Domain targets below their min — scarce constraints prioritised.
  if (candidate.domainCode) {
    const target = spec.domainTargets?.find((entry) => entry.domainCode === candidate.domainCode)
    if (target) {
      const have = state.domainCounts.get(candidate.domainCode) ?? 0
      if (target.min != null && have < target.min) score += 400
      if (target.max != null && have >= target.max) score -= 800 // over cap: strongly avoid
    }
  }

  // 3. Difficulty targets below their min.
  const diffTarget = spec.difficultyTargets?.find((entry) => entry.difficulty === candidate.difficulty)
  if (diffTarget) {
    const have = state.difficultyCounts.get(candidate.difficulty) ?? 0
    if (diffTarget.min != null && have < diffTarget.min) score += 200
    if (diffTarget.max != null && have >= diffTarget.max) score -= 600
  }

  // 4. Maximise distinct pattern keys.
  if (candidate.patternKey && !state.patternKeys.has(candidate.patternKey)) {
    score += 60
  }

  // 5. Avoid recently used.
  if (candidate.recentlyUsed) {
    score -= 120
  }

  // 6. Avoid near-duplicate text.
  if (candidate.normalizedText && state.textKeys.has(candidate.normalizedText)) {
    score -= 300
  }

  // 7. Improve answer distribution — deprioritise the currently commonest answer.
  if (candidate.correctOptionLabel) {
    const have = state.answerCounts.get(candidate.correctOptionLabel) ?? 0
    score -= have * 8
  }

  // Deterministic tie-break.
  score += rand()

  return score
}

function applyToState(candidate: SelectionCandidate, state: SelectionState): void {
  if (candidate.domainCode) {
    state.domainCounts.set(candidate.domainCode, (state.domainCounts.get(candidate.domainCode) ?? 0) + 1)
  }
  state.difficultyCounts.set(candidate.difficulty, (state.difficultyCounts.get(candidate.difficulty) ?? 0) + 1)
  if (candidate.subtopicCode) {
    state.subtopicCounts.set(candidate.subtopicCode, (state.subtopicCounts.get(candidate.subtopicCode) ?? 0) + 1)
  }
  if (candidate.patternKey) {
    state.patternKeys.add(candidate.patternKey)
  }
  if (candidate.correctOptionLabel) {
    state.answerCounts.set(candidate.correctOptionLabel, (state.answerCounts.get(candidate.correctOptionLabel) ?? 0) + 1)
  }
  if (candidate.normalizedText) {
    state.textKeys.add(candidate.normalizedText)
  }
}
