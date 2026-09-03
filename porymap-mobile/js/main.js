import { App } from './ui.js';

const app = new App();
window.porymap = app;

// Restore whatever was open last time; fall back to the empty state.
app.restoreSession().catch((err) => console.warn('Kunde inte återställa sessionen', err));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker misslyckades', err));
  });
}

// iOS zooms the page on a double tap unless we say otherwise.
let lastTouch = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouch < 320 && e.cancelable) e.preventDefault();
  lastTouch = now;
}, { passive: false });

document.addEventListener('gesturestart', (e) => e.preventDefault());
