/**
 * The downloadable CSV template for bulk question import.
 * Client-safe (no server imports) — the wizard turns this into a Blob download.
 *
 * option_e may be left blank for 4-option subjects; correct_answer must point
 * at an option that exists (A–E). tags are comma-separated inside one cell.
 * status defaults to draft when blank. An options_json column (JSON array of
 * option texts) is also accepted instead of option_a–option_e.
 */
export const CSV_TEMPLATE_FILENAME = 'question-import-template.csv'

export const CSV_TEMPLATE_HEADERS = [
  'question_text',
  'subject',
  'topic',
  'question_type',
  'difficulty',
  'exam_type',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'option_e',
  'correct_answer',
  'worked_solution',
  'short_explanation',
  'tags',
  'status',
] as const

const EXAMPLE_ROWS: string[][] = [
  [
    'What is 25% of 360?',
    'Mathematical Reasoning',
    'Percentages',
    'Percentage of a quantity',
    '1',
    'Selective',
    '60',
    '75',
    '90',
    '120',
    '150',
    'C',
    '25% is one quarter. One quarter of 360 is 90.',
    'A quarter of 360 is 90.',
    'percentages, arithmetic',
    'draft',
  ],
  [
    'Which statement best strengthens the argument?',
    'Thinking Skills',
    'Strengthening and weakening',
    'Strengthen the argument',
    '2',
    'Selective',
    'It repeats the conclusion in different words.',
    'It gives independent evidence supporting the premise.',
    'It attacks the person making the argument.',
    'It changes the subject entirely.',
    '',
    'B',
    'B adds new evidence that makes the conclusion more likely, which is what strengthening means.',
    'New supporting evidence strengthens an argument.',
    'arguments, evidence',
    'draft',
  ],
]

function escapeCsvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function buildCsvTemplate(): string {
  const lines = [
    CSV_TEMPLATE_HEADERS.join(','),
    ...EXAMPLE_ROWS.map((row) => row.map(escapeCsvCell).join(',')),
  ]
  return `${lines.join('\n')}\n`
}
