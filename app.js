import { renderMarkdown, attachMarkdownViewerControls } from './markdown-viewer.js';

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

  title.textContent = node.title;
  content.innerHTML = `
    <div class="window__toolbar">
      ${(node.toolbar || ['Workbench']).map((item) => `<button class="toolbar-button" type="button">${item}</button>`).join('')}
    </div>
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

async function loadMarkdownSource(node) {
  const response = await fetch(node.src);
  if (!response.ok) {
    throw new Error(`Unable to load markdown source: ${node.src}`);
  }
  return response.text();
}

async function buildMarkdownWindow(nodeId) {
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
      <p>Loading markdown…</p>
    </div>
  `;

  applyWindowPlacement(nodeId, windowEl);
  desktop.appendChild(windowEl);
  openWindows.set(nodeId, windowEl);
  bindWindow(nodeId, windowEl);
  attachMarkdownViewerControls(windowEl);
  focusWindow(windowEl);

  try {
    const markdown = await loadMarkdownSource(node);
    const viewport = windowEl.querySelector('[data-markdown-viewport]');
    viewport.innerHTML = renderMarkdown(markdown);
  } catch (error) {
    const viewport = windowEl.querySelector('[data-markdown-viewport]');
    viewport.innerHTML = `<p>Failed to load markdown.</p><p><code>${error.message}</code></p>`;
  }
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

async function openNode(nodeId) {
  const existingWindow = openWindows.get(nodeId);
  if (existingWindow) {
    focusWindow(existingWindow);
    return;
  }

  const node = nodes[nodeId];
  if (!node) return;
  if (node.type === 'drawer') buildDrawerWindow(nodeId);
  if (node.type === 'file') buildFileWindow(nodeId);
  if (node.type === 'markdown') await buildMarkdownWindow(nodeId);
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
  brandLabel.textContent = data.desktop?.versionLabel;
  memoryLabel.textContent = data.desktop?.memoryLabel;
  renderDesktop(data.desktop?.rootIcons || []);
  await openNode('writing-file');
}

desktopSurface.addEventListener('click', async (event) => {
  const target = event.target.closest('.desktop-icon[data-target]');
  if (!target) return;
  await openNode(target.dataset.target);
});

desktop.addEventListener('click', async (event) => {
  const target = event.target.closest('.file-icon[data-target]');
  if (!target) return;
  await openNode(target.dataset.target);
});

init().catch((error) => {
  console.error('Failed to initialize desktop', error);
});
