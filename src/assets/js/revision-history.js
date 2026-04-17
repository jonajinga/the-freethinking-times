/**
 * Revision history viewer — fetches GitHub commits for the current article.
 *
 * Renders a panel with a timeline of commits affecting this article's .md file.
 * Works entirely client-side against the public GitHub API (no auth; rate-limited
 * to 60 requests/hour for unauthenticated users).
 *
 * Activation: a button with id="revision-history-btn" and data-source-path
 * attribute pointing to the source .md file (relative to repo root).
 * Repo is configured via window.__repo = { owner, name, branch }.
 */
(function () {
  'use strict';

  var btn = document.getElementById('revision-history-btn');
  if (!btn) return;

  var repo = window.__repo;
  if (!repo || !repo.owner || !repo.name) {
    btn.hidden = true;
    return;
  }

  var sourcePath = btn.getAttribute('data-source-path');
  if (!sourcePath) return;
  // Normalize ./src/... → src/...
  sourcePath = sourcePath.replace(/^\.\//, '');

  var panel = null;
  var loaded = false;

  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  function formatDate(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return iso; }
  }

  function render(commits, err) {
    var url = 'https://github.com/' + repo.owner + '/' + repo.name + '/commits/' + (repo.branch || 'main') + '/' + sourcePath;
    var html = '<header class="rh-header">' +
      '<h2 class="rh-title">Revision History</h2>' +
      '<button type="button" class="rh-close" aria-label="Close">&times;</button>' +
      '</header>';

    if (err) {
      html += '<p class="rh-empty">' + esc(err) + '</p>' +
        '<p class="rh-empty"><a href="' + url + '" target="_blank" rel="noopener">View on GitHub &nearr;</a></p>';
    } else if (!commits.length) {
      html += '<p class="rh-empty">No commits found for this article.</p>';
    } else {
      html += '<ol class="rh-list">';
      commits.forEach(function (c) {
        var msg = (c.commit.message || '').split('\n')[0];
        var author = c.author ? c.author.login : (c.commit.author && c.commit.author.name) || 'Unknown';
        var avatar = c.author && c.author.avatar_url;
        var sha = c.sha.substring(0, 7);
        html += '<li class="rh-item">' +
          '<div class="rh-item__meta">' +
            (avatar ? '<img class="rh-avatar" src="' + esc(avatar) + '&s=32" alt="" width="20" height="20">' : '') +
            '<span class="rh-author">' + esc(author) + '</span>' +
            '<span class="rh-date">' + formatDate(c.commit.author && c.commit.author.date) + '</span>' +
          '</div>' +
          '<div class="rh-message">' + esc(msg) + '</div>' +
          '<a class="rh-sha" href="' + esc(c.html_url) + '" target="_blank" rel="noopener">' + sha + ' &nearr;</a>' +
        '</li>';
      });
      html += '</ol>';
      html += '<p class="rh-empty"><a href="' + url + '" target="_blank" rel="noopener">Full history on GitHub &nearr;</a></p>';
    }

    panel.innerHTML = html;
    panel.querySelector('.rh-close').addEventListener('click', close);
  }

  function open() {
    if (!panel) {
      panel = document.createElement('aside');
      panel.className = 'rh-panel';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'Revision history');
      document.body.appendChild(panel);
    }
    panel.hidden = false;
    document.addEventListener('keydown', onKey);

    if (loaded) return;
    panel.innerHTML = '<header class="rh-header"><h2 class="rh-title">Revision History</h2><button type="button" class="rh-close" aria-label="Close">&times;</button></header><p class="rh-empty">Loading commits from GitHub&hellip;</p>';
    panel.querySelector('.rh-close').addEventListener('click', close);

    var api = 'https://api.github.com/repos/' + repo.owner + '/' + repo.name + '/commits?path=' + encodeURIComponent(sourcePath) + '&per_page=50';
    fetch(api, { headers: { 'Accept': 'application/vnd.github+json' } })
      .then(function (r) {
        if (r.status === 403) throw new Error('GitHub API rate limit reached. Try again in an hour.');
        if (r.status === 404) throw new Error('This repository is private, so the revision history cannot be loaded without authentication. Ask the publication to make the source repository public, or view the commit log locally.');
        if (!r.ok) throw new Error('Could not load commit history (HTTP ' + r.status + ').');
        return r.json();
      })
      .then(function (data) { loaded = true; render(data || []); })
      .catch(function (e) { render([], e.message); });
  }

  function close() {
    if (panel) panel.hidden = true;
    document.removeEventListener('keydown', onKey);
  }

  function onKey(e) { if (e.key === 'Escape') close(); }

  btn.addEventListener('click', open);
})();
