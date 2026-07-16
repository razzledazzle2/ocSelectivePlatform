/**
 * Unit tests for the canonical taxonomy.
 * Run with:  node --test --experimental-strip-types "src/lib/taxonomy/*.test.ts"
 * (wired to `npm test`). No test-runner dependency is required.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  TAXONOMY,
  getSubjects,
  getStudentVisibleSubjects,
  getAdminVisibleSubjects,
  getDomainsForSubject,
  getSubtopicsForDomain,
  getSuggestedSkillsForSubtopic,
  getAllDomains,
  getAllSubtopics,
  getAllSkills,
  getSubtopicCodesForDomain,
  resolveCanonicalDomainCode,
  getSubtopic,
  getSubtopicLabel,
  getLabelForCode,
  isValidDomainForSubject,
  isValidSubtopicForDomain,
  isValidSkillForSubtopic,
  validateCombination,
  resolveLegacyTaxonomy,
  resolveLegacySubject,
  resolveLegacyWritingForm,
  normalizeLegacyKey,
  isValidDimensionValue,
  getDimensionLabel,
  QUESTION_FAMILIES,
  STIMULUS_FORMATS,
  STIMULUS_GENRES,
  ASSET_RENDER_METHODS,
  WRITING_FORMS,
  WRITING_PURPOSES,
  WRITING_PROMPT_STIMULI,
  getSubject,
  getDomainLabel,
  resolveDomainCode,
  resolveSubtopicCode,
  resolveSkillCode,
} from './canonical-taxonomy.ts'

/* ------------------------------- unique codes ---------------------------- */

test('all taxonomy codes are globally unique across the hierarchy', () => {
  const codes: string[] = []
  for (const subject of TAXONOMY) {
    codes.push(subject.code)
    for (const domain of subject.domains) {
      codes.push(domain.code)
      for (const subtopic of domain.subtopics) {
        codes.push(subtopic.code)
        for (const skill of subtopic.skills) codes.push(skill.code)
      }
    }
  }
  const seen = new Set<string>()
  const dupes = codes.filter((code) => (seen.has(code) ? true : (seen.add(code), false)))
  assert.deepEqual(dupes, [], `duplicate codes: ${dupes.join(', ')}`)
})

test('codes use the snake_case machine-readable convention', () => {
  for (const node of [...getSubjects(), ...getAllDomains(), ...getAllSubtopics(), ...getAllSkills()]) {
    assert.match(node.code, /^[a-z0-9_]+$/, `bad code "${node.code}"`)
    assert.ok(node.label.length > 0, `empty label for ${node.code}`)
  }
})

test('each metadata dimension has unique codes and labels', () => {
  const dimensions = [
    QUESTION_FAMILIES,
    STIMULUS_FORMATS,
    STIMULUS_GENRES,
    ASSET_RENDER_METHODS,
    WRITING_FORMS,
    WRITING_PURPOSES,
    WRITING_PROMPT_STIMULI,
  ]
  for (const dimension of dimensions) {
    const codes = dimension.map((item) => item.code)
    assert.equal(new Set(codes).size, codes.length, `dupe codes in ${codes.join(',')}`)
  }
})

/* ----------------------- valid parent-child relations -------------------- */

test('every domain/subtopic/skill back-references a real ancestor', () => {
  for (const subtopic of getAllSubtopics()) {
    assert.ok(isValidDomainForSubject(subtopic.subjectCode, subtopic.domainCode), subtopic.code)
    assert.ok(isValidSubtopicForDomain(subtopic.domainCode, subtopic.code), subtopic.code)
  }
  for (const skill of getAllSkills()) {
    assert.ok(isValidSkillForSubtopic(skill.subtopicCode, skill.code), skill.code)
  }
})

test('Area and perimeter is a single subtopic with the specified skills', () => {
  const areaPerimeter = getSubtopic('area_and_perimeter')
  assert.ok(areaPerimeter, 'area_and_perimeter subtopic should exist')
  const skillCodes = getSuggestedSkillsForSubtopic('area_and_perimeter').map((skill) => skill.code)
  assert.deepEqual(skillCodes, [
    'rectangle_area',
    'composite_area',
    'missing_side_length',
    'basic_perimeter',
    'composite_perimeter',
    'comparing_area_and_perimeter',
    'area_with_algebra',
    'perimeter_with_algebra',
  ])
})

