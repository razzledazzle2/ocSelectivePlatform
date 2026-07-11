import { redirect } from 'next/navigation'

/** Old mastery domain URL → the consolidated Learn & Practice domain view. */
export default async function MasteryDomainRedirect({
  params,
}: {
  params: Promise<{ domainCode: string }>
}) {
  const { domainCode } = await params
  redirect(`/student/practice/${domainCode}`)
}
