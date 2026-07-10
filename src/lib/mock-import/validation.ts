import { findUploadedAssetFile } from '@/lib/import/asset-package'
import { normalizeQuestionText } from '@/lib/import/validation'
import { evaluateBlueprint } from '@/lib/mock-blueprints/evaluate'
import type { BlueprintQuestion, MockBlueprint } from '@/lib/mock-blueprints/types'
import {
  MOCK_RESPONSE_FORMAT_LABELS,
  normalizeResponseFormat,
  normalizeSectionKey,
  sectionKeyForSubjectCode,
  subjectSlugForCode,
} from '@/lib/mock-import/schema'
import type {
  MockAssetPreview,
  MockCsvRow,
  MockImportMode,
  MockImportValidationResult,
  MockRowIssue,
  ResolvedMockQuestion,
  UploadedAssetFile,
  ValidatedMockRow,
} from '@/lib/mock-import/types'
import { resolveAssetRef } from '@/lib/assets/refs'
import { validateAssetFile } from '@/lib/assets/validate-file'
import {
  getDomain,
  getDomainsForSubject,
  getSubtopic,
  getSubtopicsForDomain,
  isValidDimensionValue,
  isValidDomainForSubject,
  isValidSkillForSubtopic,
  isValidSubtopicForDomain,
  resolveLegacySubject,
  resolveLegacyTaxonomy,
} from '@/lib/taxonomy'
import { createClient } from '@/lib/supabase/server'
import { MAX_OPTION_COUNT } from '@/lib/questions/option-rules'
import type { AnswerFormat, ExamType, QuestionOptionLabel } from '@/lib/types'

const OPTION_LABELS: QuestionOptionLabel[] = ['A', 'B', 'C', 'D', 'E']

export interface ValidateMockImportOptions {
  mode: MockImportMode
  assetFiles: Map<string, UploadedAssetFile>
  blueprint: MockBlueprint | null
  /** Exam type for new questions (mock-level). */
  examType: ExamType
}

interface SubjectRecord {
  id: string
  slug: string
  name: string
}

interface ExistingQuestionRecord {
  id: string
  externalId: string
  subjectCode: string | null
  domainCode: string | null
  subtopicCode: string | null
  difficulty: number
  patternKey: string | null
  correctOptionLabel: string | null
  marks: number
  status: string
  deletedAt: string | null
}

function parseIntStrict(value: string): number | null {
  if (!/^-?\d+$/.test(value.trim())) return null
  return Number.parseInt(value.trim(), 10)
}

/** Build the ordered options array from option_a..e; report a gap (A,C with B blank). */
function collectOptions(row: MockCsvRow): { options: string[]; gap: boolean } {
  const raw = [row.optionA, row.optionB, row.optionC, row.optionD, row.optionE].map((value) => value.trim())
  let lastFilled = -1
  for (let index = 0; index < raw.length; index += 1) {
    if (raw[index]) lastFilled = index
  }
  const options = lastFilled >= 0 ? raw.slice(0, lastFilled + 1) : []
  const gap = options.some((value) => value === '')
  return { options, gap }
}

function isTruthyFlag(value: string): boolean {
  return /^(true|yes|1|required)$/i.test(value.trim())
}

function resolveSubject(
  raw: string,
  subjectsBySlug: Map<string, SubjectRecord>,
  subjectsByName: Map<string, SubjectRecord>
): { code: string; id: string; slug: string } | null {
  const code = resolveLegacySubject(raw)
  if (code) {
    const slug = subjectSlugForCode(code)
    const record = subjectsBySlug.get(slug)
    if (record) return { code, id: record.id, slug }
  }
  const key = raw.trim().toLowerCase()
  const bySlug = subjectsBySlug.get(key)
  if (bySlug) return { code: resolveLegacySubject(bySlug.slug) ?? bySlug.slug, id: bySlug.id, slug: bySlug.slug }
  const byName = subjectsByName.get(key)
  if (byName) return { code: resolveLegacySubject(byName.slug) ?? byName.slug, id: byName.id, slug: byName.slug }
  return null
}

