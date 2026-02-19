import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import katex from 'katex';

marked.setOptions({
  highlight: (code, lang) => {
    try {
      return lang && hljs.getLanguage(lang)
        ? hljs.highlight(code, { language: lang }).value
        : hljs.highlightAuto(code).value;
    } catch { return code; }
  },
  breaks: true,
  gfm: true,
});

function renderLatex(html) {
  // Protect <code> and <pre> content from LaTeX processing
  const codeBlocks = [];
  html = html.replace(/<(pre|code)([\s\S]*?)>([\s\S]*?)<\/\1>/gi, (m) => {
    codeBlocks.push(m);
    return `%%CODE${codeBlocks.length - 1}%%`;
  });

  // Block math: $$...$$
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (m, tex) => {
    try { return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false }); } catch { return m; }
  });
  // Block math: \[...\]
  html = html.replace(/\\\[([\s\S]*?)\\\]/g, (m, tex) => {
    try { return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false }); } catch { return m; }
  });
  // Inline math: $...$ (not $$)
  html = html.replace(/(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+?)\$(?!\$)/g, (m, tex) => {
    try { return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false }); } catch { return m; }
  });
  // Inline math: \(...\)
  html = html.replace(/\\\(([\s\S]*?)\\\)/g, (m, tex) => {
    try { return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false }); } catch { return m; }
  });

  // Restore code blocks
  html = html.replace(/%%CODE(\d+)%%/g, (m, i) => codeBlocks[parseInt(i)] || m);
  return html;
}

export function renderMarkdown(text, { isStreaming = false } = {}) {
  // Count code fences to determine which blocks are complete during streaming
  // A complete code block has both opening and closing ```
  let completedBlockCount = 0;
  let hasIncompleteBlock = false;
  if (isStreaming) {
    const fenceRegex = /```/g;
    let count = 0;
    while (fenceRegex.exec(text)) count++;
    completedBlockCount = Math.floor(count / 2);
    hasIncompleteBlock = count % 2 !== 0;
  }

  // Step 1: Protect code fences and inline code from math extraction
  const codeShields = [];

  // Fenced code blocks: ```...```
  let p = text.replace(/```[\s\S]*?```/g, (m) => {
    codeShields.push(m);
    return `%%CSHIELD${codeShields.length - 1}%%`;
  });
  // Inline code: `...`
  p = p.replace(/`[^`]+`/g, (m) => {
    codeShields.push(m);
    return `%%CSHIELD${codeShields.length - 1}%%`;
  });

  // Step 2: Extract math blocks into placeholders (only from non-code text now)
  const mathBlocks = [];
  p = p.replace(/\$\$([\s\S]*?)\$\$/g, (m) => { mathBlocks.push(m); return `%%MATH${mathBlocks.length - 1}%%`; });
  p = p.replace(/\\\[([\s\S]*?)\\\]/g, (m) => { mathBlocks.push(m); return `%%MATH${mathBlocks.length - 1}%%`; });
  p = p.replace(/(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+?)\$(?!\$)/g, (m) => { mathBlocks.push(m); return `%%MATH${mathBlocks.length - 1}%%`; });
  p = p.replace(/\\\(([\s\S]*?)\\\)/g, (m) => { mathBlocks.push(m); return `%%MATH${mathBlocks.length - 1}%%`; });

  // Step 3: Restore code shields before passing to marked
  p = p.replace(/%%CSHIELD(\d+)%%/g, (m, i) => codeShields[parseInt(i)] || m);

  // Step 4: Parse markdown
  const raw = marked.parse(p);

  // Step 5: Restore math placeholders and render LaTeX
  let restored = raw.replace(/%%MATH(\d+)%%/g, (m, i) => mathBlocks[parseInt(i)] || m);
  restored = renderLatex(restored);

  // Step 6: Sanitize
  const clean = DOMPurify.sanitize(restored, {
    ADD_ATTR: ['class', 'target', 'aria-hidden', 'style'],
    ALLOW_DATA_ATTR: false,
    ADD_TAGS: ['semantics', 'annotation', 'math', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'mover', 'munder', 'mspace', 'mtable', 'mtr', 'mtd', 'mtext', 'msqrt', 'mroot'],
  });

  // Step 7: Post-process — add code headers to pre blocks
  const div = document.createElement('div');
  div.innerHTML = clean;
  const preBlocks = div.querySelectorAll('pre');
  preBlocks.forEach((pre, idx) => {
    const code = pre.querySelector('code');
    const lang = code?.className?.match(/language-(\w+)/)?.[1] || '';
    const hdr = document.createElement('div');
    hdr.className = 'code-header';

    let btnLabel = 'Copy';
    let isIncomplete = false;
    if (isStreaming) {
      // First N blocks are complete, the last one (if odd fence count) is incomplete
      if (idx < completedBlockCount) {
        btnLabel = 'Copy';
      } else if (hasIncompleteBlock && idx === preBlocks.length - 1) {
        btnLabel = 'Copy when done';
        isIncomplete = true;
      } else {
        btnLabel = 'Copy';
      }
    }

    hdr.innerHTML = `<span>${lang || 'code'}</span><button class="copy-btn" data-copy${isIncomplete ? ' data-incomplete' : ''}>${btnLabel}</button>`;
    pre.insertBefore(hdr, pre.firstChild);
  });

  return div.innerHTML;
}
