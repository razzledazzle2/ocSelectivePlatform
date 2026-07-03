import { PageHeader } from '@/components/layout/page-header'
import { QuestionForm } from '@/components/admin/question-form'
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
      <PageHeader
        eyebrow="Question Bank"
        title="New question"
        description="Create an original multiple-choice question for OC or Selective practice."
      />

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