test('Drawing conclusions is a subtopic under Logic and Deduction', () => {
  const drawing = getSubtopic('drawing_conclusions')
  assert.ok(drawing)
  assert.equal(drawing?.domainCode, 'logic_deduction')
  assert.equal(drawing?.subjectCode, 'thinking_skills')
})

test('Quantitative and Data Reasoning replaces Mathematical Analysis', () => {
  const domains = getDomainsForSubject('thinking_skills').map((domain) => domain.code)
  assert.ok(domains.includes('quantitative_data_reasoning'))
  assert.ok(!domains.includes('mathematical_analysis'))
})

/* ------------------------------ visibility -------------------------------- */

test('Writing is admin-visible but not student-visible', () => {
  const student = getStudentVisibleSubjects().map((subject) => subject.code)
  const admin = getAdminVisibleSubjects().map((subject) => subject.code)
  assert.ok(!student.includes('writing'))
  assert.ok(admin.includes('writing'))
  assert.deepEqual(student, ['reading', 'mathematical_reasoning', 'thinking_skills'])
})

/* --------------------------- combination validation ---------------------- */

test('valid Subject→Domain→Subtopic→Skill combinations pass', () => {
  const result = validateCombination({
    subjectCode: 'mathematical_reasoning',
    domainCode: 'measurement_financial',
    subtopicCode: 'area_and_perimeter',
    skillCode: 'composite_area',
  })
  assert.equal(result.valid, true, JSON.stringify(result.issues))
})

test('invalid combinations are rejected with issues', () => {
  // Domain belongs to a different subject.
  const wrongDomain = validateCombination({ subjectCode: 'reading', domainCode: 'number_algebra' })
  assert.equal(wrongDomain.valid, false)
  assert.equal(wrongDomain.issues[0]?.field, 'domain')

  // Subtopic not under the given domain.
  const wrongSubtopic = validateCombination({
    subjectCode: 'mathematical_reasoning',
    domainCode: 'number_algebra',
    subtopicCode: 'area_and_perimeter',
  })
  assert.equal(wrongSubtopic.valid, false)

  // Skill not under the given subtopic.
  const wrongSkill = validateCombination({ subtopicCode: 'fractions', skillCode: 'composite_area' })
  assert.equal(wrongSkill.valid, false)

  // Unknown codes.
  assert.equal(validateCombination({ subjectCode: 'nope' }).valid, false)
})

test('partial selections (subject only, or subject+domain) are allowed', () => {
  assert.equal(validateCombination({ subjectCode: 'reading' }).valid, true)
  assert.equal(
    validateCombination({ subjectCode: 'reading', domainCode: 'poetry' }).valid,
    true
  )
  assert.equal(validateCombination({}).valid, true)
})

/* ------------------------------ legacy maps ------------------------------- */

test('normalizeLegacyKey collapses slugs, labels and separators alike', () => {
  assert.equal(normalizeLegacyKey('Area & Perimeter'), 'areaperimeter')
  assert.equal(normalizeLegacyKey('area-perimeter'), 'areaperimeter')
  assert.equal(normalizeLegacyKey('Mathematical Analysis'), 'mathematicalanalysis')
})

test('documented legacy mappings resolve to canonical codes', () => {
  const cases: Array<[string, { subjectCode: string; domainCode?: string; subtopicCode?: string; stimulusGenre?: string }]> = [
    ['extracts', { subjectCode: 'reading', domainCode: 'comprehension_comparison' }],
    ['Poetry', { subjectCode: 'reading', domainCode: 'poetry' }],
    ['Area', { subjectCode: 'mathematical_reasoning', domainCode: 'measurement_financial', subtopicCode: 'area_and_perimeter' }],
    ['perimeter', { subjectCode: 'mathematical_reasoning', domainCode: 'measurement_financial', subtopicCode: 'area_and_perimeter' }],
    ['Mathematical analysis', { subjectCode: 'thinking_skills', domainCode: 'quantitative_data_reasoning' }],
    ['Arguments', { subjectCode: 'thinking_skills', domainCode: 'arguments_evidence' }],
    ['Logic', { subjectCode: 'thinking_skills', domainCode: 'logic_deduction' }],
    ['Abstract reasoning', { subjectCode: 'thinking_skills', domainCode: 'abstract_spatial_reasoning' }],
    ['Drawing conclusions', { subjectCode: 'thinking_skills', domainCode: 'logic_deduction', subtopicCode: 'drawing_conclusions' }],
    ['Arithmetic Operations', { subjectCode: 'mathematical_reasoning', domainCode: 'number_algebra', subtopicCode: 'arithmetic_number_reasoning' }],
    ['Time', { subjectCode: 'mathematical_reasoning', domainCode: 'measurement_financial', subtopicCode: 'time_and_timetables' }],
  ]
  for (const [raw, expected] of cases) {
    const { matched, mapping } = resolveLegacyTaxonomy(raw)
    assert.ok(matched, `expected "${raw}" to match`)
    assert.equal(mapping?.subjectCode, expected.subjectCode, raw)
    if (expected.domainCode) assert.equal(mapping?.domainCode, expected.domainCode, raw)
    if (expected.subtopicCode) assert.equal(mapping?.subtopicCode, expected.subtopicCode, raw)
    if (expected.stimulusGenre) assert.equal(mapping?.stimulusGenre, expected.stimulusGenre, raw)
  }
})

