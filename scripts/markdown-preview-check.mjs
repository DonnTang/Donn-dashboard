import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

const markdown = '| 项目 | 状态 |\n| --- | --- |\n| Orbit | 完成 |\n\n```js\nconst done = true\n```'
const html = renderToStaticMarkup(React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], rehypePlugins: [[rehypeHighlight, { detect: true, ignoreMissing: true }]] }, markdown))

assert.match(html, /<table>/)
assert.match(html, /hljs-keyword/)
