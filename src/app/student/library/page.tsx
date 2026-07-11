import { redirect } from 'next/navigation'

/**
 * The Skill Library — a flat, legacy-topic-first mastery view — was replaced by
 * taxonomy-driven Subtopic Mastery. Kept as a redirect so saved links still work.
 */
export default function StudentLibraryPage() {
  redirect('/student/mastery')
}
