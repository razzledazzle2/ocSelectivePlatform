import { getOptionRuleForSubject } from '@/lib/questions/option-rules'
import type { QuestionDetail, QuestionFormValues, QuestionTypeRecord, SubjectRecord, TopicRecord } from '@/lib/types'

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
    shortExplanation: '',
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

  return {
    examType: question.exam_type,
    subjectId: question.subject_id,
    topicId: question.topic_id,
    questionTypeId: question.question_type_id ?? '',
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
    shortExplanation: question.short_explanation ?? '',
    workedSolution: question.worked_solution ?? '',
    tags: (question.tags ?? []).join(', '),
    skillTags: (question.skill_tags ?? []).join(', '),
    conceptTags: (question.concept_tags ?? []).join(', '),
    rubricJson: question.rubric ? JSON.stringify(question.rubric, null, 2) : '',
    status: question.status === 'archived' ? 'draft' : question.status,
  }
}
