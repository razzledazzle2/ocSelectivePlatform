/**
 * Per-subject visual identity for the student Learn & Practice area. Colour is
 * assigned by MEANING (the subject), never sprinkled decoratively — see the
 * redesign brief. Tailwind palette classes are used directly so the mapping is
 * self-contained and theme-aware without new design tokens.
 */
import { BookOpenTextIcon, CalculatorIcon, PenLineIcon, PuzzleIcon, type LucideIcon } from 'lucide-react'

export interface SubjectVisual {
  /** Tinted chip / icon background + foreground. */
  chip: string
  /** Accent text colour (labels, links). */
  text: string
  /** Progress-bar / accent fill. */
  bar: string
  /** Soft surface tint used on hero cards. */
  surface: string
  /** Left ring / border accent on hover. */
  ring: string
  icon: LucideIcon
}

const DEFAULT_VISUAL: SubjectVisual = {
  chip: 'bg-brand-soft text-brand',
  text: 'text-brand',
  bar: 'bg-brand',
  surface: 'bg-brand-soft',
  ring: 'ring-brand/30',
  icon: BookOpenTextIcon,
}

/** Mathematical Reasoning → blue · Thinking Skills → violet · Reading → amber · Writing → teal. */
const SUBJECT_VISUALS: Record<string, SubjectVisual> = {
  mathematical_reasoning: {
    chip: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
    text: 'text-sky-700 dark:text-sky-300',
    bar: 'bg-sky-500',
    surface: 'bg-sky-500/8',
    ring: 'ring-sky-500/30',
    icon: CalculatorIcon,
  },
  thinking_skills: {
    chip: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
    text: 'text-violet-700 dark:text-violet-300',
    bar: 'bg-violet-500',
    surface: 'bg-violet-500/8',
    ring: 'ring-violet-500/30',
    icon: PuzzleIcon,
  },
  reading: {
    chip: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
    text: 'text-amber-700 dark:text-amber-300',
    bar: 'bg-amber-500',
    surface: 'bg-amber-500/8',
    ring: 'ring-amber-500/30',
    icon: BookOpenTextIcon,
  },
  writing: {
    chip: 'bg-teal-500/12 text-teal-700 dark:text-teal-300',
    text: 'text-teal-700 dark:text-teal-300',
    bar: 'bg-teal-500',
    surface: 'bg-teal-500/8',
    ring: 'ring-teal-500/30',
    icon: PenLineIcon,
  },
}

export function getSubjectVisual(subjectCode: string): SubjectVisual {
  return SUBJECT_VISUALS[subjectCode] ?? DEFAULT_VISUAL
}
