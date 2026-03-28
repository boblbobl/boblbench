const windows = [...document.querySelectorAll('.window')];
const desktopIcons = [...document.querySelectorAll('.desktop-icon')];

let topZ = 10;

function focusWindow(windowEl) {
  topZ += 1;
  windows.forEach((item) => item.classList.remove('is-active'));
  windowEl.classList.add('is-active');
  windowEl.style.zIndex = String(topZ);
}

function openWindow(id) {
  const windowEl = document.getElementById(`window-${id}`);
  if (!windowEl) return;
  windowEl.hidden = false;
  focusWindow(windowEl);
}

desktopIcons.forEach((icon) => {
  icon.addEventListener('click', () => {
    openWindow(icon.dataset.window);
  });
});

windows.forEach((windowEl) => {
  windowEl.addEventListener('pointerdown', () => focusWindow(windowEl));

  const closeButton = windowEl.querySelector('[data-close]');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      windowEl.hidden = true;
    });
  }

  const handle = windowEl.querySelector('[data-drag-handle]');
  if (!handle) return;

  handle.addEventListener('pointerdown', (event) => {
    if (event.target instanceof HTMLElement && event.target.closest('button')) {
      return;
    }

    focusWindow(windowEl);

    const rect = windowEl.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    const move = (moveEvent) => {
      const maxLeft = window.innerWidth - rect.width;
      const maxTop = window.innerHeight - rect.height;
      const left = Math.min(Math.max(0, moveEvent.clientX - offsetX), Math.max(0, maxLeft));
      const top = Math.min(Math.max(2, moveEvent.clientY - offsetY), Math.max(2, maxTop));

      windowEl.style.left = `${left}px`;
      windowEl.style.top = `${top}px`;
    };

    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  });
});
