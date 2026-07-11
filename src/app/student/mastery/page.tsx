import { redirect } from 'next/navigation'

/** Mastery was consolidated into Learn & Practice. Preserve old bookmarks. */
export default function StudentMasteryPage() {
  redirect('/student/practice')
}
