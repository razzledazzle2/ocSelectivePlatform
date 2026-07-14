/**
 * Unit tests for the Mock CSV schema helpers (header aliasing, response-format
 * normalisation, section derivation). Run with: npm test.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildHeaderIndex,
  MOCK_CSV_REQUIRED_HEADERS,
  MOCK_CSV_TEMPLATE_HEADERS,
  normalizeHeaderKey,
  normalizeResponseFormat,
  normalizeSectionKey,
  sectionKeyForSubjectCode,
  subjectSlugForCode,
} from './schema.ts'

test('template headers include every required header', () => {
  for (const header of MOCK_CSV_REQUIRED_HEADERS) {
    assert.ok(MOCK_CSV_TEMPLATE_HEADERS.includes(header), `missing ${header}`)
  }
})

test('header index resolves canonical headers and aliases', () => {
  const index = buildHeaderIndex()
  assert.equal(index.get(normalizeHeaderKey('mock_external_id')), 'mockExternalId')
  assert.equal(index.get(normalizeHeaderKey('Mock ID')), 'mockExternalId')
  assert.equal(index.get(normalizeHeaderKey('correct_option_label')), 'correctAnswer')
  assert.equal(index.get(normalizeHeaderKey('domain_code')), 'domain')
})

test('response format maps to a stored answer_format', () => {
  assert.equal(normalizeResponseFormat('multiple_choice'), 'single_choice')
  assert.equal(normalizeResponseFormat('MCQ'), 'single_choice')
  assert.equal(normalizeResponseFormat('written response'), 'extended_response')
  assert.equal(normalizeResponseFormat('nonsense'), null)
})

test('section key derives from canonical subject code', () => {
  assert.equal(sectionKeyForSubjectCode('mathematical_reasoning'), 'mathematical_reasoning')
  assert.equal(sectionKeyForSubjectCode('thinking_skills'), 'thinking_skills')
  assert.equal(sectionKeyForSubjectCode('reading'), 'reading')
  assert.equal(sectionKeyForSubjectCode('writing'), 'writing')
  assert.equal(sectionKeyForSubjectCode('something_else'), 'custom')
  assert.equal(sectionKeyForSubjectCode(null), 'custom')
})

test('explicit section key is validated; blank → null; unknown → undefined', () => {
  assert.equal(normalizeSectionKey('thinking_skills'), 'thinking_skills')
  assert.equal(normalizeSectionKey(''), null)
  assert.equal(normalizeSectionKey('bogus'), undefined)
})

test('subject code converts to subjects slug', () => {
  assert.equal(subjectSlugForCode('mathematical_reasoning'), 'mathematical-reasoning')
  assert.equal(subjectSlugForCode('thinking_skills'), 'thinking-skills')
})
