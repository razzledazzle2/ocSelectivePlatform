import { redirect } from 'next/navigation'

/** Old mastery subtopic URL → the consolidated Learn & Practice subtopic view. */
export default async function MasterySubtopicRedirect({
  params,
}: {
  params: Promise<{ domainCode: string; subtopicCode: string }>
}) {
  const { domainCode, subtopicCode } = await params
  redirect(`/student/practice/${domainCode}/${subtopicCode}`)
}
