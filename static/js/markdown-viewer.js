export function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let listItems = [];
  let codeLines = [];
  let inCodeBlock = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${parseInlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    html.push(`<ul>${listItems.map((item) => `<li>${parseInlineMarkdown(item)}</li>`).join('')}</ul>`);
    listItems = [];
  };

  const flushCode = () => {
    if (!codeLines.length) return;
    const code = codeLines.join('\n').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html.push(`<pre><code>${code}</code></pre>`);
    codeLines = [];
  };

  for (const line of lines) {
    if (line.startsWith('```')) {
      flushParagraph();
      flushList();
      if (inCodeBlock) {
        flushCode();
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      html.push(`<h${level}>${parseInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      html.push(`<blockquote><p>${parseInlineMarkdown(quote[1])}</p></blockquote>`);
      continue;
    }

    const list = line.match(/^[-*]\s+(.*)$/) || line.match(/^\d+\.\s+(.*)$/);
    if (list) {
      flushParagraph();
      listItems.push(list[1]);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushCode();

  return html.join('');
}

export function attachMarkdownViewerControls(windowEl) {
  const viewport = windowEl.querySelector('[data-markdown-viewport]');
  const fontSizeSelect = windowEl.querySelector('[data-markdown-font-size]');
  const lineSpacingSelect = windowEl.querySelector('[data-markdown-line-spacing]');

  const sync = () => {
    viewport.style.setProperty('--viewer-font-size', fontSizeSelect.value);
    viewport.style.setProperty('--viewer-line-height', lineSpacingSelect.value);
  };

  fontSizeSelect.addEventListener('change', sync);
  lineSpacingSelect.addEventListener('change', sync);
  sync();
}

function parseInlineMarkdown(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/&lt;(https?:\/\/[^\s]+)&gt;/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>');
}