function resolveDomainCode(raw: string, subjectCode: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (getDomain(trimmed) && isValidDomainForSubject(subjectCode, trimmed)) return trimmed
  const legacyDomain = resolveLegacyTaxonomy(trimmed).mapping?.domainCode
  if (legacyDomain && isValidDomainForSubject(subjectCode, legacyDomain)) return legacyDomain
  return null
}

function resolveSubtopicCode(raw: string, domainCode: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (getSubtopic(trimmed) && isValidSubtopicForDomain(domainCode, trimmed)) return trimmed
  const legacySubtopic = resolveLegacyTaxonomy(trimmed).mapping?.subtopicCode
  if (legacySubtopic && isValidSubtopicForDomain(domainCode, legacySubtopic)) return legacySubtopic
  return null
}

/** Classify the row's single asset reference for the preview + import decision. */
function classifyAsset(
  row: MockCsvRow,
  assetFiles: Map<string, UploadedAssetFile>
): { preview: MockAssetPreview | null; error: MockRowIssue | null; warning: MockRowIssue | null } {
  const ref = row.assetFilename.trim()
  if (!ref) return { preview: null, error: null, warning: null }
  const required = isTruthyFlag(row.assetRequired)

  const uploaded = assetFiles.size > 0 ? findUploadedAssetFile(assetFiles, ref) : null
  if (uploaded) {
    const validation = validateAssetFile(uploaded)
    if (!validation.ok) {
      return {
        preview: { ref, state: 'invalid', message: validation.reason },
        error: { field: 'asset_filename', value: ref, message: validation.reason ?? 'Invalid asset file.' },
        warning: null,
      }
    }
    return { preview: { ref, state: 'ready' }, error: null, warning: null }
  }

  const resolved = resolveAssetRef(ref)
  if (resolved.kind === 'public' || resolved.kind === 'external') {
    return { preview: { ref, state: 'ready' }, error: null, warning: null }
  }
  if (resolved.kind === 'pending') {
    return {
      preview: { ref, state: 'pending', message: 'Placeholder asset — imports as pending.' },
      error: null,
      warning: { field: 'asset_filename', value: ref, message: 'Asset is a pending placeholder; publishing is blocked until it is ready.' },
    }
  }
  const message = `No file named "${ref}" was found in the upload.`
  if (required) {
    return {
      preview: { ref, state: 'missing', message },
      error: { field: 'asset_filename', value: ref, message: `${message} It is marked required.`, expected: 'Include the file in the assets ZIP.' },
      warning: null,
    }
  }
  return {
    preview: { ref, state: 'missing', message },
    error: null,
    warning: { field: 'asset_filename', value: ref, message: `${message} It will import as pending.` },
  }
}

/**
 * Validate a whole mock CSV (one mock per file). Reads the live schema (subjects,
 * any existing mock with the same external id, and referenced questions), then
 * produces per-row errors/warnings, a preview summary and (optionally) a
 * blueprint evaluation. Never mutates the database.
 */
