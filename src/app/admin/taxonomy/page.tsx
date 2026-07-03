import { TaxonomyManager } from '@/components/admin/taxonomy-manager'
import { requireProfile } from '@/lib/auth/require-profile'
import { DEFAULT_OPTION_RULE, OPTION_COUNT_RULES } from '@/lib/questions/option-rules'
import { getQuestionTypes, getSubjects, getTopicsBySubject } from '@/lib/questions/queries'
import { ADMIN_PORTAL_ROLES } from '@/lib/types'

export default async function AdminTaxonomyPage() {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  const [subjects, topics, questionTypes] = await Promise.all([
    getSubjects(),
    getTopicsBySubject(),
    getQuestionTypes(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand">Content structure</p>
        <h2 className="mt-2 text-3xl font-semibold text-foreground">Question Taxonomy</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage the subjects, topics and question types that questions are filed under. Bulk import can also
          create topics and question types automatically — this is where you review and tidy them.
        </p>
      </div>

      <TaxonomyManager
        subjects={subjects}
        topics={topics}
        questionTypes={questionTypes}
        optionRules={OPTION_COUNT_RULES}
        defaultOptionRule={DEFAULT_OPTION_RULE}
      />
    </div>
  )
}
