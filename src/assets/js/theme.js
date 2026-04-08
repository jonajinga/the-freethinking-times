/**
 * The Freethinking Times — Theme System
 * Handles dark/light mode with no flash on load.
 * This script MUST be inlined in <head> to prevent FOUC.
 */

(function () {
  const STORAGE_KEY = (window.__PREFIX || 'tft') + '-theme';
  const root = document.documentElement;

  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function getStoredTheme() {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    root.classList.add('js-enabled');
  }

  // Apply theme immediately (before render)
  const stored = getStoredTheme();
  applyTheme(stored || getSystemTheme());

  // After DOM is ready, wire up the toggle button
  document.addEventListener('DOMContentLoaded', function () {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    function updateButton(theme) {
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }

    updateButton(root.getAttribute('data-theme'));

    btn.addEventListener('click', function () {
      const current = root.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
      updateButton(next);
    });

    // Respond to OS theme changes if no user preference is stored
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      if (!getStoredTheme()) {
        const theme = e.matches ? 'dark' : 'light';
        applyTheme(theme);
        updateButton(theme);
      }
    });
  });
})();
