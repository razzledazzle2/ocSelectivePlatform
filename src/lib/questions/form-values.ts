import { getOptionRuleForSubject } from '@/lib/questions/option-rules'
import { resolveLegacyTaxonomy } from '@/lib/taxonomy'
import type { QuestionDetail, QuestionFormValues, QuestionTypeRecord, SubjectRecord, TopicRecord } from '@/lib/types'

/** Shared empty defaults for the canonical taxonomy form fields. */
const EMPTY_TAXONOMY_FORM_FIELDS = {
  domainCode: '',
  subtopicCode: '',
  skillCode: '',
  patternKey: '',
  questionFamily: '',
  stimulusFormat: '',
  stimulusGenre: '',
  assetRenderMethod: '',
  writingForm: '',
  writingPurpose: '',
  writingPromptStimulus: '',
} as const

export function createEmptyQuestionFormValues(
  subjects: SubjectRecord[],
  topics: TopicRecord[],
  questionTypes: QuestionTypeRecord[]
): QuestionFormValues {
  const defaultSubject = subjects[0] ?? null
  const defaultSubjectId = defaultSubject?.id ?? ''
  const defaultTopicId = topics.find((topic) => topic.subject_id === defaultSubjectId)?.id ?? ''
  const defaultQuestionTypeId =
    questionTypes.find((questionType) => questionType.topic_id === defaultTopicId)?.id ??
    questionTypes.find((questionType) => questionType.subject_id === defaultSubjectId)?.id ??
    ''
  // Start with the subject's preferred option count (e.g. 5 for Maths Reasoning).
  const preferredCount = getOptionRuleForSubject(defaultSubject?.name).preferredCount

  return {
    examType: 'OC',
    subjectId: defaultSubjectId,
    topicId: defaultTopicId,
    questionTypeId: defaultQuestionTypeId,
    ...EMPTY_TAXONOMY_FORM_FIELDS,
    yearLevel: '',
    difficulty: '3',
    answerFormat: 'single_choice',
    marks: '1',
    timeLimitSeconds: '',
    questionText: '',
    passageText: '',
    stimulusId: '',
    options: Array.from({ length: preferredCount }, () => ''),
    correctOptionLabel: 'A',
    workedSolution: '',
    tags: '',
    skillTags: '',
    conceptTags: '',
    rubricJson: '',
    status: 'draft',
  }
}

export function questionDetailToFormValues(question: QuestionDetail): QuestionFormValues {
  const sortedOptions = [...question.options].sort((left, right) => left.sort_order - right.sort_order)

  // Existing-question compatibility: if a question predates the canonical codes
  // (or the backfill left them null), derive sensible defaults from its legacy
  // topic slug so the edit form is pre-populated and the admin can confirm.
  const legacy = resolveLegacyTaxonomy(question.topic?.slug ?? '')

  return {
    examType: question.exam_type,
    subjectId: question.subject_id,
    topicId: question.topic_id,
    questionTypeId: question.question_type_id ?? '',
    domainCode: question.domain_code ?? legacy.mapping?.domainCode ?? '',
    subtopicCode: question.subtopic_code ?? legacy.mapping?.subtopicCode ?? '',
    skillCode: question.skill_code ?? '',
    patternKey: question.pattern_key ?? '',
    questionFamily: question.question_family ?? '',
    stimulusFormat: question.stimulus_format ?? '',
    stimulusGenre: question.stimulus_genre ?? legacy.mapping?.stimulusGenre ?? '',
    assetRenderMethod: question.asset_render_method ?? '',
    writingForm: question.writing_form ?? '',
    writingPurpose: question.writing_purpose ?? '',
    writingPromptStimulus: question.writing_prompt_stimulus ?? '',
    yearLevel: question.year_level ? String(question.year_level) : '',
    difficulty: String(question.difficulty),
    answerFormat: question.answer_format,
    marks: String(question.marks),
    timeLimitSeconds: question.time_limit_seconds ? String(question.time_limit_seconds) : '',
    questionText: question.question_text,
    passageText: question.passage_text ?? '',
    stimulusId: question.stimulus_id ?? '',
    options: sortedOptions.map((option) => option.option_text),
    correctOptionLabel: question.correct_option_label ?? 'A',
    // short_explanation is deprecated; fall back into the authoritative worked
    // solution so any legacy-only content is preserved when the row is edited.
    workedSolution: question.worked_solution ?? question.short_explanation ?? '',
    tags: (question.tags ?? []).join(', '),
    skillTags: (question.skill_tags ?? []).join(', '),
    conceptTags: (question.concept_tags ?? []).join(', '),
    rubricJson: question.rubric ? JSON.stringify(question.rubric, null, 2) : '',
    status: question.status === 'archived' ? 'draft' : question.status,
  }
}
