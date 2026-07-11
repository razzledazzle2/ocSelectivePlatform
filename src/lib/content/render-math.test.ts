/**
 * Tests that KaTeX rendering is correct and safe.
 * Run: npm test
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { renderMathToHtml } from './render-math.ts'

test('renders a fraction to KaTeX HTML with accessible MathML', () => {
  const html = renderMathToHtml('\\frac{3}{4}', false)
  assert.match(html, /class="katex"/)
  assert.match(html, /<math/) // MathML present for screen readers
})

test('display mode emits the katex-display wrapper', () => {
  const html = renderMathToHtml('\\frac{9}{10} - \\frac{3}{5}', true)
  assert.match(html, /katex-display/)
})

test('malformed TeX degrades instead of throwing (throwOnError: false)', () => {
  assert.doesNotThrow(() => renderMathToHtml('\\frac{1}{', false))
})

test('output is safe: \\href is rejected, no anchors, scripts or event handlers', () => {
  // trust:false disables \\href, so KaTeX renders it as inert error text rather
  // than an actual link (the raw source is only echoed inside a MathML
  // annotation, which is not an active link).
  const html = renderMathToHtml('\\href{javascript:alert(1)}{x}', false)
  assert.doesNotMatch(html, /<script/i)
  assert.doesNotMatch(html, /on(error|click|load|mouseover)=/i)
  assert.doesNotMatch(html, /<a\s/i) // no anchor element emitted
  assert.doesNotMatch(html, /href=/i) // no href attribute emitted
})
