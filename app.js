const desktop = document.getElementById('desktop');
const desktopSurface = document.getElementById('desktop-surface');
const windowTemplate = document.getElementById('window-template');
const brandLabel = document.getElementById('brand-label');
const memoryLabel = document.getElementById('memory-label');

let topZ = 10;

const openWindows = new Map();
const windowState = new Map();
let nodes = {};

function focusWindow(windowEl) {
  topZ += 1;
  document.querySelectorAll('.window').forEach((item) => item.classList.remove('is-active'));
  windowEl.classList.add('is-active');
  windowEl.style.zIndex = String(topZ);
}

function saveWindowState(nodeId, windowEl) {
  windowState.set(nodeId, {
    left: windowEl.style.left,
    top: windowEl.style.top,
    width: windowEl.style.width,
  });
}

function getWindowPlacement(nodeId) {
  const node = nodes[nodeId];
  return windowState.get(nodeId) || node.defaultPosition || { left: 48, top: 64, width: 'min(28rem, 82vw)' };
}

function applyWindowPlacement(nodeId, windowEl) {
  const placement = getWindowPlacement(nodeId);
  windowEl.style.left = typeof placement.left === 'number' ? `${placement.left}px` : placement.left;
  windowEl.style.top = typeof placement.top === 'number' ? `${placement.top}px` : placement.top;
  windowEl.style.width = placement.width || 'min(28rem, 82vw)';
}

function iconMarkup(type) {
  if (type === 'drawer') {
    return '<span class="wb-icon wb-icon--drawer" aria-hidden="true"><span class="wb-icon__lid"></span><span class="wb-icon__body"></span><span class="wb-icon__slot"></span></span>';
  }
  return '<span class="wb-icon wb-icon--file" aria-hidden="true"><span class="wb-icon__sheet"></span><span class="wb-icon__fold"></span></span>';
}

function labelFromTitle(title) {
  return title.replace(/\.(info|txt|doc|readme|md|001)$/i, '');
}

function makeIcon(nodeId, className = 'file-icon') {
  const node = nodes[nodeId];
  const button = document.createElement('button');
  button.className = className;
  button.dataset.target = nodeId;
  button.innerHTML = `${iconMarkup(node.type === 'drawer' ? 'drawer' : 'file')}<span class="${className}__label">${labelFromTitle(node.title)}</span>`;
  return button;
}

function bindWindow(nodeId, windowEl) {
  windowEl.addEventListener('pointerdown', () => focusWindow(windowEl));

  const closeButton = windowEl.querySelector('[data-close]');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      saveWindowState(nodeId, windowEl);
      openWindows.delete(nodeId);
      windowEl.remove();
    });
  }

  const handle = windowEl.querySelector('[data-drag-handle]');
  if (!handle) return;

  handle.addEventListener('pointerdown', (event) => {
    if (event.target instanceof HTMLElement && event.target.closest('button, select')) return;

    focusWindow(windowEl);

    const rect = windowEl.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    const move = (moveEvent) => {
      const currentRect = windowEl.getBoundingClientRect();
      const maxLeft = window.innerWidth - currentRect.width;
      const maxTop = window.innerHeight - currentRect.height;
      const left = Math.min(Math.max(0, moveEvent.clientX - offsetX), Math.max(0, maxLeft));
      const top = Math.min(Math.max(25, moveEvent.clientY - offsetY), Math.max(25, maxTop));
      windowEl.style.left = `${left}px`;
      windowEl.style.top = `${top}px`;
    };

    const stop = () => {
      saveWindowState(nodeId, windowEl);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  });
}

