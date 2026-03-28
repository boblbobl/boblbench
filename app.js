const desktop = document.getElementById('desktop');
const desktopSurface = document.getElementById('desktop-surface');
const windowTemplate = document.getElementById('window-template');

let topZ = 10;

const openWindows = new Map();
const windowState = new Map();

const nodes = {
  root: {
    type: 'drawer',
    title: 'Workbench',
    children: ['about-drawer', 'journal-drawer', 'projects-drawer'],
  },
  'about-drawer': {
    type: 'drawer',
    title: 'About',
    toolbar: ['Workbench', 'Open', 'Parent'],
    children: ['about-file', 'now-file'],
    defaultPosition: { left: 40, top: 52, width: 'min(29rem, 84vw)' },
  },
  'journal-drawer': {
    type: 'drawer',
    title: 'Journal',
    toolbar: ['Workbench', 'Entries'],
    children: ['bootlog-file', 'ideas-file'],
    defaultPosition: { left: 120, top: 100, width: 'min(29rem, 84vw)' },
  },
  'projects-drawer': {
    type: 'drawer',
    title: 'Projects',
    toolbar: ['Workbench', 'Experiments'],
    children: ['desktop-file', 'links-file', 'writing-file'],
    defaultPosition: { left: 220, top: 86, width: 'min(29rem, 84vw)' },
  },
  'about-file': {
    type: 'file',
    title: 'About.info',
    defaultPosition: { left: 86, top: 84, width: 'min(28rem, 82vw)' },
    body: `
      <div class="window__body copy-block">
        <p>boblbench is a personal site disguised as a tiny old computer.</p>
        <p>The idea is to browse thoughts and projects as drawers, disks, and files instead of a normal scrolling blog feed.</p>
      </div>
    `,
  },
  'now-file': {
    type: 'file',
    title: 'Now.readme',
    defaultPosition: { left: 150, top: 130, width: 'min(28rem, 82vw)' },
    body: `
      <div class="window__body copy-block">
        <p>Current mission: build a convincing Amiga Workbench-inspired shell using only HTML, CSS, and JavaScript.</p>
        <p>Short term goal: get the icon language and drawer hierarchy feeling right before adding real content.</p>
      </div>
    `,
  },
  'bootlog-file': {
    type: 'file',
    title: 'Bootlog.001',
    defaultPosition: { left: 190, top: 122, width: 'min(28rem, 82vw)' },
    body: `
      <div class="window__body copy-block">
        <p>Bootlog 001: static prototype established.</p>
        <p>Bootlog 002: visual language shifted toward Amiga Workbench 1.0.</p>
        <p>Bootlog 003: drawers and files now define the site structure.</p>
      </div>
    `,
  },
  'ideas-file': {
    type: 'file',
    title: 'Ideas.txt',
    defaultPosition: { left: 240, top: 160, width: 'min(28rem, 82vw)' },
    body: `
      <div class="window__body copy-block">
        <p>Possible future additions:</p>
        <p>- a startup chime and faux boot sequence</p>
        <p>- icons that can be selected before opening</p>
        <p>- a disk with archived years of writing</p>
      </div>
    `,
  },
  'desktop-file': {
    type: 'file',
    title: 'DesktopProject.doc',
    defaultPosition: { left: 260, top: 92, width: 'min(28rem, 82vw)' },
    body: `
      <div class="window__body copy-block">
        <p>The desktop itself is the project: a nostalgic interface that still works as a readable public website.</p>
      </div>
    `,
  },
  'links-file': {
    type: 'file',
    title: 'Links.info',
    defaultPosition: { left: 290, top: 136, width: 'min(28rem, 82vw)' },
    body: `
      <div class="window__body copy-block">
        <p>This can later become a curated set of internet shortcuts, references, and favorite corners of the web.</p>
      </div>
    `,
  },
  'writing-file': {
    type: 'file',
    title: 'Writing.readme',
    defaultPosition: { left: 320, top: 176, width: 'min(28rem, 82vw)' },
    body: `
      <div class="window__body copy-block">
        <p>Writing should probably live as files inside year/month drawers, so old posts feel archived instead of endlessly streamed.</p>
      </div>
    `,
  },
};

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

function makeIcon(nodeId) {
  const node = nodes[nodeId];
  const button = document.createElement('button');
  button.className = 'file-icon';
  button.dataset.target = nodeId;

  const art = document.createElement('span');
  art.className = `wb-icon wb-icon--${node.type === 'drawer' ? 'drawer' : 'file'}`;
  art.setAttribute('aria-hidden', 'true');

  if (node.type === 'drawer') {
    art.innerHTML = '<span class="wb-icon__lid"></span><span class="wb-icon__body"></span><span class="wb-icon__slot"></span>';
  } else {
    art.innerHTML = '<span class="wb-icon__sheet"></span><span class="wb-icon__fold"></span>';
  }

  const label = document.createElement('span');
  label.className = 'file-icon__label';
  label.textContent = node.title.replace(/\.(info|txt|doc|readme|001)$/i, '');

  button.append(art, label);
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
    if (event.target instanceof HTMLElement && event.target.closest('button')) return;

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
      ${(node.toolbar || ['Workbench']).map((item) => `<button class="toolbar-button">${item}</button>`).join('')}
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
}

desktopSurface.addEventListener('click', (event) => {
  const target = event.target.closest('[data-target]');
  if (!target) return;
  openNode(target.dataset.target);
});

desktop.addEventListener('click', (event) => {
  const target = event.target.closest('.file-icon[data-target]');
  if (!target) return;
  openNode(target.dataset.target);
});

openNode('about-drawer');
