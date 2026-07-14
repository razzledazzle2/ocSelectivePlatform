import katex from 'katex'

/**
 * Render a TeX string to KaTeX HTML+MathML.
 *
 * Security: `trust: false` (the default) disables `\href`, `\includegraphics`,
 * `\htmlClass` and every other command that could emit links, scripts or raw
 * attributes, so the output is safe to inject with `dangerouslySetInnerHTML`.
 * `throwOnError: false` degrades a malformed expression to a red-rendered
 * source string instead of crashing the render. `output: 'htmlAndMathml'`
 * keeps an accessible MathML tree alongside the visual HTML.
 */
export function renderMathToHtml(tex: string, displayMode: boolean): string {
  return katex.renderToString(tex, {
    displayMode,
    throwOnError: false,
    trust: false,
    strict: false,
    output: 'htmlAndMathml',
  })
}
