import { QuestionForm } from '@/components/questions/question-form'
import { createEmptyQuestionFormValues } from '@/lib/questions/form-values'
import {
  getQuestionTypes,
  getSubjects,
  getTopicsBySubject,
} from '@/lib/questions/queries'

export default async function NewAdminQuestionPage() {
  const [subjects, topics, questionTypes] = await Promise.all([
    getSubjects(),
    getTopicsBySubject(),
    getQuestionTypes(),
  ])
  const initialValues = createEmptyQuestionFormValues(subjects, topics, questionTypes)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-700">Question Bank</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-950">New question</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Create an original multiple-choice question for OC or Selective practice.
        </p>
      </div>

      <QuestionForm
        mode="create"
        subjects={subjects}
        topics={topics}
        questionTypes={questionTypes}
        initialValues={initialValues}
      />
    </div>
  )
}
