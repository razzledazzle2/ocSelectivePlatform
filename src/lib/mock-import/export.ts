import {
  escapeMockCsvCell,
  MOCK_CSV_COLUMNS,
  MOCK_CSV_TEMPLATE_HEADERS,
  type MockExportMode,
} from '@/lib/mock-import/schema'
import { createClient } from '@/lib/supabase/server'

export type { MockExportMode }

/** Cell values for one exported row, keyed by column key. */
type ExportCells = Partial<Record<(typeof MOCK_CSV_COLUMNS)[number]['key'], string>>

function answerFormatToResponseFormat(answerFormat: string): string {
  return answerFormat === 'extended_response' ? 'written_response' : 'multiple_choice'
}

interface SectionRow {
  id: string
  section_key: string
  section_order: number
  subject_id: string | null
}

interface MockQuestionRow {
  question_id: string
  section_id: string
  question_order: number
  marks: number
}

interface QuestionRow {
  id: string
  external_id: string | null
  origin: string
  subject_id: string
  domain_code: string | null
  subtopic_code: string | null
  skill_code: string | null
  difficulty: number
  question_family: string | null
  stimulus_format: string | null
  stimulus_genre: string | null
  answer_format: string
  pattern_key: string | null
  question_text: string
  worked_solution: string | null
  short_explanation: string | null
  correct_option_label: string | null
  tags: string[] | null
}

/**
 * Export a mock to the Mock CSV schema. Three modes:
 *  - full: every row carries complete question content.
 *  - reference: every row references its bank question via existing_question_external_id.
 *  - mixed: bank questions (origin='bank' with an external id) are referenced;
 *           mock-only / id-less questions are exported with full content.
 * order_index is a global running index across sections so it round-trips uniquely.
 */
