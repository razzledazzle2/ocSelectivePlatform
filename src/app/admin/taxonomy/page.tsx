import { TaxonomyManager } from '@/components/admin/taxonomy-manager'
import { PageHeader } from '@/components/layout/page-header'
import { requireProfile } from '@/lib/auth/require-profile'
import { DEFAULT_OPTION_RULE, OPTION_COUNT_RULES } from '@/lib/questions/option-rules'
import { getQuestionTypes, getSubjects, getTopicsBySubject } from '@/lib/questions/queries'
import { getTaxonomyUsage } from '@/lib/questions/taxonomy-stats'
import { ADMIN_PORTAL_ROLES } from '@/lib/types'

export default async function AdminTaxonomyPage() {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  const [subjects, topics, questionTypes, usage] = await Promise.all([
    getSubjects(),
    getTopicsBySubject(),
    getQuestionTypes(),
    getTaxonomyUsage(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content structure"
        title="Question Taxonomy"
        description="Subjects, categories, question types and tags — with real usage counts from the bank. Bulk import can create categories automatically; this is where you review, rename, merge and tidy them."
      />

      <TaxonomyManager
        subjects={subjects}
        topics={topics}
        questionTypes={questionTypes}
        usage={usage}
        optionRules={OPTION_COUNT_RULES}
        defaultOptionRule={DEFAULT_OPTION_RULE}
      />
    </div>
  )
}
