import { notFound } from 'next/navigation'

import { QuestionForm } from '@/components/admin/question-form'
import { questionDetailToFormValues } from '@/lib/questions/form-values'
import {
  getQuestionById,
  getQuestionTypes,
  getSubjects,
  getTopicsBySubject,
} from '@/lib/questions/queries'

interface EditAdminQuestionPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function EditAdminQuestionPage({ params }: EditAdminQuestionPageProps) {
  const { id } = await params
  const [question, subjects, topics, questionTypes] = await Promise.all([
    getQuestionById(id),
    getSubjects(),
    getTopicsBySubject(),
    getQuestionTypes(),
  ])

  if (!question) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-700">Question Bank</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-950">Edit question</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Refine wording, answers, and publishing status without losing the question history.
        </p>
      </div>

      <QuestionForm
        mode="edit"
        questionId={question.id}
        subjects={subjects}
        topics={topics}
        questionTypes={questionTypes}
        initialValues={questionDetailToFormValues(question)}
      />
    </div>
  )
}
