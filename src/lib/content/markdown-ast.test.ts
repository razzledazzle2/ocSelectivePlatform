/**
 * Tests for the pure Markdown → AST parser used by the shared content renderer.
 * Run: npm test  (node --test --experimental-strip-types "src/**\/*.test.ts")
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseMarkdown, tokenizeInline } from './markdown-ast.ts'

test('plain-text legacy question renders as a single paragraph, text preserved', () => {
  const blocks = parseMarkdown('What is 25% of 360?')
  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].kind, 'paragraph')
  const block = blocks[0]
  assert.ok(block.kind === 'paragraph')
  assert.deepEqual(block.lines[0], [{ kind: 'text', value: 'What is 25% of 360?' }])
})

test('bold and italic inline segments', () => {
  const segments = tokenizeInline('The **fun run** raised *more* money')
  assert.deepEqual(segments, [
    { kind: 'text', value: 'The ' },
    { kind: 'bold', value: 'fun run' },
    { kind: 'text', value: ' raised ' },
    { kind: 'italic', value: 'more' },
    { kind: 'text', value: ' money' },
  ])
})

test('inline fraction maths with \\( \\) is captured as opaque TeX', () => {
  const segments = tokenizeInline('A tank is \\(\\frac{3}{5}\\) full.')
  assert.deepEqual(segments, [
    { kind: 'text', value: 'A tank is ' },
    { kind: 'math', tex: '\\frac{3}{5}' },
    { kind: 'text', value: ' full.' },
  ])
})

test('inline maths with $…$ is captured, but currency is left as text', () => {
  assert.deepEqual(tokenizeInline('Solve $x + 7 = 19$ now'), [
    { kind: 'text', value: 'Solve ' },
    { kind: 'math', tex: 'x + 7 = 19' },
    { kind: 'text', value: ' now' },
  ])
  // Currency must NOT be treated as maths.
  assert.deepEqual(tokenizeInline('I have $5 and $10 left'), [
    { kind: 'text', value: 'I have $5 and $10 left' },
  ])
})

test('emphasis markers inside maths are not treated as italics', () => {
  const segments = tokenizeInline('Area is \\(2*a*b\\) units')
  assert.deepEqual(segments, [
    { kind: 'text', value: 'Area is ' },
    { kind: 'math', tex: '2*a*b' },
    { kind: 'text', value: ' units' },
  ])
})

test('display maths \\[ … \\] becomes a standalone math block', () => {
  const blocks = parseMarkdown('Working:\n\n\\[ \\frac{9}{10} - \\frac{3}{5} = \\frac{3}{10} \\]')
  assert.equal(blocks.length, 2)
  assert.equal(blocks[0].kind, 'paragraph')
  assert.deepEqual(blocks[1], { kind: 'mathBlock', tex: '\\frac{9}{10} - \\frac{3}{5} = \\frac{3}{10}' })
})

test('$$ … $$ display maths is captured', () => {
  const blocks = parseMarkdown('$$ a^2 + b^2 = c^2 $$')
  assert.deepEqual(blocks, [{ kind: 'mathBlock', tex: 'a^2 + b^2 = c^2' }])
})

test('unordered list (logic rules) parses into a list block', () => {
  const blocks = parseMarkdown('- Red beats blue\n- Blue beats green\n- Green beats red')
  assert.equal(blocks.length, 1)
  const block = blocks[0]
  assert.ok(block.kind === 'list')
  assert.equal(block.ordered, false)
  assert.equal(block.items.length, 3)
  assert.deepEqual(block.items[0], [{ kind: 'text', value: 'Red beats blue' }])
})

test('ordered list parses with ordered=true', () => {
  const blocks = parseMarkdown('1. First\n2. Second')
  const block = blocks[0]
  assert.ok(block.kind === 'list')
  assert.equal(block.ordered, true)
})

test('blockquote and heading parse into their own blocks', () => {
  const blocks = parseMarkdown('# Rules\n\n> Speaker A: the run helped.')
  assert.equal(blocks[0].kind, 'heading')
  assert.equal(blocks[1].kind, 'blockquote')
})

test('GitHub pipe table parses header + rows', () => {
  const blocks = parseMarkdown('| Stop | Bus A |\n|------|-------|\n| Mall | 9:05 |\n| Pool | 9:17 |')
  const block = blocks[0]
  assert.ok(block.kind === 'table')
  assert.ok(block.header)
  assert.equal(block.header.length, 2)
  assert.equal(block.rows.length, 2)
  assert.deepEqual(block.rows[0][0], [{ kind: 'text', value: 'Mall' }])
})

test('a table directly under a sentence still splits into paragraph + table', () => {
  const blocks = parseMarkdown('The timetable:\n| A | B |\n|---|---|\n| 1 | 2 |')
  assert.equal(blocks[0].kind, 'paragraph')
  assert.equal(blocks[1].kind, 'table')
})

test('raw HTML is never emitted — it stays literal text (XSS-safe by construction)', () => {
  const blocks = parseMarkdown('<script>alert(1)</script> and <img src=x onerror=alert(1)>')
  assert.equal(blocks.length, 1)
  const block = blocks[0]
  assert.ok(block.kind === 'paragraph')
  // The angle-bracket markup survives verbatim as plain text segments, never as nodes.
  const text = block.lines[0].map((seg) => (seg.kind === 'text' ? seg.value : '')).join('')
  assert.ok(text.includes('<script>alert(1)</script>'))
})

test('single newlines within a paragraph are preserved as separate lines', () => {
  const blocks = parseMarkdown('Line one\nLine two')
  const block = blocks[0]
  assert.ok(block.kind === 'paragraph')
  assert.equal(block.lines.length, 2)
})

test('CRLF newlines are normalised', () => {
  const blocks = parseMarkdown('A\r\n\r\nB')
  assert.equal(blocks.length, 2)
})
