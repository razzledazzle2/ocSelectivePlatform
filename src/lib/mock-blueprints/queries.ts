import { normalizeQuestionText } from '@/lib/import/validation'
import { blueprintTargetTotal, countBlueprintRules, normalizeBlueprintSpec } from '@/lib/mock-blueprints/spec'
import type { SelectionCandidate } from '@/lib/mock-blueprints/select'
import { createClient } from '@/lib/supabase/server'
import type { ExamType } from '@/lib/types'
import type { BlueprintStatus, MockBlueprint, MockBlueprintListItem } from '@/lib/mock-blueprints/types'

interface BlueprintRow {
  id: string
  title: string
  description: string | null
  exam_type: string | null
  subject_code: string | null
  status: string
  spec: unknown
  created_at: string
  updated_at: string
}

function toStatus(value: string): BlueprintStatus {
  return value === 'active' || value === 'archived' ? value : 'draft'
}

function toExamType(value: string | null): ExamType | null {
  return value === 'OC' || value === 'Selective' ? value : null
}

function toBlueprint(row: BlueprintRow): MockBlueprint {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    examType: toExamType(row.exam_type),
    subjectCode: row.subject_code,
    status: toStatus(row.status),
    spec: normalizeBlueprintSpec(row.spec),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getMockBlueprints(): Promise<MockBlueprintListItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mock_blueprints')
    .select('id, title, description, exam_type, subject_code, status, spec, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error('Unable to load mock blueprints.')
  }

  return ((data ?? []) as BlueprintRow[]).map((row) => {
    const spec = normalizeBlueprintSpec(row.spec)
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      examType: toExamType(row.exam_type),
      subjectCode: row.subject_code,
      status: toStatus(row.status),
      targetTotal: blueprintTargetTotal(spec),
      ruleCount: countBlueprintRules(spec),
      updatedAt: row.updated_at,
    }
  })
}

export async function getMockBlueprintById(id: string): Promise<MockBlueprint | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mock_blueprints')
    .select('id, title, description, exam_type, subject_code, status, spec, created_at, updated_at')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error('Unable to load the mock blueprint.')
  }
  return data ? toBlueprint(data as BlueprintRow) : null
}

/**
 * Build the deterministic selection pool for the internal builder: published,
 * non-deleted bank questions in one subject that have a valid answer and are not
 * flagged as needing fixes. Mock-only (origin='mock_import') questions are kept
 * out of the bank selection pool. `recentlyUsed` marks questions already used in
 * any published mock so the selector can deprioritise repeats.
 */
export async function getBlueprintSelectionPool(subjectId: string): Promise<SelectionCandidate[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('questions')
    .select('id, difficulty, domain_code, subtopic_code, pattern_key, correct_option_label, question_text, validation_status')
    .eq('subject_id', subjectId)
    .eq('status', 'published')
    .eq('origin', 'bank')
    .is('deleted_at', null)
    .not('correct_option_label', 'is', null)

  if (error) {
    throw new Error('Unable to load the question pool for selection.')
  }

  // Questions already used in any published mock → recentlyUsed.
  const { data: usedRows } = await supabase
    .from('mock_test_questions')
    .select('question_id, mock_tests!inner(status)')
    .eq('mock_tests.status', 'published')
  const usedIds = new Set(((usedRows ?? []) as Array<{ question_id: string }>).map((row) => row.question_id))

  return ((data ?? []) as Array<{
    id: string
    difficulty: number
    domain_code: string | null
    subtopic_code: string | null
    pattern_key: string | null
    correct_option_label: string | null
    question_text: string
    validation_status: string | null
  }>)
    .filter((row) => row.validation_status !== 'needs_fixes')
    .map((row) => ({
      questionId: row.id,
      difficulty: row.difficulty,
      domainCode: row.domain_code,
      subtopicCode: row.subtopic_code,
      patternKey: row.pattern_key,
      correctOptionLabel: row.correct_option_label,
      normalizedText: normalizeQuestionText(row.question_text),
      recentlyUsed: usedIds.has(row.id),
    }))
}

/** Active blueprints, for the internal builder's blueprint picker. */
export async function getActiveBlueprints(): Promise<MockBlueprint[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mock_blueprints')
    .select('id, title, description, exam_type, subject_code, status, spec, created_at, updated_at')
    .eq('status', 'active')
    .order('title', { ascending: true })

  if (error) {
    throw new Error('Unable to load active blueprints.')
  }
  return ((data ?? []) as BlueprintRow[]).map(toBlueprint)
}