export async function validateMockImport(
  rows: MockCsvRow[],
  options: ValidateMockImportOptions
): Promise<MockImportValidationResult> {
  const base: MockImportValidationResult = {
    mockExternalId: null,
    mockName: null,
    totalRows: 0,
    importableCount: 0,
    readyCount: 0,
    warningCount: 0,
    errorCount: 0,
    newQuestionCount: 0,
    referencedQuestionCount: 0,
    missingAssetCount: 0,
    duplicateOrderIndexes: [],
    matchesExistingMock: false,
    existingMockId: null,
    rows: [],
    unusedAssetFiles: [],
    blueprint: null,
  }

  if (rows.length === 0) {
    return { ...base, parseError: 'The mock CSV has no question rows.' }
  }

  const supabase = await createClient()
  const mockExternalId = rows[0].mockExternalId.trim()
  const mockName = rows[0].mockName.trim()
  if (!mockExternalId) {
    return { ...base, parseError: 'The first row is missing mock_external_id.' }
  }

  // Which external ids to fetch (references + declared own ids).
  const referencedExternalIds = new Set<string>()
  for (const row of rows) {
    const ref = row.existingQuestionExternalId.trim()
    if (ref) referencedExternalIds.add(ref)
    const own = row.questionExternalId.trim()
    if (own) referencedExternalIds.add(own)
  }

  const [{ data: subjectRows }, { data: mockRow }] = await Promise.all([
    supabase.from('subjects').select('id, slug, name'),
    supabase.from('mock_tests').select('id').eq('external_id', mockExternalId).maybeSingle(),
  ])

  const subjectsBySlug = new Map<string, SubjectRecord>()
  const subjectsByName = new Map<string, SubjectRecord>()
  const subjectCodeById = new Map<string, string>()
  for (const subject of (subjectRows ?? []) as SubjectRecord[]) {
    subjectsBySlug.set(subject.slug.toLowerCase(), subject)
    subjectsByName.set(subject.name.toLowerCase(), subject)
    subjectCodeById.set(subject.id, resolveLegacySubject(subject.slug) ?? subject.slug)
  }

  const existingByExternalId = new Map<string, ExistingQuestionRecord>()
  if (referencedExternalIds.size > 0) {
    const { data: existingRows } = await supabase
      .from('questions')
      .select(
        'id, external_id, subject_id, domain_code, subtopic_code, difficulty, pattern_key, correct_option_label, marks, status, deleted_at'
      )
      .in('external_id', [...referencedExternalIds])
    for (const record of (existingRows ?? []) as Array<{
      id: string
      external_id: string
      subject_id: string
      domain_code: string | null
      subtopic_code: string | null
      difficulty: number
      pattern_key: string | null
      correct_option_label: string | null
      marks: number
      status: string
      deleted_at: string | null
    }>) {
      existingByExternalId.set(record.external_id, {
        id: record.id,
        externalId: record.external_id,
        subjectCode: subjectCodeById.get(record.subject_id) ?? null,
        domainCode: record.domain_code,
        subtopicCode: record.subtopic_code,
        difficulty: record.difficulty,
        patternKey: record.pattern_key,
        correctOptionLabel: record.correct_option_label,
        marks: record.marks,
        status: record.status,
        deletedAt: record.deleted_at,
      })
    }
  }

  // Pre-pass: duplicate detection over the file.
  const orderIndexCounts = new Map<number, number>()
  const textCounts = new Map<string, number>()
  const ownExternalIdCounts = new Map<string, number>()
  for (const row of rows) {
    const order = parseIntStrict(row.orderIndex)
    if (order != null) orderIndexCounts.set(order, (orderIndexCounts.get(order) ?? 0) + 1)
    const textKey = normalizeQuestionText(row.questionText)
    if (textKey) textCounts.set(textKey, (textCounts.get(textKey) ?? 0) + 1)
    const own = row.questionExternalId.trim()
    if (own) ownExternalIdCounts.set(own, (ownExternalIdCounts.get(own) ?? 0) + 1)
  }
  const duplicateOrderIndexes = [...orderIndexCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([order]) => order)
    .sort((a, b) => a - b)

  const usedAssetRefs = new Set<string>()
  const validatedRows: ValidatedMockRow[] = []

  rows.forEach((row, index) => {
    const errors: MockRowIssue[] = []
    const warnings: MockRowIssue[] = []
    const isReference = row.existingQuestionExternalId.trim().length > 0
    const kind: ValidatedMockRow['kind'] = isReference ? 'existing_reference' : 'new_question'

    if (row.mockExternalId.trim() && row.mockExternalId.trim() !== mockExternalId) {
      errors.push({
        field: 'mock_external_id',
        value: row.mockExternalId.trim(),
        message: 'All rows in one file must share the same mock_external_id.',
        expected: mockExternalId,
      })
    }

    const order = parseIntStrict(row.orderIndex)
    if (order == null || order < 0) {
      errors.push({ field: 'order_index', value: row.orderIndex, message: 'order_index must be a non-negative integer.', expected: 'e.g. 1, 2, 3' })
    } else if ((orderIndexCounts.get(order) ?? 0) > 1) {
      errors.push({ field: 'order_index', value: String(order), message: 'Duplicate order_index within this mock.' })
    }

    const marks = parseIntStrict(row.marks)
    if (row.marks.trim() && (marks == null || marks <= 0)) {
      errors.push({ field: 'marks', value: row.marks, message: 'marks must be a positive integer.', expected: 'e.g. 1' })
    }

    // Asset classification (both row kinds may carry one).
    const assetInfo = classifyAsset(row, options.assetFiles)
    if (assetInfo.error) errors.push(assetInfo.error)
    if (assetInfo.warning) warnings.push(assetInfo.warning)
    if (row.assetFilename.trim()) usedAssetRefs.add(row.assetFilename.trim().toLowerCase())

    let resolved: ResolvedMockQuestion | null = null
    let summary = `Row ${row.rowNumber}`

    if (isReference) {
      const ref = row.existingQuestionExternalId.trim()
      const existing = existingByExternalId.get(ref)
      if (!existing) {
        errors.push({
          field: 'existing_question_external_id',
          value: ref,
          message: 'No bank question has this external id.',
          expected: 'An external_id present in the question bank.',
        })
      } else {
        if (existing.deletedAt) {
          errors.push({ field: 'existing_question_external_id', value: ref, message: 'That bank question has been deleted.' })
        }
        if (existing.status !== 'published') {
          warnings.push({
            field: 'existing_question_external_id',
            value: ref,
            message: `Referenced question is ${existing.status}; it must be published before students can sit the mock.`,
          })
        }
        const explicitSection = normalizeSectionKey(row.sectionKey)
        const sectionKey = explicitSection || sectionKeyForSubjectCode(existing.subjectCode)
        resolved = {
          kind: 'existing_reference',
          externalId: ref,
          existingQuestionId: existing.id,
          subjectCode: existing.subjectCode,
          subjectSlug: existing.subjectCode ? subjectSlugForCode(existing.subjectCode) : null,
          domainCode: existing.domainCode,
          subtopicCode: existing.subtopicCode,
          skillCode: null,
          examType: options.examType,
          difficulty: existing.difficulty,
          marks: marks ?? existing.marks,
          questionFamily: null,
          stimulusFormat: null,
          stimulusGenre: null,
          answerFormat: 'single_choice',
          patternKey: existing.patternKey,
          questionText: '',
          options: [],
          correctOptionLabel: (existing.correctOptionLabel as QuestionOptionLabel | null) ?? null,
          workedSolution: null,
          shortExplanation: null,
          tags: [],
          sectionKey,
          orderIndex: order ?? 0,
          assetRef: null,
          assetType: null,
          assetRenderMethod: null,
          assetAltText: null,
          assetRequired: false,
        }
        summary = `↪ references ${ref}`
      }
      if (row.questionText.trim()) {
        warnings.push({ field: 'question_text', message: 'Row references an existing question; its inline content is ignored.' })
      }
    } else {
      const subject = resolveSubject(row.subject, subjectsBySlug, subjectsByName)
      if (!subject) {
        errors.push({
          field: 'subject',
          value: row.subject,
          message: 'Unknown subject.',
          expected: 'A subject slug/name in the taxonomy (e.g. mathematical-reasoning).',
        })
      }
      const subjectCode = subject?.code ?? null

      let domainCode: string | null = null
      let subtopicCode: string | null = null
      if (subjectCode) {
        domainCode = resolveDomainCode(row.domain, subjectCode)
        if (!domainCode) {
          errors.push({
            field: 'domain',
            value: row.domain,
            message: `Domain is not valid for ${subjectCode}.`,
            expected: getDomainsForSubject(subjectCode).map((d) => d.code).slice(0, 6).join(', '),
          })
        } else {
          subtopicCode = resolveSubtopicCode(row.subtopic, domainCode)
          if (!subtopicCode) {
            errors.push({
              field: 'subtopic',
              value: row.subtopic,
              message: `Subtopic is not valid for ${domainCode}.`,
              expected: getSubtopicsForDomain(domainCode).map((s) => s.code).slice(0, 6).join(', '),
            })
          }
        }
      }

      let skillCode: string | null = null
      if (row.skill.trim() && subtopicCode) {
        if (isValidSkillForSubtopic(subtopicCode, row.skill.trim())) {
          skillCode = row.skill.trim()
        } else {
          warnings.push({ field: 'skill', value: row.skill, message: `Skill is not valid for ${subtopicCode}; imported without a skill.` })
        }
      }

      const difficulty = parseIntStrict(row.difficulty)
      if (difficulty == null || difficulty < 1 || difficulty > 5) {
        errors.push({ field: 'difficulty', value: row.difficulty, message: 'difficulty must be an integer 1–5.', expected: '1–5' })
      }

      const answerFormat: AnswerFormat | null = normalizeResponseFormat(row.responseFormat)
      if (!answerFormat) {
        errors.push({ field: 'response_format', value: row.responseFormat, message: 'Unknown response_format.', expected: MOCK_RESPONSE_FORMAT_LABELS })
      }

      if (!row.questionText.trim()) {
        errors.push({ field: 'question_text', message: 'question_text is required.' })
      }
      if (!row.workedSolution.trim() && answerFormat === 'single_choice') {
        warnings.push({ field: 'worked_solution', message: 'No worked_solution provided.' })
      }

      if (row.questionFamily.trim() && !isValidDimensionValue('question_family', row.questionFamily.trim())) {
        warnings.push({ field: 'question_family', value: row.questionFamily, message: 'Unrecognised question_family; stored as-is.' })
      }
      if (row.stimulusType.trim() && !isValidDimensionValue('stimulus_format', row.stimulusType.trim())) {
        warnings.push({ field: 'stimulus_type', value: row.stimulusType, message: 'Unrecognised stimulus_type; stored as-is.' })
      }
      if (row.stimulusGenre.trim() && !isValidDimensionValue('stimulus_genre', row.stimulusGenre.trim())) {
        warnings.push({ field: 'stimulus_genre', value: row.stimulusGenre, message: 'Unrecognised stimulus_genre; stored as-is.' })
      }
      if (row.assetRenderMethod.trim() && !isValidDimensionValue('asset_render_method', row.assetRenderMethod.trim())) {
        warnings.push({ field: 'asset_render_method', value: row.assetRenderMethod, message: 'Unrecognised asset_render_method; stored as-is.' })
      }

      const { options: optionTexts, gap } = collectOptions(row)
      const correctRaw = row.correctAnswer.trim().toUpperCase()
      const correctLabel = correctRaw.charAt(0)
      if (answerFormat === 'single_choice') {
        if (gap) {
          errors.push({ field: 'option_b', message: 'Options must be contiguous from A (no gaps).' })
        }
        if (optionTexts.length < 2) {
          errors.push({ field: 'option_a', message: 'Multiple-choice questions need at least two options.' })
        }
        if (optionTexts.length > MAX_OPTION_COUNT) {
          errors.push({ field: 'option_e', message: `At most ${MAX_OPTION_COUNT} options (A–E) are supported.` })
        }
        const availableLabels = OPTION_LABELS.slice(0, optionTexts.length)
        if (!correctLabel) {
          errors.push({ field: 'correct_answer', message: 'correct_answer is required for multiple choice.', expected: availableLabels.join('/') })
        } else if (!availableLabels.includes(correctLabel as QuestionOptionLabel)) {
          errors.push({
            field: 'correct_answer',
            value: row.correctAnswer,
            message: 'correct_answer must match one of the provided options.',
            expected: availableLabels.join('/'),
          })
        }
      }

      const textKey = normalizeQuestionText(row.questionText)
      if (textKey && (textCounts.get(textKey) ?? 0) > 1) {
        warnings.push({ field: 'question_text', message: 'Another row in this file has identical question text.' })
      }
      const own = row.questionExternalId.trim()
      if (own && (ownExternalIdCounts.get(own) ?? 0) > 1) {
        errors.push({ field: 'question_external_id', value: own, message: 'Duplicate question_external_id within this file.' })
      }

      const explicitSection = normalizeSectionKey(row.sectionKey)
      if (explicitSection === undefined && row.sectionKey.trim()) {
        warnings.push({ field: 'section_key', value: row.sectionKey, message: 'Unknown section_key; derived from subject instead.' })
      }
      const sectionKey = explicitSection || sectionKeyForSubjectCode(subjectCode)

      summary = row.questionText.trim().slice(0, 80) || `Row ${row.rowNumber}`

      if (errors.length === 0 && difficulty != null && answerFormat) {
        resolved = {
          kind: 'new_question',
          externalId: own || `${mockExternalId}-q${order ?? index + 1}`,
          existingQuestionId: null,
          subjectCode,
          subjectSlug: subject?.slug ?? null,
          domainCode,
          subtopicCode,
          skillCode,
          examType: options.examType,
          difficulty,
          marks: marks ?? 1,
          questionFamily: row.questionFamily.trim() || null,
          stimulusFormat: row.stimulusType.trim() || null,
          stimulusGenre: row.stimulusGenre.trim() || null,
          answerFormat,
          patternKey: row.patternKey.trim() || null,
          questionText: row.questionText.trim(),
          options: optionTexts,
          correctOptionLabel: answerFormat === 'single_choice' ? (correctLabel as QuestionOptionLabel) : null,
          workedSolution: row.workedSolution.trim() || null,
          shortExplanation: row.shortExplanation.trim() || null,
          tags: row.tags
            .split(/[;,]/)
            .map((tag) => tag.trim())
            .filter(Boolean),
          sectionKey,
          orderIndex: order ?? index + 1,
          assetRef: row.assetFilename.trim() || null,
          assetType: row.assetType.trim() || null,
          assetRenderMethod: row.assetRenderMethod.trim() || null,
          assetAltText: row.assetAltText.trim() || null,
          assetRequired: isTruthyFlag(row.assetRequired),
        }
      }
    }

    const rowStatus: ValidatedMockRow['rowStatus'] =
      errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ready'
    validatedRows.push({
      rowNumber: row.rowNumber,
      rowStatus,
      kind,
      errors,
      warnings,
      isImportable: errors.length === 0,
      resolved,
      assetPreview: assetInfo.preview,
      summary,
    })
  })

  // Aggregate counts.
  const importableCount = validatedRows.filter((row) => row.isImportable).length
  const readyCount = validatedRows.filter((row) => row.rowStatus === 'ready').length
  const warningCount = validatedRows.filter((row) => row.rowStatus === 'warning').length
  const errorCount = validatedRows.filter((row) => row.rowStatus === 'error').length
  const newQuestionCount = validatedRows.filter((row) => row.kind === 'new_question' && row.isImportable).length
  const referencedQuestionCount = validatedRows.filter(
    (row) => row.kind === 'existing_reference' && row.isImportable
  ).length
  const missingAssetCount = validatedRows.filter(
    (row) => row.assetPreview?.state === 'missing' || row.assetPreview?.state === 'pending'
  ).length

  const unusedAssetFiles = [...options.assetFiles.values()]
    .filter((file) => !usedAssetRefs.has(file.relativePath.toLowerCase()) && !usedAssetRefs.has(file.filename.toLowerCase()))
    .map((file) => file.relativePath)

  // Blueprint evaluation over every importable question's metadata.
  let blueprint: MockImportValidationResult['blueprint'] = null
  if (options.blueprint) {
    const questions: BlueprintQuestion[] = validatedRows
      .filter((row) => row.isImportable && row.resolved)
      .map((row) => ({
        difficulty: row.resolved!.difficulty,
        domainCode: row.resolved!.domainCode,
        subtopicCode: row.resolved!.subtopicCode,
        patternKey: row.resolved!.patternKey,
        correctOptionLabel: row.resolved!.correctOptionLabel,
      }))
    blueprint = evaluateBlueprint(questions, options.blueprint.spec, {
      blueprintId: options.blueprint.id,
      blueprintTitle: options.blueprint.title,
    })
  }

  return {
    mockExternalId,
    mockName: mockName || null,
    totalRows: rows.length,
    importableCount,
    readyCount,
    warningCount,
    errorCount,
    newQuestionCount,
    referencedQuestionCount,
    missingAssetCount,
    duplicateOrderIndexes,
    matchesExistingMock: Boolean(mockRow?.id),
    existingMockId: mockRow?.id ?? null,
    rows: validatedRows,
    unusedAssetFiles,
    blueprint,
  }
}
