/**
 * Dashboard weak/strong analysis + revision-due roll-up tests.
 *
 * The key guarantee: the new area-grouped path (fed by the get_student_area_stats
 * Postgres function) produces IDENTICAL insights to the old per-attempt path, so
 * moving the grouping into SQL preserves statistical semantics.
 * Run: node --test --experimental-strip-types "src/lib/dashboard/*.test.ts"
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  computeWeakStrong,
  computeWeakStrongFromAreas,
  groupAttemptsToAreas,
  summariseRevisionDue,
  type AttemptForAnalysis,
} from './analysis.ts'

function attempt(
  subjectName: string | null,
  topicName: string | null,
  questionTypeName: string | null,
  isCorrect: boolean
): AttemptForAnalysis {
  return { subjectName, topicName, questionTypeName, isCorrect }
}

test('no attempts → not enough data', () => {
  const insights = computeWeakStrong([])
  assert.equal(insights.hasEnoughData, false)
  assert.equal(insights.weakest, null)
  assert.equal(insights.strongest, null)
})

test('below MIN_TOTAL_ATTEMPTS (8) → not enough data even with a full area', () => {
  // 7 attempts, all in one area with >= 4 attempts.
  const attempts = Array.from({ length: 7 }, (_, i) => attempt('Maths', 'Fractions', 'MCQ', i % 2 === 0))
  assert.equal(computeWeakStrong(attempts).hasEnoughData, false)
})

test('areas below MIN_ATTEMPTS_PER_AREA (4) are ignored', () => {
  const attempts = [
    // Weak area with only 3 attempts — must NOT be selected as weakest.
    attempt('Maths', 'Thin', 'MCQ', false),
    attempt('Maths', 'Thin', 'MCQ', false),
    attempt('Maths', 'Thin', 'MCQ', false),
    // Qualifying area (4 attempts, 75%).
    attempt('Maths', 'Solid', 'MCQ', true),
    attempt('Maths', 'Solid', 'MCQ', true),
    attempt('Maths', 'Solid', 'MCQ', true),
    attempt('Maths', 'Solid', 'MCQ', false),
    // Padding to clear the total gate.
    attempt('English', 'Extra', 'MCQ', true),
  ]
  const insights = computeWeakStrong(attempts)
  assert.equal(insights.hasEnoughData, true)
  assert.equal(insights.weakest?.topicName, 'Solid')
  assert.equal(insights.weakest?.accuracy, 75)
})

test('weakest and strongest are the lowest / highest qualifying areas', () => {
  const attempts = [
    ...Array.from({ length: 4 }, () => attempt('Maths', 'Weak', 'MCQ', false)), // 0%
    ...Array.from({ length: 4 }, () => attempt('Maths', 'Strong', 'MCQ', true)), // 100%
    ...Array.from({ length: 4 }, (_, i) => attempt('Maths', 'Mid', 'MCQ', i < 2)), // 50%
  ]
  const insights = computeWeakStrong(attempts)
  assert.equal(insights.weakest?.topicName, 'Weak')
  assert.equal(insights.weakest?.accuracy, 0)
  assert.equal(insights.strongest?.topicName, 'Strong')
  assert.equal(insights.strongest?.accuracy, 100)
})

test('a single qualifying area yields no distinct strongest', () => {
  const attempts = Array.from({ length: 10 }, (_, i) => attempt('Maths', 'Only', 'MCQ', i < 6))
  const insights = computeWeakStrong(attempts)
  assert.equal(insights.hasEnoughData, true)
  assert.equal(insights.weakest?.topicName, 'Only')
  assert.equal(insights.strongest, null)
})

test('attempts with no subject are skipped as areas but still count toward the total gate', () => {
  const attempts = [
    // 4 attempts in a real area (25%).
    attempt('Maths', 'Real', 'MCQ', true),
    attempt('Maths', 'Real', 'MCQ', false),
    attempt('Maths', 'Real', 'MCQ', false),
    attempt('Maths', 'Real', 'MCQ', false),
    // 4 subject-less attempts: no area, but they lift the total to 8.
    attempt(null, 'Ghost', 'MCQ', true),
    attempt(null, 'Ghost', 'MCQ', true),
    attempt(null, 'Ghost', 'MCQ', true),
    attempt(null, 'Ghost', 'MCQ', true),
  ]
  const areas = groupAttemptsToAreas(attempts)
  assert.equal(areas.length, 1) // only the Maths/Real area
  const insights = computeWeakStrong(attempts)
  assert.equal(insights.hasEnoughData, true) // total = 8 clears the gate
  assert.equal(insights.weakest?.topicName, 'Real')
})

test('retakes accumulate: repeated attempts on the same area add up', () => {
  const areas = groupAttemptsToAreas([
    attempt('Maths', 'Fractions', 'MCQ', true),
    attempt('Maths', 'Fractions', 'MCQ', true),
    attempt('Maths', 'Fractions', 'MCQ', false),
  ])
  assert.equal(areas.length, 1)
  assert.equal(areas[0].attempts, 3)
  assert.equal(areas[0].correct, 2)
})

test('per-attempt path == area-grouped path (parity across a large mixed history)', () => {
  const subjects = ['Maths', 'English', null]
  const topics = ['A', 'B', 'C', null]
  const types = ['MCQ', 'Cloze', null]
  const attempts: AttemptForAnalysis[] = []
  // Deterministic pseudo-random spread over 6000 attempts.
  for (let i = 0; i < 6000; i += 1) {
    const subject = subjects[i % subjects.length]
    const topic = topics[(i * 7) % topics.length]
    const type = types[(i * 13) % types.length]
    const isCorrect = (i * 31) % 5 < 3
    attempts.push(attempt(subject, topic, type, isCorrect))
  }

  const viaAttempts = computeWeakStrong(attempts)
  const viaAreas = computeWeakStrongFromAreas(groupAttemptsToAreas(attempts), attempts.length)
  assert.deepEqual(viaAreas, viaAttempts)
})

test('revision due roll-up: total, labels and deterministic top three', () => {
  const summary = summariseRevisionDue([
    { subjectName: 'Maths', topicName: 'Fractions', count: 3 },
    { subjectName: 'Maths', topicName: 'Algebra', count: 5 },
    { subjectName: 'English', topicName: null, count: 5 },
    { subjectName: null, topicName: null, count: 2 },
  ])
  assert.equal(summary.dueCount, 15)
  // Sorted by count desc, then label asc. Ties at 5: 'English' < 'Maths — Algebra'.
  assert.deepEqual(summary.topAreas, [
    { name: 'English', count: 5 },
    { name: 'Maths — Algebra', count: 5 },
    { name: 'Maths — Fractions', count: 3 },
  ])
})

test('revision due roll-up: subject-less areas fall back to "General revision"', () => {
  const summary = summariseRevisionDue([{ subjectName: null, topicName: null, count: 4 }])
  assert.equal(summary.dueCount, 4)
  assert.deepEqual(summary.topAreas, [{ name: 'General revision', count: 4 }])
})
