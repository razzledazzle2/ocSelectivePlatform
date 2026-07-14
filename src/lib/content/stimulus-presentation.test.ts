/**
 * Tests for the pure stimulus-presentation rules that keep Thinking Skills
 * supporting content distinct from Reading passages and hide internal metadata.
 * Run: npm test
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  isInlineSupportingBody,
  resolveStimulusVariant,
  shouldShowStimulusTitle,
} from './stimulus-presentation.ts'

test('Reading gets the passage variant; every other subject gets supporting', () => {
  assert.equal(resolveStimulusVariant('Reading'), 'reading')
  assert.equal(resolveStimulusVariant('Thinking Skills'), 'supporting')
  assert.equal(resolveStimulusVariant('Mathematical Reasoning'), 'supporting')
  assert.equal(resolveStimulusVariant('Writing'), 'supporting')
  assert.equal(resolveStimulusVariant(null), 'supporting')
})

test('a Thinking Skills argument (passage/information_text) shows NO title', () => {
  assert.equal(shouldShowStimulusTitle('supporting', 'passage', 'The pool safety siren'), false)
  assert.equal(shouldShowStimulusTitle('supporting', 'information_text', 'Which vole is it?'), false)
})

test('a Thinking Skills data block (table/logic grid) DOES show its title', () => {
  assert.equal(shouldShowStimulusTitle('supporting', 'table', 'Seedling records'), true)
  assert.equal(shouldShowStimulusTitle('supporting', 'logic_grid', 'Competition rules'), true)
  assert.equal(shouldShowStimulusTitle('supporting', 'chart', 'Bus timetable'), true)
})

test('a Reading passage always shows its title when present', () => {
  assert.equal(shouldShowStimulusTitle('reading', 'passage', 'Night Watcher'), true)
  assert.equal(shouldShowStimulusTitle('reading', 'poem', 'Night Watcher'), true)
})

test('an empty or missing title is never shown', () => {
  assert.equal(shouldShowStimulusTitle('reading', 'passage', ''), false)
  assert.equal(shouldShowStimulusTitle('supporting', 'table', '   '), false)
  assert.equal(shouldShowStimulusTitle('reading', 'passage', null), false)
})

test('short single-block supporting content renders inline (no container)', () => {
  assert.equal(isInlineSupportingBody('Priya says the run raised the most money.'), true)
  assert.equal(isInlineSupportingBody(''), false)
  // Multi-paragraph content is not inline.
  assert.equal(isInlineSupportingBody('Para one.\n\nPara two.'), false)
  // Long content is not inline.
  assert.equal(isInlineSupportingBody('x'.repeat(200)), false)
})
