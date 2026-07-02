import type { QuestionDetail, QuestionFormValues, QuestionTypeRecord, SubjectRecord, TopicRecord } from '@/lib/types'

export function createEmptyQuestionFormValues(
  subjects: SubjectRecord[],
  topics: TopicRecord[],
  questionTypes: QuestionTypeRecord[]
): QuestionFormValues {
  const defaultSubjectId = subjects[0]?.id ?? ''
  const defaultTopicId = topics.find((topic) => topic.subject_id === defaultSubjectId)?.id ?? ''
  const defaultQuestionTypeId =
    questionTypes.find((questionType) => questionType.topic_id === defaultTopicId)?.id ??
    questionTypes.find((questionType) => questionType.subject_id === defaultSubjectId)?.id ??
    ''

  return {
    examType: 'OC',
    subjectId: defaultSubjectId,
    topicId: defaultTopicId,
    questionTypeId: defaultQuestionTypeId,
    yearLevel: '',
    difficulty: '3',
    questionText: '',
    passageText: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctOptionLabel: 'A',
    shortExplanation: '',
    workedSolution: '',
    status: 'draft',
  }
}

export function questionDetailToFormValues(question: QuestionDetail): QuestionFormValues {
  const getOptionText = (label: 'A' | 'B' | 'C' | 'D') =>
    question.options.find((option) => option.label === label)?.option_text ?? ''

  return {
    examType: question.exam_type,
    subjectId: question.subject_id,
    topicId: question.topic_id,
    questionTypeId: question.question_type_id ?? '',
    yearLevel: question.year_level ? String(question.year_level) : '',
    difficulty: String(question.difficulty),
    questionText: question.question_text,
    passageText: question.passage_text ?? '',
    optionA: getOptionText('A'),
    optionB: getOptionText('B'),
    optionC: getOptionText('C'),
    optionD: getOptionText('D'),
    correctOptionLabel: question.correct_option_label,
    shortExplanation: question.short_explanation ?? '',
    workedSolution: question.worked_solution,
    status: question.status === 'archived' ? 'draft' : question.status,
  }
}