test('Narrative maps to a Reading stimulus genre, not a subtopic', () => {
  const { mapping } = resolveLegacyTaxonomy('Narrative')
  assert.equal(mapping?.subjectCode, 'reading')
  assert.equal(mapping?.stimulusGenre, 'narrative_fiction')
  assert.equal(mapping?.subtopicCode, undefined)
})

test('every legacy mapping points at codes that actually exist', () => {
  const legacySamples = [
    'narrative-extracts', 'cloze-passage', 'paired-extracts', 'information-texts', 'main-idea',
    'inference', 'vocabulary-in-context', 'author-purpose', 'detail-questions', 'synonyms', 'antonyms',
    'word-meaning', 'arithmetic', 'arithmetic-operations', 'fractions', 'decimals', 'percentages',
    'ratio-rates', 'ratios', 'algebra', 'patterns', 'number-patterns', 'area', 'perimeter',
    'area-perimeter', 'time', 'money', 'units-length', 'volume', 'angles', 'symmetry-transformations',
    'coordinates', 'geometry', 'tables-graphs', 'data-interpretation', 'statistics', 'probability',
    'argument-analysis', 'arguments', 'assumptions', 'strengthen-and-weaken', 'evidence-reasoning',
    'logic', 'deduction', 'drawing-conclusions', 'ordering-sets', 'truth-puzzles', 'mathematical-analysis',
    'abstract-reasoning', 'spatial-reasoning', 'pattern-recognition',
  ]
  for (const raw of legacySamples) {
    const { matched, mapping } = resolveLegacyTaxonomy(raw)
    assert.ok(matched, `legacy "${raw}" should resolve`)
    assert.ok(mapping)
    assert.ok(getLabelForCode(mapping!.subjectCode), `subject ${mapping!.subjectCode}`)
    if (mapping!.domainCode) assert.ok(getLabelForCode(mapping!.domainCode), `domain ${mapping!.domainCode}`)
    if (mapping!.subtopicCode) assert.ok(getSubtopic(mapping!.subtopicCode), `subtopic ${mapping!.subtopicCode}`)
  }
})

test('unknown legacy values are flagged for review, not silently dropped', () => {
  const result = resolveLegacyTaxonomy('some-brand-new-topic')
  assert.equal(result.matched, false)
  assert.equal(result.needsReview, true)
  assert.equal(result.mapping, null)
})

test('legacy Vocabulary subject folds into Reading', () => {
  assert.equal(resolveLegacySubject('Vocabulary'), 'reading')
  assert.equal(resolveLegacySubject('mathematical-reasoning'), 'mathematical_reasoning')
})

test('legacy writing forms resolve', () => {
  assert.equal(resolveLegacyWritingForm('diary-entry'), 'diary_entry')
  assert.equal(resolveLegacyWritingForm('Discursive'), 'persuasive_response')
  assert.equal(resolveLegacyWritingForm('unknown-form'), null)
})

/* --------------------------- dimension helpers --------------------------- */

test('dimension validation accepts known codes and blank, rejects junk', () => {
  assert.equal(isValidDimensionValue('question_family', 'cloze_multiple_choice'), true)
  assert.equal(isValidDimensionValue('question_family', ''), true)
  assert.equal(isValidDimensionValue('question_family', null), true)
  assert.equal(isValidDimensionValue('question_family', 'nonsense'), false)
  assert.equal(isValidDimensionValue('stimulus_format', 'pie_chart'), true)
  assert.equal(getDimensionLabel('asset_render_method', 'deterministic_svg'), 'Deterministic SVG')
})

/* --------------------- dependent dropdown behaviour ---------------------- */