function buildDrawerWindow(nodeId) {
  const node = nodes[nodeId];
  const fragment = windowTemplate.content.cloneNode(true);
  const windowEl = fragment.querySelector('.window');
  const title = fragment.querySelector('.window__titletext');
  const content = fragment.querySelector('.window__content');
  const toolbarItems = Array.isArray(node.toolbar) ? node.toolbar.filter(Boolean) : [];
  const toolbarMarkup = toolbarItems.length
    ? `
      <div class="window__toolbar">
        ${toolbarItems.map((item) => `<button class="toolbar-button" type="button">${item}</button>`).join('')}
      </div>
    `
    : '';

  title.textContent = node.title;
  content.innerHTML = `
    ${toolbarMarkup}
    <div class="window__body icon-grid"></div>
  `;

  const grid = content.querySelector('.icon-grid');
  node.children.forEach((childId) => grid.appendChild(makeIcon(childId)));

  applyWindowPlacement(nodeId, windowEl);
  desktop.appendChild(windowEl);
  openWindows.set(nodeId, windowEl);
  bindWindow(nodeId, windowEl);
  focusWindow(windowEl);
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

function renderMarkdown(markdown) {
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

function attachMarkdownViewerControls(windowEl, nodeId) {
  const viewport = windowEl.querySelector('[data-markdown-viewport]');
  const fontSizeSelect = windowEl.querySelector('[data-markdown-font-size]');
  const lineSpacingSelect = windowEl.querySelector('[data-markdown-line-spacing]');

  const sync = () => {
    viewport.style.setProperty('--viewer-font-size', fontSizeSelect.value);
    viewport.style.setProperty('--viewer-line-height', lineSpacingSelect.value);
    saveWindowState(nodeId, windowEl);
  };

  fontSizeSelect.addEventListener('change', sync);
  lineSpacingSelect.addEventListener('change', sync);
  sync();
}

function buildMarkdownWindow(nodeId) {
  const node = nodes[nodeId];
  const fragment = windowTemplate.content.cloneNode(true);
  const windowEl = fragment.querySelector('.window');
  const title = fragment.querySelector('.window__titletext');
  const content = fragment.querySelector('.window__content');

  title.textContent = node.title;
  content.innerHTML = `
    <div class="window__toolbar window__toolbar--markdown">
      <label class="toolbar-field">Font size
        <select class="toolbar-select" data-markdown-font-size>
          <option value="14px">Small</option>
          <option value="16px" selected>Medium</option>
          <option value="18px">Large</option>
        </select>
      </label>
      <label class="toolbar-field">Line spacing
        <select class="toolbar-select" data-markdown-line-spacing>
          <option value="1.35">Tight</option>
          <option value="1.55" selected>Normal</option>
          <option value="1.8">Loose</option>
        </select>
      </label>
    </div>
    <div class="window__body markdown-viewer" data-markdown-viewport>
      ${renderMarkdown(node.markdown || '')}
    </div>
  `;

  applyWindowPlacement(nodeId, windowEl);
  desktop.appendChild(windowEl);
  openWindows.set(nodeId, windowEl);
  bindWindow(nodeId, windowEl);
  attachMarkdownViewerControls(windowEl, nodeId);
  focusWindow(windowEl);
}

function buildFileWindow(nodeId) {
  const node = nodes[nodeId];
  const fragment = windowTemplate.content.cloneNode(true);
  const windowEl = fragment.querySelector('.window');
  const title = fragment.querySelector('.window__titletext');
  const content = fragment.querySelector('.window__content');

  title.textContent = node.title;
  content.innerHTML = node.body;

  applyWindowPlacement(nodeId, windowEl);
  desktop.appendChild(windowEl);
  openWindows.set(nodeId, windowEl);
  bindWindow(nodeId, windowEl);
  focusWindow(windowEl);
}

function openNode(nodeId) {
  const existingWindow = openWindows.get(nodeId);
  if (existingWindow) {
    focusWindow(existingWindow);
    return;
  }

  const node = nodes[nodeId];
  if (!node) return;
  if (node.type === 'drawer') buildDrawerWindow(nodeId);
  if (node.type === 'file') buildFileWindow(nodeId);
  if (node.type === 'markdown') buildMarkdownWindow(nodeId);
}

function renderDesktop(rootIcons) {
  desktopSurface.innerHTML = '';
  rootIcons.forEach((nodeId) => {
    desktopSurface.appendChild(makeIcon(nodeId, 'desktop-icon'));
  });
}

async function init() {
  const response = await fetch('./data.json');
  const data = await response.json();
  nodes = data.nodes || {};
  brandLabel.textContent = data.desktop?.versionLabel || 'Amiga Workbench, Version boblbench';
  memoryLabel.textContent = data.desktop?.memoryLabel || '';
  renderDesktop(data.desktop?.rootIcons || []);
  openNode('about-drawer');
}

desktopSurface.addEventListener('click', (event) => {
  const target = event.target.closest('.desktop-icon[data-target]');
  if (!target) return;
  openNode(target.dataset.target);
});

desktop.addEventListener('click', (event) => {
  const target = event.target.closest('.file-icon[data-target]');
  if (!target) return;
  openNode(target.dataset.target);
});

init().catch((error) => {
  console.error('Failed to initialize desktop', error);
});
