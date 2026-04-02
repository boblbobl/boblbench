import { renderMarkdown, attachMarkdownViewerControls } from './markdown-viewer.js';

const desktop = document.getElementById('desktop');
const desktopSurface = document.getElementById('desktop-surface');
const windowTemplate = document.getElementById('window-template');
const brandLabel = document.getElementById('brand-label');
const memoryLabel = document.getElementById('memory-label');

const SVG_ICON_ASSETS = {
  drawer: {
    closed: './static/icons/drawer-closed.svg',
    open: './static/icons/drawer-open.svg',
  },
  disk: {
    closed: './static/icons/disk-closed.svg',
    open: './static/icons/disk-open.svg',
  },
  trash: {
    closed: './static/icons/trash-closed.svg',
    open: './static/icons/trash-open.svg',
  },
  file: {
    closed: './static/icons/file.svg',
  },
};

const ICON_SIZE_PRESETS = {
  regular: { width: 42, height: 42 },
  wide: { width: 72, height: 42 },
  large: { width: 72, height: 72 },
};

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

function refreshIconStates() {
  document.querySelectorAll('[data-icon-node-id]').forEach((iconEl) => {
    const nodeId = iconEl.dataset.iconNodeId;
    const node = nodes[nodeId];
    if (!node) return;
    const isOpen = openWindows.has(nodeId);
    const iconType = getIconType(node);
    const svgImage = iconEl.querySelector('.wb-icon__svg-image');

    iconEl.classList.toggle('is-open', isOpen);

    if (svgImage) {
      svgImage.src = getSvgIconSource(iconType, isOpen);
      svgImage.alt = '';
    }
  });
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

function getIconType(node) {
  if (node.icon) return node.icon;
  if (node.type === 'drawer') return 'drawer';
  return 'file';
}

function getIconSize(node) {
  if (typeof node.iconSize === 'string' && ICON_SIZE_PRESETS[node.iconSize]) {
    return { name: node.iconSize, ...ICON_SIZE_PRESETS[node.iconSize] };
  }

  if (node.iconSize && typeof node.iconSize === 'object' && node.iconSize.width && node.iconSize.height) {
    return {
      name: 'custom',
      width: node.iconSize.width,
      height: node.iconSize.height,
    };
  }

  return { name: 'regular', ...ICON_SIZE_PRESETS.regular };
}

function getSvgIconSource(iconType, isOpen) {
  const iconAsset = SVG_ICON_ASSETS[iconType];
  if (!iconAsset) return '';
  if (isOpen && iconAsset.open) return iconAsset.open;
  return iconAsset.closed || '';
}

function iconMarkup(nodeId, iconType) {
  const node = nodes[nodeId];
  const svgSource = getSvgIconSource(iconType, openWindows.has(nodeId));
  const iconSize = getIconSize(node);

  if (svgSource) {
    return `<span class="wb-icon wb-icon--svg wb-icon--size-${iconSize.name}" data-icon-node-id="${nodeId}" style="--icon-width:${iconSize.width}px; --icon-height:${iconSize.height}px;" aria-hidden="true"><img class="wb-icon__svg-image" src="${svgSource}" alt="" /></span>`;
  }

  return `<span class="wb-icon wb-icon--file wb-icon--size-${iconSize.name}" style="--icon-width:${iconSize.width}px; --icon-height:${iconSize.height}px;" aria-hidden="true"><span class="wb-icon__sheet"></span><span class="wb-icon__fold"></span></span>`;
}

function labelFromTitle(title) {
  return title.replace(/\.(info|txt|doc|readme|md|001)$/i, '');
}

function makeIcon(nodeId, className = 'file-icon') {
  const node = nodes[nodeId];
  const button = document.createElement('button');
  button.className = className;
  button.dataset.target = nodeId;
  button.innerHTML = `${iconMarkup(nodeId, getIconType(node))}<span class="${className}__label">${labelFromTitle(node.title)}</span>`;
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
      refreshIconStates();
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
  refreshIconStates();
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
  refreshIconStates();

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
  refreshIconStates();
}

async function openNode(nodeId) {
  const existingWindow = openWindows.get(nodeId);
  if (existingWindow) {
    focusWindow(existingWindow);
    refreshIconStates();
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
  refreshIconStates();
}

async function init() {
  const response = await fetch('./content/data.json');
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