test('dependent dropdowns narrow correctly down the hierarchy', () => {
  // Subject → Domain
  const readingDomains = getDomainsForSubject('reading').map((d) => d.code)
  assert.deepEqual(readingDomains, ['comprehension_comparison', 'cloze_language', 'poetry', 'text_structure_cohesion'])
  assert.deepEqual(getDomainsForSubject('writing'), []) // admin-only, no domains
  assert.deepEqual(getDomainsForSubject('nonexistent'), [])

  // Domain → Subtopic
  const dataSubtopics = getSubtopicsForDomain('data_probability').map((s) => s.code)
  assert.ok(dataSubtopics.includes('probability'))
  assert.ok(!dataSubtopics.includes('fractions')) // fractions is under number_algebra
  assert.deepEqual(getSubtopicsForDomain('nonexistent'), [])

  // Subtopic → Skill (only where defined)
  assert.equal(getSuggestedSkillsForSubtopic('area_and_perimeter').length, 8)
  assert.deepEqual(getSuggestedSkillsForSubtopic('fractions'), []) // no skills defined
})

/* ----------------- canonical domain resolution (admin↔student) ----------- */

test('getSubtopicCodesForDomain lists exactly the domain\'s subtopics', () => {
  const logic = getSubtopicCodesForDomain('logic_deduction')
  assert.ok(logic.includes('logic_grids_and_matching_constraints'))
  assert.ok(logic.includes('truth_and_lies'))
  // Every returned code really belongs to that domain (no cross-domain bleed).
  for (const code of logic) {
    assert.equal(getSubtopic(code)?.domainCode, 'logic_deduction')
  }
  // Unknown domain / admin-only writing subject -> empty (no subtopics).
  assert.deepEqual(getSubtopicCodesForDomain('writing'), [])
  assert.deepEqual(getSubtopicCodesForDomain('nope'), [])
})

test('resolveCanonicalDomainCode: a valid subtopic always wins over the stored domain', () => {
  // The bug case: NULL stored domain, valid subtopic -> derive the domain.
  assert.equal(
    resolveCanonicalDomainCode({ domainCode: null, subtopicCode: 'logic_grids_and_matching_constraints' }),
    'logic_deduction'
  )
  // A stale stored domain must NOT override the subtopic's real domain.
  assert.equal(
    resolveCanonicalDomainCode({ domainCode: 'number_algebra', subtopicCode: 'fractions' }),
    'number_algebra'
  )
  assert.equal(
    resolveCanonicalDomainCode({ domainCode: 'arguments_evidence', subtopicCode: 'fractions' }),
    'number_algebra' // subtopic wins even when the stored domain disagrees
  )
  // No usable subtopic -> fall back to the stored domain code.
  assert.equal(resolveCanonicalDomainCode({ domainCode: 'geometry_spatial', subtopicCode: null }), 'geometry_spatial')
  assert.equal(resolveCanonicalDomainCode({ domainCode: 'geometry_spatial', subtopicCode: 'not_real' }), 'geometry_spatial')
  assert.equal(resolveCanonicalDomainCode({ domainCode: null, subtopicCode: null }), null)
})

test('every subtopic resolves to a domain that actually contains it (tree integrity)', () => {
  for (const subtopic of getAllSubtopics()) {
    const domain = resolveCanonicalDomainCode({ domainCode: null, subtopicCode: subtopic.code })
    assert.equal(domain, subtopic.domainCode)
    assert.ok(getSubtopicCodesForDomain(domain!).includes(subtopic.code))
  }
})

/* --------------------------- existing-question compat -------------------- */

test('existing-question compatibility: legacy slug + label both resolve identically', () => {
  const bySlug = resolveLegacyTaxonomy('area-perimeter')
  const byLabel = resolveLegacyTaxonomy('Area & Perimeter')
  assert.equal(bySlug.mapping?.subtopicCode, 'area_and_perimeter')
  assert.equal(byLabel.mapping?.subtopicCode, 'area_and_perimeter')
  assert.equal(getSubtopicLabel('area_and_perimeter'), 'Area and perimeter')
})

/* --------------------------- Reading canonical taxonomy ------------------ */

