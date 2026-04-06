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
  eyes: {
    closed: './static/icons/eyes.svg',
  },
  mine: {
    closed: './static/icons/mine.svg',
  },
};

const ICON_SIZE_PRESETS = {
  regular: { width: 42, height: 42 },
  wide: { width: 72, height: 42 },
  large: { width: 72, height: 72 },
};

let topZ = 10;

const openWindows = new Map();
const eyeState = {
  pointerX: window.innerWidth * 0.5,
  pointerY: window.innerHeight * 0.5,
};
const googlyEyesBindings = new Map();
let googlyEyesFrame = null;
const windowState = new Map();
let nodes = {};

function randomBlinkDelay() {
  return 1400 + Math.random() * 2600;
}

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
      unbindGooglyEyes(nodeId);
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
  const toolbarItems = Array.isArray(node.toolbar) ? node.toolbar : [];

  title.textContent = node.title;
  content.innerHTML = `
    ${toolbarItems.length ? `<div class="window__toolbar">
      ${toolbarItems.map((item) => `<button class="toolbar-button" type="button">${item}</button>`).join('')}
    </div>` : ''}
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

function googlyEyesMarkup() {
  return `
    <div class="googly-eyes" data-googly-eyes aria-hidden="true">
      <div class="googly-eyes__eye" data-eye>
        <div class="googly-eyes__pupil" data-pupil></div>
      </div>
      <div class="googly-eyes__eye" data-eye>
        <div class="googly-eyes__pupil" data-pupil></div>
      </div>
    </div>
  `;
}

function createMinesweeperGame(rows = 8, cols = 8, mines = 10) {
  const totalCells = rows * cols;

  const board = Array.from({ length: totalCells }, (_, index) => ({
    index,
    isMine: false,
    isRevealed: false,
    isFlagged: false,
    adjacent: 0,
  }));

  const neighborsFor = (index) => {
    const x = index % cols;
    const y = Math.floor(index / cols);
    const neighbors = [];

    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        neighbors.push(ny * cols + nx);
      }
    }

    return neighbors;
  };

  return {
    rows,
    cols,
    mines,
    board,
    state: 'playing',
    revealedCount: 0,
    flagsUsed: 0,
    elapsedSeconds: 0,
    timerId: null,
    isPressing: false,
    hasPlacedMines: false,
    neighborsFor,
  };
}

function placeMinesweeperMines(game, safeIndex) {
  const blocked = new Set([safeIndex]);
  const available = game.board.filter((cell) => !blocked.has(cell.index)).map((cell) => cell.index);

  for (let i = available.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }

  available.slice(0, game.mines).forEach((index) => {
    game.board[index].isMine = true;
  });

  game.board.forEach((cell) => {
    if (cell.isMine) {
      cell.adjacent = 0;
      return;
    }
    cell.adjacent = game.neighborsFor(cell.index).filter((neighborIndex) => game.board[neighborIndex].isMine).length;
  });

  game.hasPlacedMines = true;
}

function getMinesweeperFace(game) {
  if (game.state === 'won') return '😎';
  if (game.state === 'lost') return '☠';
  if (game.isPressing) return '😮';
  return '🙂';
}

function renderMinesweeper(container, game) {
  const boardEl = container.querySelector('[data-mines-board]');
  const faceButton = container.querySelector('[data-mines-face]');
  const mineCounter = container.querySelector('[data-mines-counter]');
  const timerEl = container.querySelector('[data-mines-timer]');
  const minesLeft = Math.max(0, game.mines - game.flagsUsed);

  if (faceButton) faceButton.textContent = getMinesweeperFace(game);
  if (mineCounter) mineCounter.textContent = String(minesLeft).padStart(3, '0');
  if (timerEl) timerEl.textContent = String(game.elapsedSeconds).padStart(3, '0');

  boardEl.innerHTML = '';

  game.board.forEach((cell) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'minesweeper__cell';
    button.dataset.index = String(cell.index);

    if (cell.isRevealed) {
      button.classList.add('is-revealed');
      if (cell.isMine) {
        button.classList.add('is-mine');
        button.innerHTML = minesweeperMineIcon();
      } else if (cell.adjacent > 0) {
        button.classList.add(`minesweeper__cell--${cell.adjacent}`);
        button.textContent = String(cell.adjacent);
      }
    } else if (cell.isFlagged) {
      button.classList.add('is-flagged');
      button.innerHTML = minesweeperFlagIcon();
    }

    if (game.state !== 'playing') {
      button.disabled = true;
    }

    boardEl.appendChild(button);
  });
}

function revealMinesweeperCell(game, index) {
  const cell = game.board[index];
  if (!cell || cell.isRevealed || cell.isFlagged || game.state !== 'playing') return;

  if (!game.hasPlacedMines) {
    placeMinesweeperMines(game, index);
  }

  cell.isRevealed = true;
  game.revealedCount += 1;

  if (cell.isMine) {
    game.state = 'lost';
    game.board.forEach((item) => {
      if (item.isMine) item.isRevealed = true;
    });
    return;
  }

  if (cell.adjacent === 0) {
    game.neighborsFor(index).forEach((neighborIndex) => revealMinesweeperCell(game, neighborIndex));
  }

  const safeCells = game.rows * game.cols - game.mines;
  if (game.revealedCount >= safeCells) {
    game.state = 'won';
  }
}

function toggleMinesweeperFlag(game, index) {
  const cell = game.board[index];
  if (!cell || cell.isRevealed || game.state !== 'playing') return;
  cell.isFlagged = !cell.isFlagged;
  game.flagsUsed += cell.isFlagged ? 1 : -1;
}

function startMinesweeperTimer(game, rerender) {
  if (game.timerId !== null) return;
  game.timerId = window.setInterval(() => {
    game.elapsedSeconds += 1;
    rerender();
  }, 1000);
}

function stopMinesweeperTimer(game) {
  if (game.timerId !== null) {
    window.clearInterval(game.timerId);
    game.timerId = null;
  }
}

function minesweeperMarkup() {
  return `
    <div class="minesweeper" data-minesweeper>
      <div class="minesweeper__scorebar">
        <div class="minesweeper__counter" data-mines-counter>010</div>
        <button class="minesweeper__face" type="button" data-mines-face aria-label="Reset game">🙂</button>
        <div class="minesweeper__counter" data-mines-timer>000</div>
      </div>
      <div class="minesweeper__board" data-mines-board></div>
    </div>
  `;
}

function minesweeperMineIcon() {
  return '<img class="minesweeper__symbol minesweeper__symbol--mine" src="./static/icons/mine.svg" alt="Mine" />';
}

function minesweeperFlagIcon() {
  return '<img class="minesweeper__symbol minesweeper__symbol--flag" src="./static/icons/red-flag.svg" alt="Flag" />';
}

function bindMinesweeper(nodeId, windowEl) {
  const container = windowEl.querySelector('[data-minesweeper]');
  if (!container) return;

  let game = createMinesweeperGame();
  const boardEl = container.querySelector('[data-mines-board]');
  const resetButton = windowEl.querySelector('[data-mines-reset]');
  const faceButton = container.querySelector('[data-mines-face]');

  const rerender = () => {
    if (game.state !== 'playing') {
      stopMinesweeperTimer(game);
      game.isPressing = false;
    }
    renderMinesweeper(container, game);
  };

  const resetGame = () => {
    stopMinesweeperTimer(game);
    game = createMinesweeperGame();
    rerender();
  };

  boardEl.addEventListener('pointerdown', (event) => {
    const cellButton = event.target.closest('.minesweeper__cell[data-index]');
    if (!cellButton || game.state !== 'playing') return;
    game.isPressing = true;

    const currentFace = container.querySelector('[data-mines-face]');
    if (currentFace) currentFace.textContent = getMinesweeperFace(game);
  });

  boardEl.addEventListener('pointerup', () => {
    if (game.state === 'playing') {
      game.isPressing = false;
      const currentFace = container.querySelector('[data-mines-face]');
      if (currentFace) currentFace.textContent = getMinesweeperFace(game);
    }
  });

  boardEl.addEventListener('pointerleave', () => {
    if (game.state === 'playing') {
      game.isPressing = false;
      rerender();
    }
  });

  boardEl.addEventListener('click', (event) => {
    const cellButton = event.target.closest('.minesweeper__cell[data-index]');
    if (!cellButton) {
      rerender();
      return;
    }

    if (!game.hasPlacedMines) {
      startMinesweeperTimer(game, rerender);
    }

    revealMinesweeperCell(game, Number(cellButton.dataset.index));
    rerender();
  });

  boardEl.addEventListener('contextmenu', (event) => {
    const cellButton = event.target.closest('.minesweeper__cell[data-index]');
    if (!cellButton) return;
    event.preventDefault();
    toggleMinesweeperFlag(game, Number(cellButton.dataset.index));
    rerender();
  });

  if (resetButton) {
    resetButton.addEventListener('click', resetGame);
  }

  if (faceButton) {
    faceButton.addEventListener('click', resetGame);
  }

  rerender();
}

function renderGooglyEyesBinding(binding) {
  binding.eyes.forEach((eyeEl) => {
    const pupil = eyeEl.querySelector('[data-pupil]');
    if (!pupil) return;

    const rect = eyeEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = eyeState.pointerX - centerX;
    const dy = eyeState.pointerY - centerY;
    const angle = Math.atan2(dy, dx);
    const maxRadius = rect.width * 0.22;
    const distance = Math.min(maxRadius, Math.hypot(dx, dy) * 0.18);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    pupil.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  });
}

function queueGooglyEyesRender() {
  if (googlyEyesFrame !== null) return;

  googlyEyesFrame = window.requestAnimationFrame(() => {
    googlyEyesFrame = null;
    googlyEyesBindings.forEach((binding) => {
      if (!binding.container.isConnected) {
        googlyEyesBindings.delete(binding.nodeId);
        return;
      }
      renderGooglyEyesBinding(binding);
    });
  });
}

function scheduleGooglyBlink(binding) {
  binding.blinkTimeout = window.setTimeout(() => {
    if (!binding.container.isConnected) return;

    binding.eyes.forEach((eyeEl, index) => {
      window.setTimeout(() => {
        eyeEl.classList.add('is-blinking');
      }, index * 35);
    });

    binding.unblinkTimeout = window.setTimeout(() => {
      binding.eyes.forEach((eyeEl) => eyeEl.classList.remove('is-blinking'));
      scheduleGooglyBlink(binding);
    }, 140);
  }, randomBlinkDelay());
}

function bindGooglyEyes(nodeId, container) {
  const eyes = [...container.querySelectorAll('[data-eye]')];
  if (!eyes.length) return;

  const binding = {
    nodeId,
    container,
    eyes,
    blinkTimeout: null,
    unblinkTimeout: null,
  };

  googlyEyesBindings.set(nodeId, binding);
  scheduleGooglyBlink(binding);
  queueGooglyEyesRender();
}

function unbindGooglyEyes(nodeId) {
  const binding = googlyEyesBindings.get(nodeId);
  if (binding) {
    if (binding.blinkTimeout) window.clearTimeout(binding.blinkTimeout);
    if (binding.unblinkTimeout) window.clearTimeout(binding.unblinkTimeout);
  }
  googlyEyesBindings.delete(nodeId);
}

function initGooglyEyesTracking() {
  window.addEventListener('pointermove', (event) => {
    eyeState.pointerX = event.clientX;
    eyeState.pointerY = event.clientY;
    queueGooglyEyesRender();
  }, { passive: true });

  window.addEventListener('resize', queueGooglyEyesRender);
}

function buildExperienceWindow(nodeId) {
  const node = nodes[nodeId];
  const fragment = windowTemplate.content.cloneNode(true);
  const windowEl = fragment.querySelector('.window');
  const title = fragment.querySelector('.window__titletext');
  const content = fragment.querySelector('.window__content');

  title.textContent = node.title;

  if (node.experience === 'googly-eyes') {
    content.innerHTML = `
      <div class="window__body">${googlyEyesMarkup()}</div>
    `;
  }

  if (node.experience === 'minesweeper-lite') {
    content.innerHTML = `
      <div class="window__toolbar">
        <button class="toolbar-button" type="button" data-mines-reset>Reset</button>
      </div>
      <div class="window__body window__body--panel">${minesweeperMarkup()}</div>
    `;
  }

  applyWindowPlacement(nodeId, windowEl);
  desktop.appendChild(windowEl);
  openWindows.set(nodeId, windowEl);
  bindWindow(nodeId, windowEl);
  focusWindow(windowEl);
  refreshIconStates();

  if (node.experience === 'googly-eyes') {
    bindGooglyEyes(nodeId, windowEl);
  }

  if (node.experience === 'minesweeper-lite') {
    bindMinesweeper(nodeId, windowEl);
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
  if (node.type === 'experience') buildExperienceWindow(nodeId);
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
  initGooglyEyesTracking();
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
