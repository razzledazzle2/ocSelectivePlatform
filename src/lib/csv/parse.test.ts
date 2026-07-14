/**
 * The CSV parser must carry Markdown + LaTeX content losslessly: backslashes,
 * embedded newlines, quotes and commas inside quoted fields, and CRLF handling.
 * Run: npm test
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseCsvText } from './parse.ts'

test('LaTeX backslashes are preserved verbatim (no unescaping)', () => {
  const rows = parseCsvText('question_text\n"A tank is \\(\\frac{3}{5}\\) full."')
  assert.equal(rows[1][0], 'A tank is \\(\\frac{3}{5}\\) full.')
})

test('literal backslash-n is NOT converted to a newline', () => {
  const rows = parseCsvText('a\nfoo\\nbar')
  assert.equal(rows[1][0], 'foo\\nbar')
})

test('embedded real newlines inside a quoted field are kept (multiline Markdown)', () => {
  const csv = 'stimulus_text\n"The table:\n\n| A | B |\n|---|---|\n| 1 | 2 |"'
  const rows = parseCsvText(csv)
  assert.equal(rows[1][0], 'The table:\n\n| A | B |\n|---|---|\n| 1 | 2 |')
})

test('doubled quotes decode to a single quote; commas inside quotes are preserved', () => {
  const rows = parseCsvText('a\n"the word ""Reluctantly"" means, roughly, X"')
  assert.equal(rows[1][0], 'the word "Reluctantly" means, roughly, X')
})

test('CRLF newlines are treated as one row break', () => {
  const rows = parseCsvText('a,b\r\n1,2\r\n3,4')
  assert.deepEqual(rows, [
    ['a', 'b'],
    ['1', '2'],
    ['3', '4'],
  ])
})

test('empty cells stay empty strings, never the literal "null"', () => {
  const rows = parseCsvText('a,b,c\n1,,3')
  assert.deepEqual(rows[1], ['1', '', '3'])
})