const READING_CATEGORIES = {
  comprehension_comparison: [
    'Single extract comprehension',
    'Paired extract comparison',
    'Multiple extract matching',
    'Main idea and theme',
    'Character, setting and events',
    'Author purpose and audience',
    'Tone, attitude and viewpoint',
    'Language techniques',
    'Inference and drawing conclusions',
    'Vocabulary in context',
    'Evidence and information retrieval',
  ],
  cloze_language: [
    'Vocabulary and precise word choice',
    'Grammar and usage',
    'Connectives and cohesion',
    'Collocations and common expressions',
    'Meaning from context',
  ],
  poetry: [
    'Meaning and theme',
    'Imagery and figurative language',
    'Tone and mood',
    'Speaker and perspective',
    'Structure and form',
    'Sound and rhythm',
  ],
  text_structure_cohesion: [
    'Sentence insertion',
    'Paragraph heading matching',
    'Paragraph summarisation',
    'Sequencing and organisation',
    'Cohesion across a text',
  ],
} as const

test('Reading has exactly the four canonical categories, in order', () => {
  const domains = getDomainsForSubject('reading')
  assert.deepEqual(
    domains.map((d) => d.code),
    ['comprehension_comparison', 'cloze_language', 'poetry', 'text_structure_cohesion']
  )
  assert.deepEqual(domains.map((d) => d.label), [
    'Comprehension and Comparison',
    'Cloze and Language',
    'Poetry',
    'Text Structure and Cohesion',
  ])
})

test('each Reading category contains exactly its canonical subtopics (by label)', () => {
  for (const [category, labels] of Object.entries(READING_CATEGORIES)) {
    const subtopics = getSubtopicsForDomain(category)
    assert.deepEqual(
      subtopics.map((s) => s.label),
      labels,
      `subtopics mismatch for ${category}`
    )
  }
})

test('no duplicate Reading categories or subtopics; every subtopic maps back to its category', () => {
  const reading = getSubject('reading')
  assert.ok(reading, 'reading subject exists')
  const domainCodes = reading!.domains.map((d) => d.code)
  assert.equal(new Set(domainCodes).size, domainCodes.length, 'duplicate category codes')
  for (const domain of reading!.domains) {
    const subCodes = domain.subtopics.map((s) => s.code)
    assert.equal(new Set(subCodes).size, subCodes.length, `duplicate subtopics in ${domain.code}`)
    for (const subtopic of domain.subtopics) {
      assert.equal(getSubtopic(subtopic.code)!.domainCode, domain.code)
    }
  }
})

test('Reading is student- and admin-visible', () => {
  const reading = getSubject('reading')!
  assert.equal(reading.studentVisible, true)
  assert.equal(reading.adminVisible, true)
})

/* ------------------- label-or-code resolvers (import tolerance) ---------- */

test('resolveDomainCode accepts the canonical code, the label, and case/space variants', () => {
  assert.equal(resolveDomainCode('comprehension_comparison'), 'comprehension_comparison')
  assert.equal(resolveDomainCode('Comprehension and Comparison'), 'comprehension_comparison')
  assert.equal(resolveDomainCode('  comprehension and comparison  '), 'comprehension_comparison')
  assert.equal(resolveDomainCode('Cloze and Language'), 'cloze_language')
  assert.equal(resolveDomainCode('nonsense-category'), null)
  assert.equal(resolveDomainCode(''), null)
  assert.equal(resolveDomainCode(null), null)
})

test('resolveSubtopicCode accepts code or label for Reading subtopics', () => {
  assert.equal(
    resolveSubtopicCode('Inference and drawing conclusions'),
    'inference_and_drawing_conclusions'
  )
  assert.equal(
    resolveSubtopicCode('inference_and_drawing_conclusions'),
    'inference_and_drawing_conclusions'
  )
  // Comma / punctuation in the label is tolerated.
  assert.equal(resolveSubtopicCode('Character, setting and events'), 'character_setting_and_events')
  assert.equal(resolveSubtopicCode('Sentence insertion'), 'sentence_insertion')
  assert.equal(resolveSubtopicCode('not a real subtopic'), null)
})

test('resolveSkillCode returns null for a non-skill and resolves a real skill', () => {
  assert.equal(resolveSkillCode('Rectangle area'), 'rectangle_area')
  assert.equal(resolveSkillCode('rectangle_area'), 'rectangle_area')
  assert.equal(resolveSkillCode('definitely not a skill'), null)
})

test('label resolvers do not cross categories: a subtopic label never resolves as a domain', () => {
  // A subtopic label must not be accepted by resolveDomainCode.
  assert.equal(resolveDomainCode('Sentence insertion'), null)
  // Reading labels round-trip through their own resolver + display label.
  assert.equal(getDomainLabel(resolveDomainCode('Poetry')!), 'Poetry')
})
