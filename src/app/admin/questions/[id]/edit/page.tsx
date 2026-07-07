import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/layout/page-header'
import { QuestionForm } from '@/components/admin/question-form'
import { questionDetailToFormValues } from '@/lib/questions/form-values'
import {
  getQuestionById,
  getQuestionTypes,
  getSubjects,
  getTopicsBySubject,
} from '@/lib/questions/queries'
import { getStimuliForPicker } from '@/lib/stimuli/queries'

interface EditAdminQuestionPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function EditAdminQuestionPage({ params }: EditAdminQuestionPageProps) {
  const { id } = await params
  const [question, subjects, topics, questionTypes, stimuli] = await Promise.all([
    getQuestionById(id),
    getSubjects(),
    getTopicsBySubject(),
    getQuestionTypes(),
    getStimuliForPicker(),
  ])

  if (!question) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Question Bank"
        title="Edit question"
        description="Refine wording, answers, and publishing status without losing the question history."
      />

      <QuestionForm
        mode="edit"
        questionId={question.id}
        subjects={subjects}
        topics={topics}
        questionTypes={questionTypes}
        stimuli={stimuli}
        initialValues={questionDetailToFormValues(question)}
      />
    </div>
  )
}