export async function buildMockExportCsv(mockTestId: string, mode: MockExportMode): Promise<string | null> {
  const supabase = await createClient()

  const { data: mock } = await supabase
    .from('mock_tests')
    .select('id, external_id, title')
    .eq('id', mockTestId)
    .maybeSingle()
  if (!mock) return null

  const mockExternalId = mock.external_id || `mock-${mock.id.slice(0, 8)}`
  const mockName = mock.title

  const [{ data: sections }, { data: mockQuestions }] = await Promise.all([
    supabase
      .from('mock_test_sections')
      .select('id, section_key, section_order, subject_id')
      .eq('mock_test_id', mockTestId)
      .order('section_order', { ascending: true }),
    supabase
      .from('mock_test_questions')
      .select('question_id, section_id, question_order, marks')
      .eq('mock_test_id', mockTestId),
  ])

  const sectionRows = (sections ?? []) as SectionRow[]
  const mockQuestionRows = (mockQuestions ?? []) as MockQuestionRow[]
  if (mockQuestionRows.length === 0) {
    // Header line only — a valid (empty) template still round-trips the mock identity.
    return MOCK_CSV_TEMPLATE_HEADERS.join(',') + '\n'
  }

  const questionIds = [...new Set(mockQuestionRows.map((row) => row.question_id))]
  const [{ data: questions }, { data: options }, { data: subjects }, { data: questionAssets }] = await Promise.all([
    supabase
      .from('questions')
      .select(
        'id, external_id, origin, subject_id, domain_code, subtopic_code, skill_code, difficulty, question_family, stimulus_format, stimulus_genre, answer_format, pattern_key, question_text, worked_solution, short_explanation, correct_option_label, tags'
      )
      .in('id', questionIds),
    supabase
      .from('question_options')
      .select('question_id, label, option_text, sort_order')
      .in('question_id', questionIds)
      .order('sort_order', { ascending: true }),
    supabase.from('subjects').select('id, slug'),
    supabase
      .from('question_assets')
      .select('question_id, role, sort_order, asset:assets(external_ref, alt_text, asset_type)')
      .in('question_id', questionIds)
      .eq('role', 'question')
      .order('sort_order', { ascending: true }),
  ])

  const questionById = new Map<string, QuestionRow>(((questions ?? []) as QuestionRow[]).map((q) => [q.id, q]))
  const slugById = new Map<string, string>(
    ((subjects ?? []) as Array<{ id: string; slug: string }>).map((s) => [s.id, s.slug])
  )
  const optionsByQuestion = new Map<string, Array<{ label: string; option_text: string }>>()
  for (const option of (options ?? []) as Array<{ question_id: string; label: string; option_text: string }>) {
    const list = optionsByQuestion.get(option.question_id) ?? []
    list.push({ label: option.label, option_text: option.option_text })
    optionsByQuestion.set(option.question_id, list)
  }
  const assetByQuestion = new Map<string, { ref: string; altText: string | null; assetType: string | null }>()
  for (const link of (questionAssets ?? []) as Array<{
    question_id: string
    asset: { external_ref: string | null; alt_text: string | null; asset_type: string | null }[] | { external_ref: string | null; alt_text: string | null; asset_type: string | null } | null
  }>) {
    if (assetByQuestion.has(link.question_id)) continue
    const asset = Array.isArray(link.asset) ? link.asset[0] : link.asset
    if (asset?.external_ref) {
      assetByQuestion.set(link.question_id, {
        ref: asset.external_ref,
        altText: asset.alt_text,
        assetType: asset.asset_type,
      })
    }
  }

  // Order questions: canonical section order, then question_order within a section.
  const sectionOrderById = new Map(sectionRows.map((section) => [section.id, section.section_order]))
  const sectionKeyById = new Map(sectionRows.map((section) => [section.id, section.section_key]))
  const ordered = [...mockQuestionRows].sort((a, b) => {
    const sa = sectionOrderById.get(a.section_id) ?? 0
    const sb = sectionOrderById.get(b.section_id) ?? 0
    return sa - sb || a.question_order - b.question_order
  })

  const lines: string[] = [MOCK_CSV_TEMPLATE_HEADERS.join(',')]
  let orderIndex = 0
  for (const mockQuestion of ordered) {
    const question = questionById.get(mockQuestion.question_id)
    if (!question) continue
    orderIndex += 1

    const reference =
      mode === 'reference' ||
      (mode === 'mixed' && question.origin === 'bank' && Boolean(question.external_id))
    const canReference = Boolean(question.external_id)

    const cells: ExportCells = {
      mockExternalId,
      mockName,
      orderIndex: String(orderIndex),
      marks: String(mockQuestion.marks),
      sectionKey: sectionKeyById.get(mockQuestion.section_id) ?? '',
    }

    if (reference && canReference) {
      cells.existingQuestionExternalId = question.external_id ?? ''
    } else {
      // Full content (also the fallback when a reference-mode question has no external id).
      const slug = slugById.get(question.subject_id) ?? ''
      const optionList = optionsByQuestion.get(question.id) ?? []
      const byLabel = new Map(optionList.map((option) => [option.label, option.option_text]))
      const asset = assetByQuestion.get(question.id)
      Object.assign(cells, {
        questionExternalId: question.external_id ?? '',
        subject: slug,
        domain: question.domain_code ?? '',
        subtopic: question.subtopic_code ?? '',
        skill: question.skill_code ?? '',
        difficulty: String(question.difficulty),
        questionFamily: question.question_family ?? '',
        stimulusType: question.stimulus_format ?? '',
        stimulusGenre: question.stimulus_genre ?? '',
        responseFormat: answerFormatToResponseFormat(question.answer_format),
        patternKey: question.pattern_key ?? '',
        questionText: question.question_text,
        optionA: byLabel.get('A') ?? '',
        optionB: byLabel.get('B') ?? '',
        optionC: byLabel.get('C') ?? '',
        optionD: byLabel.get('D') ?? '',
        optionE: byLabel.get('E') ?? '',
        correctAnswer: question.correct_option_label ?? '',
        workedSolution: question.worked_solution ?? '',
        shortExplanation: question.short_explanation ?? '',
        tags: (question.tags ?? []).join(', '),
        assetFilename: asset?.ref ?? '',
        assetType: asset?.assetType ?? '',
        assetAltText: asset?.altText ?? '',
      } satisfies ExportCells)
    }

    const line = MOCK_CSV_COLUMNS.map((column) => escapeMockCsvCell(cells[column.key] ?? '')).join(',')
    lines.push(line)
  }

  return lines.join('\n') + '\n'
}
