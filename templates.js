// ═══ HTML Templates & Modals ═══
// Ensure app.js helpers are available
if (typeof $ === 'undefined') {
  console.warn('templates.js: $ helper not yet available, will be available after app.js loads');
}

// ══════════════════════════════════════════════════════════
//  REPORTS & SETTINGS — Full JS
// ══════════════════════════════════════════════════════════

// ── USER PROFILE ──────────────────────────────────────────
const PROFILE_KEY = 'et-user-profile';
const SETTINGS_KEY = 'et-settings';
const PUBLIC_USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

let _publicProfileSyncTimer = null;
let _publicTraderChart = null;

const AVATAR_EMOJIS = ['🦅','🦁','🐉','🔥','⚡','🎯','💎','🚀','🦊','🐺','🦋','🌊','🗡️','🛡️','🎪','🌟','🏹','🎭','🦄','🐻','🦈','🐅','🦅','⚔️','🧠','🎲','🃏','👑'];

function escapePublicHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizePublicUsernameInput(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24);
}

function getAppBaseUrl() {
  if (window.location.origin && window.location.origin !== 'null') return window.location.origin;
  return 'https://equitytrace.com';
}

function buildPublicProfileUrl(username) {
  const normalized = normalizePublicUsernameInput(username);
  if (!normalized) return '';
  return getAppBaseUrl().replace(/\/$/, '') + '/trader/' + normalized;
}

function getPublicTraderRouteUsername() {
  try {
    const params = new URLSearchParams(window.location.search || '');
    const queryTrader = normalizePublicUsernameInput(params.get('trader') || '');
    if (queryTrader) return queryTrader;
  } catch (e) {}

  const parts = (window.location.pathname || '')
    .split('/')
    .filter(Boolean);
  const traderIndex = parts.findIndex(part => part.toLowerCase() === 'trader');
  if (traderIndex === -1) return '';
  return normalizePublicUsernameInput(parts[traderIndex + 1] || '');
}

window.isPublicTraderRoute = function() {
  return !!getPublicTraderRouteUsername();
};

function getPublicShareStats(trades) {
  const rows = Array.isArray(trades) ? trades.filter(Boolean) : [];
  const totalTrades = rows.length;
  const wins = rows.filter(t => Number(t.pnl) > 0).length;
  const winRate = totalTrades ? ((wins / totalTrades) * 100).toFixed(1) : '0.0';
  const bestModelMap = new Map();

  rows.forEach(trade => {
    const name = String(trade.model || '').trim() || 'Unlabeled';
    const current = bestModelMap.get(name) || { name, trades: 0, wins: 0, pnl: 0 };
    current.trades += 1;
    if (Number(trade.pnl) > 0) current.wins += 1;
    current.pnl += Number(trade.pnl) || 0;
    bestModelMap.set(name, current);
  });

  const bestModel = Array.from(bestModelMap.values())
    .sort((left, right) => (right.pnl - left.pnl) || (right.trades - left.trades) || left.name.localeCompare(right.name))[0] || null;

  return {
    totalTrades,
    winRate,
    bestModel: bestModel ? bestModel.name : 'No models yet',
    netPnl: rows.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0),
  };
}

function buildPublicShareCardText(profile, stats, url) {
  const displayName = (profile?.name || 'Trader').trim() || 'Trader';
  return [
    displayName,
    'Winrate: ' + stats.winRate + '%',
    'Trades: ' + stats.totalTrades,
    'Best model: ' + stats.bestModel,
    url || ''
  ].filter(Boolean).join('\n');
}

function updatePublicShareUI(profile) {
  const currentProfile = profile || loadProfile();
  const username = normalizePublicUsernameInput(currentProfile.publicUsername || currentProfile.handle || '');
  const stats = getPublicShareStats(window.TRADES || []);
  const publicUrl = buildPublicProfileUrl(username);
  const isPublic = !!currentProfile.isPublic;
  const hasValidUsername = PUBLIC_USERNAME_PATTERN.test(username);

  if ($('prof-public-username')) $('prof-public-username').value = username;
  if ($('public-url-inline')) $('public-url-inline').textContent = hasValidUsername ? '/trader/' + username : '/trader/username';
  if ($('public-profile-url')) $('public-profile-url').textContent = hasValidUsername ? publicUrl : 'Set a public username to create a share link';
  if ($('public-share-name')) $('public-share-name').textContent = currentProfile.name || 'Trader';
  if ($('public-share-winrate')) $('public-share-winrate').textContent = 'Winrate: ' + stats.winRate + '%';
  if ($('public-share-trades')) $('public-share-trades').textContent = 'Trades: ' + stats.totalTrades;
  if ($('public-share-best-model')) $('public-share-best-model').textContent = 'Best model: ' + stats.bestModel;

  const toggle = $('prof-public-toggle');
  if (toggle) toggle.setAttribute('data-on', isPublic ? 'true' : 'false');

  const status = $('public-share-status');
  if (status) {
    if (!username) status.textContent = 'Add a username to activate sharing';
    else if (!hasValidUsername) status.textContent = 'Username must be 3-24 chars: a-z, 0-9, _';
    else status.textContent = isPublic ? 'Public and ready to share' : 'Private until you turn sharing on';
    status.style.color = isPublic && hasValidUsername ? 'var(--green)' : 'var(--text3)';
  }
}

function mergeRemotePublicProfileIntoLocal(remoteProfile) {
  if (!remoteProfile) return loadProfile();
  const current = loadProfile();
  const merged = {
    ...current,
    publicUsername: remoteProfile.publicUsername || current.publicUsername || normalizePublicUsernameInput(current.handle || ''),
    bio: typeof remoteProfile.bio === 'string' ? remoteProfile.bio : (current.bio || ''),
    isPublic: typeof remoteProfile.isPublic === 'boolean' ? remoteProfile.isPublic : !!current.isPublic,
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
  return merged;
}

window.mergeRemotePublicProfileIntoLocal = mergeRemotePublicProfileIntoLocal;

function schedulePublicProfileSync(profile) {
  clearTimeout(_publicProfileSyncTimer);
  _publicProfileSyncTimer = setTimeout(async () => {
    if (!window.SB || typeof window.SB.savePublicProfile !== 'function') return;
    try {
      const user = await window.SB.getUser();
      if (!user) return;
      await window.SB.savePublicProfile(profile);
    } catch (error) {
      console.warn('Public profile sync failed:', error);
      if (typeof showToast === 'function' && error?.message) {
        showToast(error.message, 'error', '', 2200);
      }
    }
  }, 500);
}

function copyTextToClipboard(text, successMessage) {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      if (typeof showToast === 'function' && successMessage) showToast(successMessage, 'success', '', 1800);
    }).catch(() => {
      if (typeof showToast === 'function') showToast('Copy failed', 'error', '', 1800);
    });
    return;
  }
  const temp = document.createElement('textarea');
  temp.value = text;
  document.body.appendChild(temp);
  temp.select();
  document.execCommand('copy');
  document.body.removeChild(temp);
  if (typeof showToast === 'function' && successMessage) showToast(successMessage, 'success', '', 1800);
}

function togglePublicProfileSetting(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const toggle = $('prof-public-toggle');
  if (!toggle) return;
  const nextValue = toggle.getAttribute('data-on') !== 'true';
  toggle.setAttribute('data-on', nextValue ? 'true' : 'false');
  saveProfile();
}

function copyPublicProfileLink() {
  const profile = loadProfile();
  const url = buildPublicProfileUrl(profile.publicUsername || profile.handle || '');
  if (!url) {
    if (typeof showToast === 'function') showToast('Set a public username first', 'error', '', 1800);
    return;
  }
  copyTextToClipboard(url, 'Public profile link copied');
}

function openPublicProfilePage() {
  const profile = loadProfile();
  const url = buildPublicProfileUrl(profile.publicUsername || profile.handle || '');
  if (!url) {
    if (typeof showToast === 'function') showToast('Set a public username first', 'error', '', 1800);
    return;
  }
  window.open(url, '_blank', 'noopener');
}

function copyPublicShareCard() {
  const profile = loadProfile();
  const stats = getPublicShareStats(window.TRADES || []);
  const url = buildPublicProfileUrl(profile.publicUsername || profile.handle || '');
  copyTextToClipboard(buildPublicShareCardText(profile, stats, url), 'Share card copied');
}

function sharePublicProfile(platform) {
  const profile = loadProfile();
  const stats = getPublicShareStats(window.TRADES || []);
  const url = buildPublicProfileUrl(profile.publicUsername || profile.handle || '');
  if (!url) {
    if (typeof showToast === 'function') showToast('Set a public username first', 'error', '', 1800);
    return;
  }

  const text = buildPublicShareCardText(profile, stats, url);

  if (platform === 'twitter') {
    window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text), '_blank', 'noopener');
    return;
  }

  if (platform === 'discord') {
    copyTextToClipboard(text, 'Discord share text copied');
    return;
  }

  if (platform === 'native' && navigator.share) {
    navigator.share({
      title: (profile.name || 'Trader') + ' on Equity Trace',
      text,
      url,
    }).catch(() => {});
    return;
  }

  copyTextToClipboard(text, 'Share text copied');
}

function formatPublicCurrency(value) {
  const amount = Number(value) || 0;
  return (amount >= 0 ? '+$' : '-$') + Math.abs(amount).toFixed(2);
}

function renderPublicTraderChart(points) {
  const canvas = $('public-trader-chart');
  if (!canvas || typeof Chart === 'undefined') return;
  if (_publicTraderChart) {
    _publicTraderChart.destroy();
    _publicTraderChart = null;
  }

  _publicTraderChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: points.map(point => point.date),
      datasets: [{
        data: points.map(point => Number(point.value) || 0),
        borderColor: '#995dff',
        backgroundColor: 'rgba(153,93,255,0.18)',
        borderWidth: 2.5,
        tension: 0.3,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: { color: '#8d97b6', maxTicksLimit: 6 },
          grid: { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          ticks: {
            color: '#8d97b6',
            callback: value => '$' + Number(value).toFixed(0),
          },
          grid: { color: 'rgba(255,255,255,0.05)' },
        }
      }
    }
  });
}

function renderPublicTraderPage(payload) {
  const profile = payload?.profile || {};
  const summary = payload?.summary || {};
  const bestModel = summary.best_model?.name || 'No models yet';
  const displayName = profile.display_name || profile.username || 'Trader';
  const username = profile.username || getPublicTraderRouteUsername();
  const shareTextProfile = { name: displayName };
  const shareStats = {
    winRate: Number(summary.win_rate || 0).toFixed(1),
    totalTrades: Number(summary.total_trades || 0),
    bestModel,
  };
  const shareUrl = buildPublicProfileUrl(username);

  if ($('public-trader-route-label')) $('public-trader-route-label').textContent = '/trader/' + username;
  if ($('public-trader-name')) $('public-trader-name').textContent = displayName;
  if ($('public-trader-handle')) $('public-trader-handle').textContent = '@' + username;
  if ($('public-trader-bio')) $('public-trader-bio').textContent = profile.bio || 'No bio yet.';
  if ($('public-trader-winrate')) $('public-trader-winrate').textContent = Number(summary.win_rate || 0).toFixed(1) + '%';
  if ($('public-trader-trades')) $('public-trader-trades').textContent = Number(summary.total_trades || 0);
  if ($('public-trader-netpnl')) $('public-trader-netpnl').textContent = formatPublicCurrency(summary.net_pnl || 0);
  if ($('public-trader-best-model')) $('public-trader-best-model').textContent = bestModel;

  if ($('public-trader-card-name')) $('public-trader-card-name').textContent = displayName;
  if ($('public-trader-card-winrate')) $('public-trader-card-winrate').textContent = 'Winrate: ' + shareStats.winRate + '%';
  if ($('public-trader-card-trades')) $('public-trader-card-trades').textContent = 'Trades: ' + shareStats.totalTrades;
  if ($('public-trader-card-best-model')) $('public-trader-card-best-model').textContent = 'Best model: ' + bestModel;

  if ($('public-trader-models')) {
    const models = Array.isArray(payload.models) ? payload.models : [];
    $('public-trader-models').innerHTML = models.length
      ? models.map(model => `
          <div class="public-trader-list-item">
            <div class="public-trader-list-head">
              <div class="public-trader-list-title">${escapePublicHtml(model.name)}</div>
              <div class="public-trader-pill">${Number(model.win_rate || 0).toFixed(1)}% WR</div>
            </div>
            <div class="public-trader-list-meta">${Number(model.trades || 0)} trades · ${formatPublicCurrency(model.net_pnl || 0)}</div>
          </div>
        `).join('')
      : '<div class="public-trader-list-item"><div class="public-trader-list-title">No models shared yet</div></div>';
  }

  if ($('public-trader-trades-list')) {
    const trades = Array.isArray(payload.recent_trades) ? payload.recent_trades : [];
    $('public-trader-trades-list').innerHTML = trades.length
      ? trades.map(trade => `
          <div class="public-trader-list-item">
            <div class="public-trader-list-head">
              <div class="public-trader-list-title">${escapePublicHtml(trade.symbol || 'Unknown')}</div>
              <div class="public-trader-pill">${escapePublicHtml(String(trade.dir || '').toUpperCase() || 'N/A')}</div>
            </div>
            <div class="public-trader-list-meta">${escapePublicHtml(trade.date || '')} · ${escapePublicHtml(trade.model || 'Unlabeled')} · ${formatPublicCurrency(trade.pnl || 0)}</div>
          </div>
        `).join('')
      : '<div class="public-trader-list-item"><div class="public-trader-list-title">No recent trades shared yet</div></div>';
  }

  renderPublicTraderChart(Array.isArray(payload.equity_curve) ? payload.equity_curve : []);

  const activePage = $('public-trader-page');
  if (activePage) activePage.dataset.shareText = buildPublicShareCardText(shareTextProfile, shareStats, shareUrl);
}

function setPublicTraderView(mode, message) {
  if ($('public-trader-loading')) $('public-trader-loading').style.display = mode === 'loading' ? '' : 'none';
  if ($('public-trader-empty')) {
    $('public-trader-empty').style.display = mode === 'empty' ? '' : 'none';
    if (message) $('public-trader-empty').textContent = message;
  }
  if ($('public-trader-content')) $('public-trader-content').style.display = mode === 'ready' ? '' : 'none';
}

function preparePublicTraderShell() {
  const page = $('public-trader-page');
  if (page) page.style.display = 'block';
  const landing = $('landing-screen');
  if (landing) landing.style.display = 'none';
  const auth = $('auth-overlay');
  if (auth) auth.style.display = 'none';
  const authBadge = $('auth-user-badge');
  if (authBadge) authBadge.style.display = 'none';
  const sidebar = document.querySelector('nav.sidebar');
  const main = document.querySelector('main.main');
  if (sidebar) sidebar.style.display = 'none';
  if (main) main.style.display = 'none';
}

async function initPublicTraderRoute() {
  const username = getPublicTraderRouteUsername();
  if (!username) return;

  preparePublicTraderShell();
  setPublicTraderView('loading', 'Loading trader page...');

  if (!window.SB || typeof window.SB.getPublicTraderStats !== 'function') {
    setPublicTraderView('empty', 'Public trader pages need a live Supabase backend.');
    return;
  }

  try {
    const payload = await window.SB.getPublicTraderStats(username);
    if (!payload || !payload.profile) {
      setPublicTraderView('empty', 'Trader page not found or still private.');
      return;
    }
    renderPublicTraderPage(payload);
    setPublicTraderView('ready');
    window.scrollTo({ top: 0, behavior: 'instant' });
  } catch (error) {
    console.error('Public trader route error:', error);
    setPublicTraderView('empty', 'Unable to load this trader page right now.');
  }
}

function copyActivePublicTraderLink() {
  if (window.isPublicTraderRoute && window.isPublicTraderRoute()) {
    copyTextToClipboard(window.location.href, 'Public link copied');
    return;
  }
  copyPublicProfileLink();
}

function goToPublicHome() {
  window.location.href = 'index.html';
}

function loadProfile() {
  // IMPORTANT: Clear any old hardcoded profile data on first load
  const migrationKey = 'profile_v3_cleaned';
  if (!localStorage.getItem(migrationKey)) {
    // First time after cleanup - clear old demo profile
    const stored = localStorage.getItem(PROFILE_KEY);
    if (stored) {
      try {
        const profile = JSON.parse(stored);
        // If any of the old demo profile data exists, wipe it
        const oldDemoNames = ['TOM', 'Tom', 'Batman'];
        const oldDemoHandles = ['TheReal_Tom', 'thereal_tom'];
        const oldDemoStyles = ['Day Trader', 'Swing Trader'];
        
        if ((oldDemoNames.includes(profile.name)) || 
            (oldDemoHandles.includes(profile.handle)) ||
            (oldDemoStyles.includes(profile.style))) {
          console.warn('Old demo profile detected - clearing cache...');
          localStorage.removeItem(PROFILE_KEY);
          localStorage.removeItem(AVATAR_PHOTO_KEY);
          localStorage.removeItem(migrationKey);
          return {};
        }
      } catch(e) {}
    }
    localStorage.setItem(migrationKey, '1');
  }
  
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}'); } catch(e) { return {}; }
}

// ── CUSTOM CONFIRM MODAL ──────────────────────────────
let _confirmModalCallback = null;

function showConfirmModal(title, body, okLabel, cancelLabel, type, callback) {
  const modal = document.getElementById('confirm-modal');
  const titleEl = document.getElementById('confirm-modal-title');
  const bodyEl = document.getElementById('confirm-modal-body');
  const okBtn = document.getElementById('confirm-modal-ok');
  const cancelBtn = document.getElementById('confirm-modal-cancel');
  if (!modal) return;
  titleEl.textContent = title;
  bodyEl.innerHTML = body;
  okBtn.textContent = okLabel || 'Confirm';
  cancelBtn.textContent = cancelLabel || 'Cancel';
  // Style ok button by type
  if (type === 'danger') {
    okBtn.style.cssText = 'padding:9px 22px;border-radius:9px;border:none;background:rgba(232,80,74,.9);color:#fff;font-size:13px;font-weight:600;font-family:var(--font-body);cursor:pointer;transition:all .15s;box-shadow:0 0 14px rgba(232,80,74,.35)';
  } else {
    okBtn.style.cssText = 'padding:9px 22px;border-radius:9px;border:none;background:var(--purple);color:#fff;font-size:13px;font-weight:600;font-family:var(--font-body);cursor:pointer;transition:all .15s;box-shadow:0 0 14px var(--ac-30)';
  }
  _confirmModalCallback = callback;
  modal.style.display = 'flex';
  document.addEventListener('keydown', _confirmModalEsc);
  trapFocusInModal('confirm-modal');
}

function closeConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  if (modal) modal.style.display = 'none';
  document.removeEventListener('keydown', _confirmModalEsc);
  releaseFocusTrap('confirm-modal');
}

function _confirmModalEsc(e) {
  if (e.key === 'Escape') { closeConfirmModal(); return; }
  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    if (typeof _confirmModalCallback === 'function') {
      _confirmModalCallback();
      _confirmModalCallback = null;
    }
    closeConfirmModal();
  }
}

// ── INLINE PROMPT MODAL ─────────────────────────────
let _promptModalCallback = null;

function showInlinePrompt(label, defaultValue, callback) {
  const modal = document.getElementById('prompt-modal');
  const labelEl = document.getElementById('prompt-modal-label');
  const input = document.getElementById('prompt-modal-input');
  if (!modal) return;
  labelEl.textContent = label;
  input.value = defaultValue || '';
  _promptModalCallback = callback;
  modal.style.display = 'flex';
  requestAnimationFrame(() => { input.focus(); input.select(); });
  document.addEventListener('keydown', _promptModalEsc);
  trapFocusInModal('prompt-modal');
}

function closePromptModal(value) {
  const modal = document.getElementById('prompt-modal');
  if (modal) modal.style.display = 'none';
  document.removeEventListener('keydown', _promptModalEsc);
  if (_promptModalCallback) _promptModalCallback(value);
  _promptModalCallback = null;
}

function _promptModalEsc(e) {
  if (e.key === 'Escape') closePromptModal(null);
}


// ── MODAL SCREENSHOT SYSTEM ──────────────────────────────────
// Pending images staged before the trade is saved (no ID yet)
let _modalImgQueue = []; // [{dataUrl, label}]

function triggerModalImgUpload() {
  const inp = document.getElementById('modal-img-file-input');
  if (inp) inp.click();
}

function handleModalImgFileInput(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  processModalImgFiles(files);
  input.value = '';
}

function handleModalImgDrop(e) {
  e.preventDefault();
  document.getElementById('modal-img-dropzone')?.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  if (files.length) processModalImgFiles(files);
}

function processModalImgFiles(files) {
  let readCount = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target.result;
      if (dataUrl && dataUrl.startsWith('data:image')) {
        // Auto-detect label from filename
        let guessed = '';
        try {
          if (typeof guessImgLabel === 'function') {
            guessed = guessImgLabel(0, file.name) || '';
          }
        } catch(e) {
          console.warn('guessImgLabel error:', e);
        }
        _modalImgQueue.push({ dataUrl, label: guessed });
        renderModalImgThumbs();
        showToast(
          _modalImgQueue.length === 1
            ? '1 screenshot staged'
            : _modalImgQueue.length + ' screenshots staged',
          'success', '📷', 1800
        );
      } else {
        showToast('Invalid image format', 'error', '', 2500);
      }
      readCount++;
    };
    reader.onerror = () => {
      readCount++;
      showToast('Could not read image file', 'error', '', 2500);
    };
    reader.readAsDataURL(file);
  });
}

function renderModalImgThumbs() {
  const thumbsEl = document.getElementById('modal-img-thumbs');
  const countEl  = document.getElementById('modal-img-count');
  const dropzone = document.getElementById('modal-img-dropzone');
  if (!thumbsEl) return;

  if (_modalImgQueue.length === 0) {
    thumbsEl.style.display = 'none';
    thumbsEl.innerHTML = '';
    if (countEl) countEl.textContent = '';
    return;
  }

  thumbsEl.style.display = 'flex';
  if (countEl) countEl.textContent = '(' + _modalImgQueue.length + ')';

  thumbsEl.innerHTML = _modalImgQueue.map((img, i) => {
    const labelText = img.label ? img.label.replace(/</g,'&lt;').replace(/>/g,'&gt;') : '';
    const labelDisplay = labelText || '<span style="opacity:0.45;font-style:italic">Add label…</span>';
    return `
      <div style="position:relative;width:100px;height:80px;border-radius:8px;overflow:hidden;border:1px solid var(--border2);flex-shrink:0;background:var(--bg4);display:flex;align-items:center;justify-content:center" data-modal-idx="${i}">
        <img src="${img.dataUrl}" style="width:100%;height:100%;object-fit:cover;display:block" alt="Screenshot ${i+1}" onerror="this.style.opacity='0.3';this.title='Image failed to load'" onload="this.style.opacity='1'">
        <div class="modal-img-label" style="position:absolute;bottom:0;left:0;right:0;font-size:9px;font-family:var(--font-mono);background:linear-gradient(transparent,rgba(0,0,0,.8));color:#fff;padding:6px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;text-align:center;min-height:24px;display:flex;align-items:flex-end;justify-content:center">${labelDisplay}</div>
        <div onclick="removeModalImg(${i})" style="position:absolute;top:4px;right:4px;width:18px;height:18px;border-radius:50%;background:rgba(232,80,74,.9);display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:opacity .15s;border:1px solid rgba(232,80,74,.5);z-index:10" class="modal-img-del-btn">
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>
        </div>
      </div>
    `;
  }).join('');

  // Show delete buttons on hover
  thumbsEl.querySelectorAll('[data-modal-idx]').forEach((thumb, i) => {
    const del = thumb.querySelector('.modal-img-del-btn');
    const lbl = thumb.querySelector('.modal-img-label');
    
    thumb.addEventListener('mouseenter', () => { if(del) del.style.opacity='1'; });
    thumb.addEventListener('mouseleave', () => { if(del) del.style.opacity='0'; });
    
    // Label click → timeframe picker
    if (lbl) {
      lbl.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        assignModalImgLabel(i);
      });
    }
  });
}

function removeModalImg(index) {
  _modalImgQueue.splice(index, 1);
  renderModalImgThumbs();
}

function editModalImgLabel(index) {
  if (!_modalImgQueue[index]) return;
  const current = _modalImgQueue[index].label || '';
  showInlinePrompt('Label this screenshot', current, function(newLabel) {
    if (newLabel === null) return;
    _modalImgQueue[index].label = newLabel.trim();
    renderModalImgThumbs();
  });
}

function assignModalImgLabel(index) {
  if (!_modalImgQueue[index]) return;
  
  // Show timeframe picker for this modal image
  const overlay = $('tf-picker-overlay');
  const grid    = $('tf-picker-grid');
  const fnLabel = $('tf-picker-filename');
  if (!overlay || !grid) return;

  fnLabel.textContent = 'Assign label';
  overlay.style.display = 'flex';

  // Build grid buttons
  grid.innerHTML = '';
  const TF_LIST = [
    { label: '1 Min',  value: '1M Chart'     },
    { label: '3 Min',  value: '3M Chart'     },
    { label: '5 Min',  value: '5M Chart'     },
    { label: '15 Min', value: '15M Chart'    },
    { label: '30 Min', value: '30M Chart'    },
    { label: '1 Hour', value: '1H Chart'     },
    { label: '2 Hour', value: '2H Chart'     },
    { label: '4 Hour', value: '4H Chart'     },
    { label: '1 Day',  value: 'Daily Chart'  },
    { label: '1 Week', value: 'Weekly Chart' },
    { label: '1 Month',value: 'Monthly Chart'},
  ];
  
  TF_LIST.forEach(tf => {
    const btn = document.createElement('button');
    btn.textContent = tf.label;
    btn.style.cssText = 'padding:10px 6px;border-radius:8px;background:var(--bg4);border:1px solid var(--border2);color:var(--text2);font-family:var(--font-mono);font-size:11px;cursor:pointer;transition:all .15s;font-weight:500;letter-spacing:.02em';
    btn.onmouseenter = () => { btn.style.background='var(--ac-18)'; btn.style.borderColor='var(--ac-50)'; btn.style.color='#b891f5'; };
    btn.onmouseleave = () => { btn.style.background='var(--bg4)'; btn.style.borderColor='var(--border2)'; btn.style.color='var(--text2)'; };
    btn.onclick = () => {
      overlay.style.display='none';
      _modalImgQueue[index].label = tf.value;
      renderModalImgThumbs();
      window._imgPickerOpen = false;
    };
    grid.appendChild(btn);
  });

  // Store callback for Skip button (just close)
  overlay._tfCallback = () => {
    overlay.style.display = 'none';
    window._imgPickerOpen = false;
  };
  
  window._imgPickerOpen = true;
}

function resetModalImgs() {
  _modalImgQueue = [];
  renderModalImgThumbs();
}

// Handle paste when modal is open
function _modalImgPasteHandler(e) {
  const modal = document.getElementById('modal-overlay');
  if (!modal || !modal.classList.contains('open')) return;
  const items = Array.from(e.clipboardData?.items || []);
  const imgItems = items.filter(it => it.type.startsWith('image/'));
  if (!imgItems.length) return;
  e.preventDefault();
  imgItems.forEach(it => {
    const file = it.getAsFile();
    if (file) processModalImgFiles([file]);
  });
}
document.addEventListener('paste', _modalImgPasteHandler);



// ── KEYBOARD TRAP FOR MODALS ─────────────────────────
function trapFocusInModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  const focusable = modal.querySelectorAll('button, input, textarea, select, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  const first = focusable[0];
  const last  = focusable[focusable.length - 1];
  function handler(e) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  modal._trapHandler = handler;
  modal.addEventListener('keydown', handler);
  // Focus first focusable element
  setTimeout(() => first.focus(), 50);
}

function releaseFocusTrap(modalId) {
  const modal = document.getElementById(modalId);
  if (modal && modal._trapHandler) {
    modal.removeEventListener('keydown', modal._trapHandler);
    modal._trapHandler = null;
  }
}

// ── ACCOUNT CARD MENU ────────────────────────────────
function toggleAcctCardMenu(e, acctId, menuId) {
  e.stopPropagation();
  // Close all other menus first
  document.querySelectorAll('[id^="acct-card-menu-"]').forEach(m => {
    if (m.id !== menuId) m.style.display = 'none';
  });
  const menu = document.getElementById(menuId);
  if (!menu) return;
  const isOpen = menu.style.display === 'block';
  menu.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    setTimeout(() => {
      document.addEventListener('click', function _close(ev) {
        if (!menu.contains(ev.target)) {
          menu.style.display = 'none';
          document.removeEventListener('click', _close);
        }
      });
    }, 0);
  }
}

function confirmDeleteAccount(acctId) {
  document.querySelectorAll('[id^="acct-card-menu-"]').forEach(m => m.style.display = 'none');
  const acct = ACCOUNTS.find(a => a.id === acctId);
  if (!acct) return;
  const name = acct.firm + ' - ' + (acct.key || acct.phase);
  const tradeCount = TRADES.filter(t => (t.account||'') === name).length;
  showConfirmModal(
    '🗑️ Delete Account',
    `Delete <strong>${name}</strong>?${tradeCount > 0 ? `<br><br><span style="color:var(--amber)">⚠️ This account has <strong>${tradeCount} trade${tradeCount!==1?'s':''}</strong> linked to it. The trades will remain in your journal but will no longer be associated with an account.</span>` : ''}`,
    'Delete Account',
    'Cancel',
    'danger',
    function() {
      const idx = ACCOUNTS.findIndex(a => a.id === acctId);
      const deletedAcct = ACCOUNTS[idx];
      const deletedSelectedAcct = selectedAcct;
      ACCOUNTS.splice(idx, 1);
      saveAccounts();
      renderAllAccountsSection();
      if (selectedAcct >= ACCOUNTS.length) { selectedAcct = -1; }
      renderAcctList();
      if (typeof buildAnAccountBar === 'function') {
        const html = buildAnAccountBar();
        ['an-acct-bar-p3','an-acct-bar-p4'].forEach(id => { const el=$(id); if(el) el.innerHTML=html; });
      }
      populateDashboard();

      // ── Undo toast ──
      const container = $('toast-container');
      if (!container) return;
      while (container.children.length >= 4) {
        const oldest = container.children[0];
        oldest.classList.add('hide');
        setTimeout(() => oldest.remove(), 300);
      }
      const t = document.createElement('div');
      t.className = 'toast t-info';
      t.style.cssText = 'display:flex;align-items:center;gap:10px;min-width:220px';
      t.innerHTML = `
        <span class="toast-icon">🗑️</span>
        <span class="toast-msg" style="flex:1">Account deleted</span>
        <button class="t-undo-btn" onclick="this._undone=true;this.closest('.toast')._undone=true;" style="background:var(--ac-20);border:1px solid var(--ac-40);color:#b891f5;font-size:11px;font-family:var(--font-mono);font-weight:600;padding:3px 10px;border-radius:6px;cursor:pointer;white-space:nowrap;transition:background .12s;pointer-events:all" onmouseenter="this.style.background='var(--ac-35)'" onmouseleave="this.style.background='var(--ac-20)'">Undo</button>`;
      container.appendChild(t);
      requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));

      const undoTimer = setTimeout(() => {
        t.classList.add('hide');
        setTimeout(() => t.remove(), 350);
      }, 5000);

      t.querySelector('button').addEventListener('click', function() {
        clearTimeout(undoTimer);
        // Restore account at original index
        ACCOUNTS.splice(idx, 0, deletedAcct);
        saveAccounts();
        selectedAcct = deletedSelectedAcct;
        renderAllAccountsSection();
        renderAcctList();
        if (typeof buildAnAccountBar === 'function') {
          const html = buildAnAccountBar();
          ['an-acct-bar-p3','an-acct-bar-p4'].forEach(id => { const el=$(id); if(el) el.innerHTML=html; });
        }
        populateDashboard();
        t.classList.add('hide');
        setTimeout(() => t.remove(), 350);
        showToast('Account restored', 'success', '↩️', 2000);
      });
    }
  );
}

// ── Avatar helper — handles both photo and emoji ──
const AVATAR_PHOTO_KEY = 'et-profile-photo';

function setAvatarEl(containerEl, photoSrc, emoji) {
  if (!containerEl) return;
  const img  = containerEl.querySelector('img') || containerEl.id === 'profile-avatar-display' ? containerEl.querySelector('#profile-avatar-img') : null;
  const span = containerEl.querySelector('span') || (containerEl.tagName !== 'SPAN' ? null : containerEl);
  if (photoSrc) {
    // Show photo
    if (img) { img.src = photoSrc; img.style.display = 'block'; }
    if (span) span.style.display = 'none';
    containerEl.style.fontSize = '0';
  } else {
    // Show emoji or SVG
    if (img) { img.src = ''; img.style.display = 'none'; }
    if (span) { span.style.display = ''; if (emoji) span.textContent = emoji; }
    containerEl.style.fontSize = '';
  }
}

function triggerProfilePhotoUpload() {
  $('profile-photo-input')?.click();
}

function triggerAvatarOptions(e) {
  // Just open emoji picker for now — photo button handles upload
  triggerAvatarPicker(e);
}

function handleProfilePhotoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    // Store photo separately (can be large)
    try { localStorage.setItem(AVATAR_PHOTO_KEY, dataUrl); } catch(err) {
      showToast('Image too large — try a smaller photo', 'error', '', 2500); return;
    }
    // Clear emoji when photo is set
    const p = loadProfile();
    p.avatarPhoto = dataUrl;
    p.avatar = ''; // clear emoji
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    applyAvatarEverywhere(dataUrl, '');
    showToast('Profile photo updated', 'success', '📷', 1800);
    const removeBtn = document.getElementById('remove-photo-btn');
    if (removeBtn) removeBtn.style.display = 'inline-block';
    syncAvatarBgRow();
  };
  reader.readAsDataURL(file);
  input.value = ''; // reset so same file can be re-selected
}

function removeProfilePhoto() {
  const p = loadProfile();
  p.avatarPhoto = '';
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  localStorage.removeItem(AVATAR_PHOTO_KEY);
  applyAvatarEverywhere('', p.avatar || '');
  const removeBtn = document.getElementById('remove-photo-btn');
  if (removeBtn) removeBtn.style.display = 'none';
  syncAvatarBgRow();
  showToast('Profile photo removed', 'info', '', 1800);
}


const AVATAR_BG_SOLIDS = [
  '#6b1fd4','#4d8ef0','#2ecc8a','#e8504a','#f5a623',
  '#e91e8c','#00bcd4','#ff5722','#9c27b0','#3f51b5',
  '#009688','#795548','#607d8b','#000000','#ffffff','#1a1c24','#2e3347','#dde1ef','#a0a8be','#4a5068'
];
const AVATAR_BG_GRADIENTS = [
  'linear-gradient(135deg,#6b1fd4,#4d8ef0)',
  'linear-gradient(135deg,#e8504a,#f5a623)',
  'linear-gradient(135deg,#2ecc8a,#4d8ef0)',
  'linear-gradient(135deg,#e91e8c,#9c27b0)',
  'linear-gradient(135deg,#ff5722,#f5a623)',
  'linear-gradient(135deg,#1a1c24,#2e3347)',
  'linear-gradient(135deg,#00bcd4,#2ecc8a)',
  'linear-gradient(135deg,#3f51b5,#e91e8c)',
  'linear-gradient(135deg,#795548,#607d8b)'
];

function syncAvatarBgRow() {
  const p = loadProfile();
  const hasPhoto = !!(p.avatarPhoto || localStorage.getItem(AVATAR_PHOTO_KEY));
  const hasEmoji = !hasPhoto && !!(p.avatar && p.avatar.trim());
  const row = document.getElementById('avatar-bg-row');
  if (row) row.style.display = hasEmoji ? 'flex' : 'none';
  // Sync preview dot
  const prev = document.getElementById('avatar-bg-preview');
  if (prev && p.avatarBg) prev.style.background = p.avatarBg;
}

function toggleAvatarBgPicker(e) {
  if (e) e.stopPropagation();
  const picker = document.getElementById('avatar-bg-picker');
  if (!picker) return;
  if (picker.style.display === 'block') { picker.style.display = 'none'; return; }
  // Build swatches
  const swatchGrid = document.getElementById('avatar-bg-swatches');
  const gradGrid   = document.getElementById('avatar-bg-gradients');
  const p = loadProfile();
  const current = p.avatarBg || '';
  swatchGrid.innerHTML = '';
  AVATAR_BG_SOLIDS.forEach(c => {
    const s = document.createElement('div');
    s.style.cssText = `width:100%;aspect-ratio:1;border-radius:5px;background:${c};cursor:pointer;border:2px solid ${current===c?'#fff':'transparent'};transition:transform .1s,border-color .1s;box-sizing:border-box`;
    s.title = c;
    s.onmouseenter = () => s.style.transform = 'scale(1.15)';
    s.onmouseleave = () => s.style.transform = 'scale(1)';
    s.onclick = (ev) => { ev.stopPropagation(); setAvatarBgColor(c); updateSwatchSelection(c); };
    swatchGrid.appendChild(s);
  });
  gradGrid.innerHTML = '';
  AVATAR_BG_GRADIENTS.forEach(g => {
    const s = document.createElement('div');
    s.style.cssText = `width:100%;height:26px;border-radius:5px;background:${g};cursor:pointer;border:2px solid ${current===g?'#fff':'transparent'};transition:transform .1s,border-color .1s;box-sizing:border-box`;
    s.onmouseenter = () => s.style.transform = 'scale(1.05)';
    s.onmouseleave = () => s.style.transform = 'scale(1)';
    s.onclick = (ev) => { ev.stopPropagation(); setAvatarBgColor(g); updateSwatchSelection(g); };
    gradGrid.appendChild(s);
  });
  // Sync hex input
  const hexInput = document.getElementById('avatar-hex-input');
  const hexPrev  = document.getElementById('avatar-hex-preview');
  if (hexInput && current && current.startsWith('#')) { hexInput.value = current; if(hexPrev) hexPrev.style.background = current; }
  picker.style.display = 'block';
}

function updateSwatchSelection(selected) {
  const swatchGrid = document.getElementById('avatar-bg-swatches');
  const gradGrid   = document.getElementById('avatar-bg-gradients');
  if (swatchGrid) swatchGrid.querySelectorAll('div').forEach((s,i) => s.style.borderColor = AVATAR_BG_SOLIDS[i]===selected?'#fff':'transparent');
  if (gradGrid)   gradGrid.querySelectorAll('div').forEach((s,i)   => s.style.borderColor = AVATAR_BG_GRADIENTS[i]===selected?'#fff':'transparent');
}

function avatarHexLive(val) {
  const prev = document.getElementById('avatar-hex-preview');
  if (/^#[0-9a-fA-F]{6}$/.test(val) && prev) prev.style.background = val;
}
function avatarHexApply() {
  const val = (document.getElementById('avatar-hex-input')?.value || '').trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(val)) { showToast('Enter a valid hex e.g. #ff5722', 'error','',1600); return; }
  setAvatarBgColor(val);
  updateSwatchSelection(val);
  // picker is closed inside setAvatarBgColor
}

function setAvatarBgColor(color) {
  const p = loadProfile();
  p.avatarBg = color;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  applyAvatarBgColor(color);
  // Update preview dot on button
  const prev = document.getElementById('avatar-bg-preview');
  if (prev) prev.style.background = color;
  // Close picker after selection
  const picker = document.getElementById('avatar-bg-picker');
  if (picker) picker.style.display = 'none';
  showToast('Background updated', 'success', '🎨', 1200);
}

function applyAvatarBgColor(color) {
  if (!color) return;
  const ids = ['profile-avatar-display','prof-preview-avatar','sidebar-avatar','topbar-avatar','banner-avatar'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.background = color;
  });
}

// Close picker on outside click
document.addEventListener('click', () => {
  const picker = document.getElementById('avatar-bg-picker');
  if (picker) picker.style.display = 'none';
});

function applyAvatarEverywhere(photo, emoji) {
  // Apply saved bg color if photo is set
  if (photo) {
    const _bg = (loadProfile().avatarBg) || '';
    applyAvatarBgColor(_bg);
  } else {
    // Reset to default gradient when no photo
    const ids = ['profile-avatar-display','prof-preview-avatar','sidebar-avatar','topbar-avatar','banner-avatar'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.style.background = ''; });
  }
  // Settings large preview
  const settingsAvatar = $('profile-avatar-display');
  if (settingsAvatar) {
    const img  = $('profile-avatar-img');
    const span = $('profile-avatar-emoji');
    if (photo) {
      if (img)  { img.src = photo; img.style.display = 'block'; }
      if (span) span.style.display = 'none';
    } else {
      if (img)  { img.src = ''; img.style.display = 'none'; }
      if (span) { span.style.display = ''; if (emoji) span.textContent = emoji; }
    }
  }
  // Preview card avatar
  const prevAv = $('prof-preview-avatar');
  if (prevAv) {
    let img = prevAv.querySelector('img.av-photo');
    if (!img) { img = document.createElement('img'); img.className='av-photo'; img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;display:none'; prevAv.style.position='relative'; prevAv.style.overflow='hidden'; prevAv.appendChild(img); }
    if (photo) { img.src=photo; img.style.display='block'; prevAv.style.fontSize='0'; prevAv.querySelectorAll('span,svg').forEach(e=>e.style.display='none'); }
    else { img.style.display='none'; prevAv.style.fontSize=''; prevAv.querySelectorAll('span,svg').forEach(e=>e.style.display=''); if (emoji) { const sp=prevAv.querySelector('span'); if(sp) sp.textContent=emoji; } }
  }
  // Sidebar avatar
  const sbAv = $('sidebar-avatar');
  if (sbAv) {
    let img = sbAv.querySelector('img.av-photo');
    if (!img) { img = document.createElement('img'); img.className='av-photo'; img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;display:none'; sbAv.style.position='relative'; sbAv.style.overflow='hidden'; sbAv.appendChild(img); }
    if (photo) { img.src=photo; img.style.display='block'; sbAv.style.fontSize='0'; sbAv.querySelectorAll('span,svg').forEach(e=>e.style.display='none'); }
    else { img.style.display='none'; sbAv.style.fontSize=''; sbAv.querySelectorAll('span,svg').forEach(e=>e.style.display=''); if (emoji) { const sp=sbAv.querySelector('span'); if(sp) sp.textContent=emoji; } }
  }
  // Topbar avatar
  const tbAv = $('topbar-avatar');
  if (tbAv) {
    let img = tbAv.querySelector('img.av-photo');
    if (!img) { img = document.createElement('img'); img.className='av-photo'; img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;display:none'; tbAv.style.position='relative'; tbAv.style.overflow='hidden'; tbAv.appendChild(img); }
    if (photo) { img.src=photo; img.style.display='block'; tbAv.style.fontSize='0'; tbAv.querySelectorAll('span,svg').forEach(e=>e.style.display='none'); }
    else { img.style.display='none'; tbAv.style.fontSize=''; tbAv.querySelectorAll('span,svg').forEach(e=>e.style.display=''); if (emoji) { const sp=tbAv.querySelector('span'); if(sp) sp.textContent=emoji; } }
  }
  // Banner avatar
  const bnAv = $('banner-avatar');
  if (bnAv) {
    let img = bnAv.querySelector('img.av-photo');
    if (!img) { img = document.createElement('img'); img.className='av-photo'; img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;display:none'; bnAv.style.position='relative'; bnAv.style.overflow='hidden'; bnAv.appendChild(img); }
    if (photo) { img.src=photo; img.style.display='block'; bnAv.style.fontSize='0'; bnAv.querySelectorAll('span,svg').forEach(e=>e.style.display='none'); }
    else { img.style.display='none'; bnAv.style.fontSize=''; bnAv.querySelectorAll('span,svg').forEach(e=>e.style.display=''); if (emoji) { const sp=bnAv.querySelector('span'); if(sp) sp.textContent=emoji; } }
  }
}

function saveProfile() {
  const existing = loadProfile();
  const publicUsernameInput = $('prof-public-username');
  const publicUsername = normalizePublicUsernameInput(publicUsernameInput ? publicUsernameInput.value : (existing.publicUsername || existing.handle || ''));
  if ($('prof-public-username')) $('prof-public-username').value = publicUsername;
  const p = {
    name:   $('prof-name')?.value || '',
    handle: $('prof-handle')?.value || '',
    style:  $('prof-style')?.value || '',
    exp:    $('prof-exp')?.value || '',
    bio:    $('prof-bio')?.value || '',
    publicUsername,
    isPublic: $('prof-public-toggle')?.getAttribute('data-on') === 'true',
    avatar: $('profile-avatar-emoji')?.textContent || '',
    avatarPhoto: existing.avatarPhoto || '',
    avatarBg: existing.avatarBg || ''
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  updateProfilePreview(p);
  updateSidebarProfile(p);
  updatePublicShareUI(p);
  schedulePublicProfileSync(p);
}
function setProfileAuthEmail(email) {
  const value = email && String(email).trim() ? String(email).trim() : 'Yet to sign in';
  const emailEl = $('prof-login-email');
  const previewEl = $('prof-preview-email');
  if (emailEl) emailEl.textContent = value;
  if (previewEl) previewEl.textContent = value;
}
async function syncProfileAuthEmail() {
  if (!window.SB || typeof window.SB.getUser !== 'function') {
    setProfileAuthEmail('');
    return;
  }
  try {
    const user = await window.SB.getUser();
    setProfileAuthEmail(user && user.email ? user.email : '');
  } catch (e) {
    setProfileAuthEmail('');
  }
}
function updateProfilePreview(p) {
  const nameEl   = $('prof-preview-name');
  const handleEl = $('prof-preview-handle');
  const styleEl  = $('prof-preview-style');
  const expEl    = $('prof-preview-exp');
  const avatarEl = $('prof-preview-avatar');
  if (nameEl)   nameEl.textContent   = p.name   || 'Trader';
  if (handleEl) handleEl.textContent = p.handle ? p.handle : '';
  if (avatarEl) avatarEl.textContent = p.avatar || '';
  if (styleEl)  { styleEl.textContent = p.style || ''; styleEl.style.display = p.style ? 'inline-block' : 'none'; }
  if (expEl)    { expEl.textContent   = p.exp   || ''; expEl.style.display   = p.exp   ? 'inline-block' : 'none'; }
}
function updateSidebarProfile(p) {
  const nameEl = $('sidebar-profile-name');
  const avatarEl = $('sidebar-avatar');
  if (nameEl && p.name) nameEl.textContent = p.name;
  if (avatarEl && p.avatar) avatarEl.textContent = p.avatar;
  const metaEl = $('sidebar-profile-meta');
  if (metaEl && p.handle) metaEl.textContent = p.handle + (p.style ? ' · ' + p.style : '');
  else if (metaEl && p.style) metaEl.textContent = p.style;
  // Update topbar chip
  const tbName = $('topbar-profile-name');
  const tbAvatar = $('topbar-avatar');
  if (tbName) tbName.textContent = p.name || 'Trader';
  if (tbAvatar) {
    if (p.avatar && p.avatar.trim()) {
      tbAvatar.textContent = p.avatar;
      tbAvatar.style.fontSize = '14px';
    } else {
      tbAvatar.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>';
    }
  }
  // Sync banner profile chip
  const bnName = $('banner-profile-name');
  const bnAvatar = $('banner-avatar');
  if (bnName) bnName.textContent = p.name || 'Trader';
  if (bnAvatar) {
    if (p.avatar && p.avatar.trim()) {
      bnAvatar.textContent = p.avatar;
      bnAvatar.style.fontSize = '16px';
    } else {
      bnAvatar.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>';
    }
  }
}
function triggerAvatarPicker(e) {
  if (e) e.stopPropagation();
  const picker = $('avatar-picker');
  if (!picker) return;
  if (picker.style.display === 'grid') { picker.style.display = 'none'; return; }
  picker.innerHTML = '';
  AVATAR_EMOJIS.forEach(em => {
    const d = document.createElement('div');
    d.textContent = em;
    d.style.cssText = 'font-size:20px;cursor:pointer;padding:4px;border-radius:6px;text-align:center;transition:background .1s';
    d.onmouseenter = () => d.style.background = 'var(--bg5)';
    d.onmouseleave = () => d.style.background = 'transparent';
    d.onclick = (ev) => {
      ev.stopPropagation();
      const span = $('profile-avatar-emoji');
      if (span) span.textContent = em;
      const prev = $('prof-preview-avatar');
      if (prev) prev.textContent = em;
      // Clear photo when emoji selected
      const pCur = loadProfile(); pCur.avatarPhoto = ''; pCur.avatar = em;
      localStorage.setItem(PROFILE_KEY, JSON.stringify(pCur));
      localStorage.removeItem(AVATAR_PHOTO_KEY);
      applyAvatarEverywhere('', em);
      const _rb = document.getElementById('remove-photo-btn');
      if (_rb) _rb.style.display = 'none';
      picker.style.display = 'none';
      saveProfile();
      syncAvatarBgRow();
    };
    picker.appendChild(d);
  });
  // Position below avatar
  const avatarEl = $('profile-avatar-display');
  if (avatarEl) {
    const rect = avatarEl.getBoundingClientRect();
    picker.style.position = 'fixed';
    picker.style.top = (rect.bottom + 8) + 'px';
    picker.style.left = rect.left + 'px';
    picker.style.width = '220px';
  }
  picker.style.display = 'grid';
}
// Close picker on outside click
document.addEventListener('click', e => {
  const picker = $('avatar-picker');
  if (picker && picker.style.display === 'grid' && !picker.contains(e.target)) {
    picker.style.display = 'none';
  }
});
function initProfileUI() {
  const p = loadProfile();
  if ($('prof-name'))   $('prof-name').value   = p.name   || '';
  if ($('prof-handle')) $('prof-handle').value = p.handle || '';
  if ($('prof-public-username')) $('prof-public-username').value = normalizePublicUsernameInput(p.publicUsername || p.handle || '');
  if ($('prof-style'))  $('prof-style').value  = p.style  || '';
  if ($('prof-exp'))    $('prof-exp').value    = p.exp    || '';
  if ($('prof-bio'))    $('prof-bio').value    = p.bio    || '';
  if ($('prof-public-toggle')) $('prof-public-toggle').setAttribute('data-on', p.isPublic ? 'true' : 'false');
  const avatar = p.avatar || '';
  const em = $('profile-avatar-emoji');
  if (em) em.textContent = avatar;
  // Apply photo if stored
  const photo = p.avatarPhoto || localStorage.getItem(AVATAR_PHOTO_KEY) || '';
  setTimeout(() => {
    applyAvatarEverywhere(photo, avatar);
    const removeBtn = document.getElementById('remove-photo-btn');
    if (removeBtn) removeBtn.style.display = photo ? 'inline-block' : 'none';
    syncAvatarBgRow();
  }, 0);
  updateProfilePreview(p);
  updateSidebarProfile(p);
  updatePublicShareUI(p);
  syncSettingsTimezoneDropdown('prof-style');
  syncSettingsTimezoneDropdown('prof-exp');
  syncProfileAuthEmail();
}

// ── SETTINGS STORE ────────────────────────────────────────
const DEFAULT_SETTINGS = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  displayTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  tradingTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  importTimezone: 'UTC+00:00',
  dateFormat: 'YYYY-MM-DD',
  timeFormat: '24h',
  currency: 'USD',
  defaultSession: '',
  defaultSize: '1',
  deleteConfirm: true,
  autoPnl: true,
  showEmotions: false,
  soundFx: false,
  dailyWarn: true,
  ddWarn: true,
  streakToast: true,
  beThresholdPct: 25   // % of risk: if |pnl| < this% of risk → Break Even
};

// ── Global trade result classifier ──────────────────────────
// Returns 'win' | 'loss' | 'be'
function getTradeResult(t) {
  const s = loadSettings();
  const threshold = parseFloat(s.beThresholdPct) || 0;
  if (threshold <= 0) {
    // No BE zone — classic win/loss
    return t.pnl > 0 ? 'win' : t.pnl < 0 ? 'loss' : 'be';
  }

  // Risk model:
  // 1) Prefer directional protective SL risk for non-imported trades.
  // 2) Otherwise use median losing trade size as a stable fallback proxy.
  const isImported = String(t.setup || '').toLowerCase() === 'imported';
  const hasDirectionalSL = Number.isFinite(t.sl) && Number.isFinite(t.entry) && (
    (t.dir === 'long' && t.sl < t.entry) ||
    (t.dir === 'short' && t.sl > t.entry)
  );

  let riskFromSL = (!isImported && hasDirectionalSL)
    ? Math.abs(t.entry - t.sl) * (Number(t.size) || 1) * 100
    : 0;

  // Guard against obviously unrealistic risk leading to fake huge R (e.g. 50R from import SL noise)
  if (riskFromSL > 0 && Number.isFinite(t.pnl)) {
    const absR = Math.abs(t.pnl) / riskFromSL;
    if (absR > 20) riskFromSL = 0;
  }

  const allTrades = (typeof TRADES !== 'undefined' && Array.isArray(TRADES)) ? TRADES : [];
  const peerLosses = allTrades
    .filter(x => x && Number.isFinite(x.pnl) && x.pnl < 0 && (!t.account || x.account === t.account))
    .map(x => Math.abs(x.pnl))
    .sort((a, b) => a - b);

  let fallbackRisk = 0;
  if (peerLosses.length) {
    const mid = Math.floor(peerLosses.length / 2);
    fallbackRisk = (peerLosses.length % 2)
      ? peerLosses[mid]
      : (peerLosses[mid - 1] + peerLosses[mid]) / 2;
  }
  if (!(fallbackRisk > 0)) fallbackRisk = Math.max(Math.abs(t.pnl), 1);

  const risk = riskFromSL > 0 ? riskFromSL : fallbackRisk;
  const beZone = risk * (threshold / 100);
  if (Math.abs(t.pnl) <= beZone) return 'be';
  return t.pnl > 0 ? 'win' : 'loss';
}
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const merged = Object.assign({}, DEFAULT_SETTINGS, s);
    merged.displayTimezone = s.displayTimezone || s.timezone || DEFAULT_SETTINGS.displayTimezone;
    merged.timezone = merged.displayTimezone;
    merged.tradingTimezone = s.tradingTimezone || merged.displayTimezone || DEFAULT_SETTINGS.tradingTimezone;
    merged.importTimezone = s.importTimezone || localStorage.getItem('etImportSourceTimezone') || DEFAULT_SETTINGS.importTimezone;
    return merged;
  } catch(e) { return {...DEFAULT_SETTINGS}; }
}
function saveSetting(key, value) {
  const s = loadSettings();
  if (key === 'timezone' || key === 'displayTimezone') {
    s.timezone = value;
    s.displayTimezone = value;
  } else {
    s[key] = value;
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  if (key === 'importTimezone' && value) {
    try { localStorage.setItem('etImportSourceTimezone', value); } catch (e) {}
  }
}
function toggleSetting(key) {
  const s = loadSettings();
  s[key] = !s[key];
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  // update toggle UI
  const toggleId = {
    deleteConfirm: 'tog-delete-confirm',
    autoPnl: 'tog-auto-pnl',
    showEmotions: 'tog-show-emotions',
    soundFx: 'tog-sound',
    dailyWarn: 'tog-daily-warn',
    ddWarn: 'tog-dd-warn',
    streakToast: 'tog-streak-toast'
  }[key];
  if (toggleId) {
    const el = $(toggleId);
    if (el) el.setAttribute('data-on', s[key] ? 'true' : 'false');
  }
}
function initSettingsUI() {
  const s = loadSettings();
  ensureSettingsTimezoneOptions('setting-timezone', s.displayTimezone);
  ensureSettingsTimezoneOptions('setting-trading-timezone', s.tradingTimezone);
  ensureImportTimezoneOptions('setting-import-timezone', s.importTimezone);
  const setVal = (id, val) => { const el = $(id); if (el) el.value = val; };
  setVal('setting-timezone',     s.displayTimezone);
  setVal('setting-trading-timezone', s.tradingTimezone);
  setVal('setting-import-timezone', s.importTimezone);
  setVal('setting-date-format',  s.dateFormat);
  setVal('setting-time-format',  s.timeFormat);
  setVal('setting-currency',     s.currency);
  setVal('setting-session',      s.defaultSession);
  setVal('setting-default-size', s.defaultSize);
  setVal('setting-be-threshold', s.beThresholdPct !== undefined ? s.beThresholdPct : 25);
  const bePrev = $('be-pct-preview');
  if (bePrev) bePrev.textContent = (s.beThresholdPct !== undefined ? s.beThresholdPct : 25) + '%';
  // Toggles
  const toggleMap = {
    deleteConfirm: 'tog-delete-confirm',
    autoPnl:       'tog-auto-pnl',
    showEmotions:  'tog-show-emotions',
    soundFx:       'tog-sound',
    dailyWarn:     'tog-daily-warn',
    ddWarn:        'tog-dd-warn',
    streakToast:   'tog-streak-toast'
  };
  Object.entries(toggleMap).forEach(([key, id]) => {
    const el = $(id);
    if (el) el.setAttribute('data-on', s[key] ? 'true' : 'false');
  });
  // Theme buttons
  const isLight = document.documentElement.classList.contains('light');
  updateThemeButtons(isLight);
  // Start clock
  startTzClock(s.displayTimezone);
  // Build custom dropdown UI to match account dropdown style
  initSettingsTimezoneDropdowns();
}

function initSettingsTimezoneDropdowns() {
  ['setting-timezone', 'setting-trading-timezone', 'setting-import-timezone', 'setting-date-format', 'setting-time-format', 'setting-currency', 'setting-session', 'prof-style', 'prof-exp'].forEach(syncSettingsTimezoneDropdown);
}

function syncSettingsTimezoneDropdown(selectId) {
  const sel = $(selectId);
  const list = $(selectId + '-list');
  const label = $(selectId + '-btn-label');
  if (!sel || !list || !label) return;

  const current = sel.value;
  label.textContent = _settingsTimezoneButtonLabel(selectId, current);
  list.innerHTML = '';

  [...sel.options].forEach((opt) => {
    const active = opt.value === current;
    const item = document.createElement('div');
    item.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:9px 10px;border-radius:8px;cursor:pointer;font-size:13px;font-family:var(--font-body);color:${active ? '#b891f5' : 'var(--text2)'};background:${active ? 'var(--ac-15)' : 'transparent'};transition:background .1s`;
    item.innerHTML = `<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:calc(100% - 18px)">${_settingsTimezoneButtonLabel(selectId, opt.value)}</span>${active ? '<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#b891f5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}`;
    item.onmouseenter = () => { if (!active) item.style.background = 'var(--ac-08)'; };
    item.onmouseleave = () => { if (!active) item.style.background = 'transparent'; };
    item.onclick = () => {
      sel.value = opt.value;
      const ev = new Event('change', { bubbles: true });
      sel.dispatchEvent(ev);
      closeAllSettingsTimezoneDropdowns();
      syncSettingsTimezoneDropdown(selectId);
    };
    list.appendChild(item);
  });
}

function _settingsTimezoneButtonLabel(selectId, value) {
  const sel = $(selectId);
  if (!sel) return String(value).replace(/_/g, ' ');
  const opt = [...sel.options].find((o) => o.value === value);
  if (!opt) return 'Select option';
  if (selectId === 'setting-import-timezone') return value;
  return (opt.textContent || value).replace(/_/g, ' ');
}

function toggleSettingsTimezoneDropdown(selectId) {
  const dd = $(selectId + '-dd');
  if (!dd) return;
  const open = dd.style.display === 'block';
  closeAllSettingsTimezoneDropdowns();
  if (!open) {
    syncSettingsTimezoneDropdown(selectId);
    dd.style.display = 'block';
  }
}

function closeAllSettingsTimezoneDropdowns() {
  ['setting-timezone-dd', 'setting-trading-timezone-dd', 'setting-import-timezone-dd', 'setting-date-format-dd', 'setting-time-format-dd', 'setting-currency-dd', 'setting-session-dd', 'prof-style-dd', 'prof-exp-dd'].forEach((id) => {
    const el = $(id);
    if (el) el.style.display = 'none';
  });
}

document.addEventListener('click', (e) => {
  const wraps = ['setting-timezone-wrap', 'setting-trading-timezone-wrap', 'setting-import-timezone-wrap', 'setting-date-format-wrap', 'setting-time-format-wrap', 'setting-currency-wrap', 'setting-session-wrap', 'prof-style-wrap', 'prof-exp-wrap'];
  const inside = wraps.some((id) => {
    const el = $(id);
    return el && el.contains(e.target);
  });
  if (!inside) closeAllSettingsTimezoneDropdowns();
});
function ensureSettingsTimezoneOptions(selectId, selectedValue) {
  const tzSel = $(selectId);
  if (!tzSel || tzSel.options.length > 0) return;
  const tzList = [
    'UTC','America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
    'America/Toronto','America/Vancouver','America/Sao_Paulo','America/Mexico_City',
    'Europe/London','Europe/Paris','Europe/Berlin','Europe/Madrid','Europe/Rome',
    'Europe/Amsterdam','Europe/Stockholm','Europe/Zurich','Europe/Moscow',
    'Asia/Dubai','Asia/Kolkata','Asia/Colombo','Asia/Dhaka','Asia/Bangkok',
    'Asia/Singapore','Asia/Kuala_Lumpur','Asia/Hong_Kong','Asia/Shanghai',
    'Asia/Tokyo','Asia/Seoul','Australia/Sydney','Australia/Melbourne',
    'Pacific/Auckland','Pacific/Honolulu','Africa/Cairo','Africa/Johannesburg'
  ];
  const fallback = selectedValue || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  tzList.forEach(tz => {
    const opt = document.createElement('option');
    opt.value = tz;
    opt.textContent = tz.replace(/_/g,' ');
    if (tz === fallback) opt.selected = true;
    tzSel.appendChild(opt);
  });
}
function ensureImportTimezoneOptions(selectId, selectedValue) {
  const sel = $(selectId);
  if (!sel || sel.options.length > 0) return;
  const citiesByOffset = {
    '-12:00': 'Baker Island', '-11:00': 'American Samoa', '-10:00': 'Honolulu', '-09:30': 'Marquesas',
    '-09:00': 'Anchorage', '-08:00': 'Los Angeles', '-07:00': 'Denver', '-06:00': 'Chicago',
    '-05:00': 'New York', '-04:00': 'Santiago', '-03:30': 'St. John\'s', '-03:00': 'Sao Paulo',
    '-02:00': 'South Georgia', '-01:00': 'Azores', '+00:00': 'London', '+01:00': 'Berlin',
    '+02:00': 'Cairo', '+03:00': 'Moscow', '+03:30': 'Tehran', '+04:00': 'Dubai', '+04:30': 'Kabul',
    '+05:00': 'Karachi', '+05:30': 'Mumbai', '+05:45': 'Kathmandu', '+06:00': 'Dhaka',
    '+06:30': 'Yangon', '+07:00': 'Bangkok', '+08:00': 'Singapore', '+08:45': 'Eucla',
    '+09:00': 'Tokyo', '+09:30': 'Adelaide', '+10:00': 'Sydney', '+10:30': 'Lord Howe',
    '+11:00': 'Noumea', '+12:00': 'Auckland', '+12:45': 'Chatham Islands', '+13:00': 'Samoa', '+14:00': 'Kiritimati'
  };

  for (let mins = -12 * 60; mins <= 14 * 60; mins += 15) {
    if (!citiesByOffset[_offsetLabel(mins)]) continue;
    const opt = document.createElement('option');
    opt.value = 'UTC' + _offsetLabel(mins);
    opt.textContent = 'UTC' + _offsetLabel(mins) + ' - ' + citiesByOffset[_offsetLabel(mins)];
    sel.appendChild(opt);
  }

  ['America/New_York', 'Europe/London', 'Europe/Berlin', 'Asia/Kolkata', 'UTC'].forEach(tz => {
    if ([...sel.options].some(o => o.value === tz)) return;
    const opt = document.createElement('option');
    opt.value = tz;
    opt.textContent = tz;
    sel.appendChild(opt);
  });

  const current = selectedValue || 'UTC+00:00';
  if ([...sel.options].some(o => o.value === current)) sel.value = current;
}
function _offsetLabel(totalMinutes) {
  const sign = totalMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(totalMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return sign + hh + ':' + mm;
}
function applyTimezone() {
  const sel = $('setting-timezone');
  if (!sel) return;
  saveSetting('displayTimezone', sel.value);
  startTzClock(sel.value);
  if (typeof window._tickLiveClock === 'function') window._tickLiveClock();
}
function applyTradingTimezone() {
  const sel = $('setting-trading-timezone');
  if (!sel) return;
  const previousTz = loadSettings().tradingTimezone || loadSettings().displayTimezone || 'UTC';
  const nextTz = sel.value;
  if (previousTz !== nextTz && typeof convertAllTradesToTradingTimezone === 'function') {
    convertAllTradesToTradingTimezone(previousTz, nextTz);
  }
  saveSetting('tradingTimezone', sel.value);
  refreshTimeDependentUI();
}
function applyImportTimezoneSetting() {
  const sel = $('setting-import-timezone');
  if (!sel) return;
  saveSetting('importTimezone', sel.value);
  try { localStorage.setItem('etImportSourceTimezone', sel.value); } catch (e) {}
}
let tzClockInterval = null;
function startTzClock(tz) {
  if (tzClockInterval) clearInterval(tzClockInterval);
  const el = $('tz-clock');
  if (!el) return;
  const tick = () => {
    try {
      el.textContent = new Date().toLocaleString('en-US', { timeZone: tz, weekday:'short', year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: false });
    } catch(e) { el.textContent = new Date().toLocaleString(); }
  };
  tick();
  tzClockInterval = setInterval(tick, 1000);
}
function setThemeMode(mode) {
  const cl = document.documentElement.classList;
  cl.remove('light','medium');
  if (mode === 'light')  cl.add('light');
  if (mode === 'medium') cl.add('medium');
  localStorage.setItem('et-theme', mode);
  updateThemeButtons(mode);
  // Show mode name notification
  const modeNames = { dark: '🌑 Midnight', light: '☀️ Dawn' };
  const modeLabel = modeNames[mode] || mode;
  showThemeModeToast(modeLabel);
  try { if (typeof toggleTheme === 'function') {} } catch(e) {}
}

function showThemeModeToast(label) {
  // Remove existing theme toast if any
  const existing = document.getElementById('theme-mode-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'theme-mode-toast';
  toast.textContent = label;
  toast.style.cssText = `
    position:fixed;bottom:40px;left:50%;transform:translateX(-50%) scale(0.85);
    background:var(--bg2);border:1px solid var(--ac-30);border-radius:14px;
    padding:5px 12px;font-family:var(--font-display);font-size:11px;font-weight:600;
    color:var(--text);letter-spacing:0.02em;
    box-shadow:0 8px 40px rgba(0,0,0,.5),0 0 0 1px var(--ac-10),inset 0 0 40px var(--ac-06);
    z-index:999999;pointer-events:none;
    opacity:0;transition:opacity .18s ease,transform .18s cubic-bezier(.34,1.56,.64,1);
    white-space:nowrap;
  `;
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) scale(1)';
    });
  });

  // Animate out and remove
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) scale(0.9)';
    setTimeout(() => toast.remove(), 200);
  }, 1200);
}
function updateThemeButtons(mode) {
  const darkBtn   = $('theme-dark-btn');
  const medBtn    = $('theme-medium-btn');
  const lightBtn  = $('theme-light-btn');
  [darkBtn, medBtn, lightBtn].forEach(b => {
    if (!b) return;
    b.style.borderWidth = '1px'; b.style.borderColor = 'var(--border)';
    const lbl = b.querySelector('div:last-child');
    if (lbl) lbl.style.color = 'var(--text2)';
  });
  const activeBtn = mode === 'light' ? lightBtn : mode === 'medium' ? medBtn : darkBtn;
  if (activeBtn) {
    activeBtn.style.borderWidth = '2px'; activeBtn.style.borderColor = 'var(--purple)';
    const lbl = activeBtn.querySelector('div:last-child');
    if (lbl) lbl.style.color = 'var(--purple)';
  }
}
/* ─── ACCENT COLOR ENGINE ─── */
// Alpha tiers mirroring the CSS --ac-NN vars
const ACCENT_ALPHAS = {
  '--ac-03':.03,'--ac-04':.04,'--ac-05':.05,'--ac-06':.06,
  '--ac-07':.07,'--ac-08':.08,'--ac-09':.09,'--ac-10':.1,
  '--ac-12':.12,'--ac-14':.14,'--ac-15':.15,'--ac-16':.16,
  '--ac-18':.18,'--ac-20':.2, '--ac-22':.22,'--ac-25':.25,
  '--ac-28':.28,'--ac-30':.3, '--ac-35':.35,'--ac-40':.4,
  '--ac-45':.45,'--ac-50':.5, '--ac-55':.55,'--ac-60':.6,
  '--ac-65':.65,'--ac-70':.7, '--ac-80':.8, '--ac-85':.85,
  '--ac-90':.9,
};

function hexToRgb(hex) {
  // Handle 3/6 digit hex, strip #
  hex = hex.replace('#','');
  if(hex.length===3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  const n = parseInt(hex,16);
  return [(n>>16)&255,(n>>8)&255,n&255];
}

// Convert 24-hour time format (HH:MM) to 12-hour format (H:MM AM/PM)
function format24to12Hour(time24) {
  if (!time24 || typeof time24 !== 'string') return time24;
  const [hours, minutes] = time24.split(':');
  let h = parseInt(hours) || 0;
  let m = parseInt(minutes) || 0;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12; // Convert to 12-hour format
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatTradeTime(time24) {
  if (!time24 || typeof time24 !== 'string') return time24;
  const s = loadSettings();
  return s.timeFormat === '12h' ? format24to12Hour(time24) : time24;
}

function _parseTimezoneOffsetMinutes(tz) {
  const m = String(tz || '').trim().match(/^UTC([+-])(\d{2}):(\d{2})$/i);
  if (!m) return null;
  const sign = m[1] === '+' ? 1 : -1;
  const hh = parseInt(m[2], 10);
  const mm = parseInt(m[3], 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh > 14 || mm > 59) return null;
  return sign * (hh * 60 + mm);
}

function _formatPartsInTimezone(dateObj, tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(dateObj);
  const pick = type => parts.find(p => p.type === type)?.value;
  return {
    year: parseInt(pick('year'), 10),
    month: parseInt(pick('month'), 10),
    day: parseInt(pick('day'), 10),
    hour: parseInt(pick('hour'), 10),
    minute: parseInt(pick('minute'), 10)
  };
}

function _zonedLocalToUtcTimestamp(year, month, day, hour, minute, sourceTz) {
  const offsetMins = _parseTimezoneOffsetMinutes(sourceTz);
  if (offsetMins !== null) {
    return Date.UTC(year, month - 1, day, hour, minute, 0) - (offsetMins * 60 * 1000);
  }

  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const desired = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let i = 0; i < 4; i++) {
    const p = _formatPartsInTimezone(new Date(guess), sourceTz);
    const represented = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
    const diff = desired - represented;
    guess += diff;
    if (diff === 0) break;
  }
  return guess;
}

function convertTradeDateTimeBetweenZones(dateYmd, timeHm, fromTz, toTz) {
  if (!dateYmd || !timeHm || !fromTz || !toTz) {
    return { date: dateYmd || '', time: timeHm || '' };
  }

  const d = String(dateYmd).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const t = String(timeHm).match(/^(\d{2}):(\d{2})$/);
  if (!d || !t) return { date: dateYmd, time: timeHm };

  const utcMs = _zonedLocalToUtcTimestamp(
    parseInt(d[1], 10),
    parseInt(d[2], 10),
    parseInt(d[3], 10),
    parseInt(t[1], 10),
    parseInt(t[2], 10),
    fromTz
  );

  const parts = _formatPartsInTimezone(new Date(utcMs), toTz);
  return {
    date: `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
    time: `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
  };
}

function convertAllTradesToTradingTimezone(fromTz, toTz) {
  if (!Array.isArray(typeof TRADES !== 'undefined' ? TRADES : null) || fromTz === toTz) return;

  let changed = false;

  TRADES.forEach(trade => {
    if (!trade || !trade.date || !trade.time) return;

    const converted = convertTradeDateTimeBetweenZones(trade.date, trade.time, fromTz, toTz);
    if (!converted.date || !converted.time) return;

    const oldInferred = typeof inferSessionFromTradingTime === 'function'
      ? inferSessionFromTradingTime(trade.time)
      : (typeof inferSessionFromESTTime === 'function' ? inferSessionFromESTTime(trade.time) : '');
    const newInferred = typeof inferSessionFromTradingTime === 'function'
      ? inferSessionFromTradingTime(converted.time)
      : (typeof inferSessionFromESTTime === 'function' ? inferSessionFromESTTime(converted.time) : '');

    if (trade.date !== converted.date || trade.time !== converted.time) {
      trade.date = converted.date;
      trade.time = converted.time;
      changed = true;
    }

    if (!trade.session || trade.session === oldInferred) {
      if (trade.session !== newInferred) {
        trade.session = newInferred;
        changed = true;
      }
    }
  });

  if (changed && typeof saveTradesToStorage === 'function') saveTradesToStorage();
}

function refreshTimeDependentUI() {
  if (typeof applyFilters === 'function') applyFilters();
  if (typeof populateDashboard === 'function') populateDashboard();
  if (typeof initDailyPnlChart === 'function') initDailyPnlChart();
  if (typeof updateAnalyticsCards === 'function') updateAnalyticsCards();
  if (typeof initAnalyticsCharts === 'function') initAnalyticsCharts();
  if (typeof refreshAdvAnalytics === 'function') refreshAdvAnalytics();
  if (typeof currentDetailTrade !== 'undefined' && currentDetailTrade && typeof showDetail === 'function') {
    const row = document.querySelector(`.trade-table tbody tr[data-id="${currentDetailTrade.id}"]`) || document.createElement('tr');
    showDetail(currentDetailTrade, row);
  }
  if (typeof window._tickLiveClock === 'function') window._tickLiveClock();
}

// Infer trading session from entry time using fixed EST windows.
// Returns one of: Asia | True Day Open | London | NY AM | London Close | NY PM | Random
function inferSessionFromTradingTime(time24) {
  if (!time24 || typeof time24 !== 'string') return 'Random';
  const m = String(time24).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return 'Random';

  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(mm) || h < 0 || h > 23 || mm < 0 || mm > 59) return 'Random';

  const mins = h * 60 + mm;
  if (mins >= 19 * 60 && mins <= 23 * 60 + 59) return 'Asia';
  if (mins >= 0 && mins <= 1 * 60 + 59) return 'True Day Open';
  if (mins >= 2 * 60 && mins <= 4 * 60 + 59) return 'London';
  if (mins >= 7 * 60 && mins <= 9 * 60 + 59) return 'NY AM';
  if (mins >= 10 * 60 && mins <= 11 * 60 + 59) return 'London Close';
  if (mins >= 12 * 60 && mins <= 16 * 60) return 'NY PM';
  return 'Random';
}

function inferSessionFromESTTime(time24) {
  return inferSessionFromTradingTime(time24);
}

function applyAccentColor(hex) {
  const root = document.documentElement;
  const [r,g,b] = hexToRgb(hex);
  const rgb = r+','+g+','+b;

  // Core vars
  root.style.setProperty('--purple', hex);
  root.style.setProperty('--purple2', 'rgba('+rgb+',.12)');

  // All alpha tiers
  Object.entries(ACCENT_ALPHAS).forEach(function([varName, alpha]){
    root.style.setProperty(varName, 'rgba('+rgb+','+alpha+')');
  });
}

function setAccent(color, raw) {
  applyAccentColor(color);
  // Update swatch border to show selection
  document.querySelectorAll('[data-accent-swatch]').forEach(function(el){
    el.style.border = el.dataset.accentSwatch === raw
      ? '2.5px solid rgba(255,255,255,.9)'
      : '2px solid transparent';
  });
  saveSetting('accentColor', raw);
  showToast('Theme color updated', 'success', '🎨', 1600);
}

// ── REPORTS PAGE ──────────────────────────────────────────
function updateStorageUsageBar() {
  try {
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const val = localStorage.getItem(key) || '';
      totalBytes += key.length + val.length;
    }
    // localStorage cap is typically 5MB (5,242,880 bytes)
    const cap = 5 * 1024 * 1024;
    const pct = Math.min(100, (totalBytes / cap) * 100);
    const fill = document.getElementById('storage-usage-fill');
    const label = document.getElementById('storage-usage-label');
    if (fill) {
      fill.style.width = pct.toFixed(1) + '%';
      fill.style.background = pct > 85 ? 'var(--red)' : pct > 60 ? 'var(--amber)' : 'var(--green)';
    }
    const kb = (totalBytes / 1024).toFixed(0);
    const capKb = (cap / 1024).toFixed(0);
    if (label) label.textContent = kb + ' KB / ' + (cap/1024/1024).toFixed(0) + ' MB (' + pct.toFixed(0) + '%)';
    if (pct > 85) showStorageWarning();
  } catch(e) {}
}

function initReportsPage() {
  buildSnapshotCards();
  buildMonthlyTable();
  buildAccountTable();
  buildTopWorstTrades();
  buildSetupTable();
  buildAccountPicker();
}

// ── SCOPE SWITCHER ────────────────────────────────────────
let _expScope = 'all';

function setExpScope(scope) {
  _expScope = scope;
  ['all','account','daterange'].forEach(s => {
    const btn = $('exp-btn-' + s);
    if (!btn) return;
    if (s === scope) {
      btn.style.border = '1px solid var(--ac-50)';
      btn.style.background = 'var(--ac-18)';
      btn.style.color = 'var(--purple)';
      btn.style.fontWeight = '600';
    } else {
      btn.style.border = '1px solid var(--border)';
      btn.style.background = 'var(--bg5)';
      btn.style.color = 'var(--text2)';
      btn.style.fontWeight = '400';
    }
  });
  $('exp-account-picker').style.display = scope === 'account' ? 'flex' : 'none';
  $('exp-date-range').style.display     = scope === 'daterange' ? 'flex' : 'none';
}

// ── ACCOUNT PICKER ────────────────────────────────────────
let _expSelectedAccounts = new Set(); // empty = all accounts selected

function buildAccountPicker() {
  const el = $('exp-account-picker');
  if (!el) return;
  // Gather unique account names from trades
  const acctNames = [...new Set(TRADES.map(t => t.account || 'Unknown'))].sort();
  el.innerHTML = acctNames.map(name => {
    const count = TRADES.filter(t => (t.account||'Unknown') === name).length;
    const short = name.length > 28 ? name.substring(0,28)+'…' : name;
    const isSelected = _expSelectedAccounts.size === 0 || _expSelectedAccounts.has(name);
    return `<div id="exp-acct-btn-${btoa(name).replace(/=/g,'')}" onclick="toggleExpAccount('${name.replace(/'/g,"\'")}', this)"
      style="padding:7px 14px;border-radius:7px;font-size:11.5px;font-family:var(--font-body);cursor:pointer;transition:all .15s;
             border:1px solid ${isSelected?'var(--ac-50)':'var(--border)'};
             background:${isSelected?'var(--ac-14)':'var(--bg5)'};
             color:${isSelected?'var(--purple)':'var(--text2)'};
             display:flex;align-items:center;gap:7px">
      <span style="font-size:12px">${isSelected?'☑':'☐'}</span>
      <span>${short}</span>
      <span style="font-size:10px;color:${isSelected?'var(--ac-60)':'var(--text3)'};font-family:var(--font-mono);margin-left:2px">${count}</span>
    </div>`;
  }).join('');
}

function toggleExpAccount(name, el) {
  if (_expSelectedAccounts.has(name)) {
    _expSelectedAccounts.delete(name);
    el.style.border = '1px solid var(--border)';
    el.style.background = 'var(--bg5)';
    el.style.color = 'var(--text2)';
    el.querySelector('span:first-child').textContent = '☐';
    el.querySelector('span:last-child').style.color = 'var(--text3)';
  } else {
    _expSelectedAccounts.add(name);
    el.style.border = '1px solid var(--ac-50)';
    el.style.background = 'var(--ac-14)';
    el.style.color = 'var(--purple)';
    el.querySelector('span:first-child').textContent = '☑';
    el.querySelector('span:last-child').style.color = 'var(--ac-60)';
  }
}

// ── THEMED CALENDAR PICKER ────────────────────────────────
let _expCalTarget = null; // 'from' | 'to'
let _expCalViewYear = new Date().getFullYear();
let _expCalViewMonth = new Date().getMonth();
let _expDateFrom = null;
let _expDateTo   = null;

function toggleExpCal(target) {
  const popup = $('exp-calendar-popup');
  if (!popup) return;
  if (_expCalTarget === target && popup.style.display === 'block') {
    popup.style.display = 'none';
    _expCalTarget = null;
    return;
  }
  _expCalTarget = target;
  const ref = target === 'from' ? new Date(_expDateFrom || new Date()) : new Date(_expDateTo || new Date());
  if (_expDateFrom && target === 'to') { ref.setTime(new Date(_expDateTo || _expDateFrom).getTime()); }
  _expCalViewYear  = ref.getFullYear();
  _expCalViewMonth = ref.getMonth();
  renderExpCal();
  popup.style.display = 'block';
}

function renderExpCal() {
  const popup = $('exp-calendar-popup');
  if (!popup) return;
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const days   = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const y = _expCalViewYear, m = _expCalViewMonth;
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const selected = _expCalTarget === 'from' ? _expDateFrom : _expDateTo;

  let cells = '';
  // blank cells before first day
  for (let i=0; i<firstDay; i++) cells += `<div></div>`;
  for (let d=1; d<=daysInMonth; d++) {
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isSelected = dateStr === selected;
    const inRange = _expDateFrom && _expDateTo && dateStr >= _expDateFrom && dateStr <= _expDateTo;
    const isFrom  = dateStr === _expDateFrom;
    const isTo    = dateStr === _expDateTo;
    let bg = 'transparent', color = 'var(--text2)', border = 'none', radius = '7px';
    if (isSelected) { bg = 'var(--purple)'; color = '#fff'; }
    else if (isFrom || isTo) { bg = 'var(--ac-50)'; color = '#fff'; }
    else if (inRange) { bg = 'var(--ac-12)'; color = 'var(--purple)'; }
    cells += `<div onclick="selectExpCalDate('${dateStr}')"
      style="text-align:center;padding:6px 4px;border-radius:${radius};cursor:pointer;font-size:12px;
             background:${bg};color:${color};transition:background .1s;border:${border}"
      onmouseenter="if(this.style.background==='transparent'||this.style.background==='')this.style.background='var(--bg4)'"
      onmouseleave="if('${isSelected||inRange}'==='false')this.style.background='${bg}'">${d}</div>`;
  }

  popup.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <button onclick="expCalNav(-1)" style="background:var(--bg4);border:1px solid var(--border);border-radius:6px;width:26px;height:26px;cursor:pointer;color:var(--text2);font-size:12px;display:flex;align-items:center;justify-content:center;transition:all .15s" onmouseenter="this.style.color='var(--text)'" onmouseleave="this.style.color='var(--text2)'">‹</button>
      <div style="font-family:var(--font-display);font-weight:700;font-size:13px;color:var(--text)">${months[m]} ${y}</div>
      <button onclick="expCalNav(1)"  style="background:var(--bg4);border:1px solid var(--border);border-radius:6px;width:26px;height:26px;cursor:pointer;color:var(--text2);font-size:12px;display:flex;align-items:center;justify-content:center;transition:all .15s" onmouseenter="this.style.color='var(--text)'" onmouseleave="this.style.color='var(--text2)'">›</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:6px">
      ${days.map(d=>`<div style="text-align:center;font-size:9px;color:var(--text3);font-family:var(--font-mono);letter-spacing:.05em;padding:3px 0">${d}</div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">${cells}</div>
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
      <button onclick="clearExpCal()" style="font-size:11px;color:var(--text3);background:none;border:none;cursor:pointer;font-family:var(--font-mono)" onmouseenter="this.style.color='var(--red)'" onmouseleave="this.style.color='var(--text3)'">Clear</button>
      <button onclick="$('exp-calendar-popup').style.display='none';_expCalTarget=null" style="background:var(--purple);border:none;color:#fff;padding:5px 14px;border-radius:6px;cursor:pointer;font-size:11px;font-family:var(--font-body);font-weight:600">Done</button>
    </div>`;
}

function expCalNav(dir) {
  _expCalViewMonth += dir;
  if (_expCalViewMonth > 11) { _expCalViewMonth = 0; _expCalViewYear++; }
  if (_expCalViewMonth < 0)  { _expCalViewMonth = 11; _expCalViewYear--; }
  renderExpCal();
}

function selectExpCalDate(dateStr) {
  if (_expCalTarget === 'from') {
    _expDateFrom = dateStr;
    $('exp-date-from').value = dateStr;
    const lbl = $('exp-from-label');
    if (lbl) lbl.textContent = formatExpDate(dateStr);
    lbl.style.color = 'var(--text)';
    // auto-switch to 'to' picker if not set
    if (!_expDateTo) { _expCalTarget = 'to'; }
  } else {
    _expDateTo = dateStr;
    $('exp-date-to').value = dateStr;
    const lbl = $('exp-to-label');
    if (lbl) lbl.textContent = formatExpDate(dateStr);
    lbl.style.color = 'var(--text)';
  }
  // swap if from > to
  if (_expDateFrom && _expDateTo && _expDateFrom > _expDateTo) {
    [_expDateFrom, _expDateTo] = [_expDateTo, _expDateFrom];
    $('exp-date-from').value = _expDateFrom;
    $('exp-date-to').value   = _expDateTo;
    $('exp-from-label').textContent = formatExpDate(_expDateFrom);
    $('exp-to-label').textContent   = formatExpDate(_expDateTo);
  }
  // update range count
  updateExpRangeCount();
  renderExpCal();
}

function clearExpCal() {
  if (_expCalTarget === 'from') {
    _expDateFrom = null;
    $('exp-date-from').value = '';
    const lbl = $('exp-from-label');
    if (lbl) { lbl.textContent = 'Select date'; lbl.style.color = 'var(--text2)'; }
  } else {
    _expDateTo = null;
    $('exp-date-to').value = '';
    const lbl = $('exp-to-label');
    if (lbl) { lbl.textContent = 'Select date'; lbl.style.color = 'var(--text2)'; }
  }
  updateExpRangeCount();
  renderExpCal();
}

function formatExpDate(str) {
  if (!str) return 'Select date';
  const [y,m,d] = str.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m)-1]} ${parseInt(d)}, ${y}`;
}

function updateExpRangeCount() {
  const summary = $('exp-range-summary');
  const countEl = $('exp-range-count');
  if (!summary || !countEl) return;
  if (_expDateFrom || _expDateTo) {
    summary.style.display = 'block';
    let count = TRADES.length;
    if (_expDateFrom) count = TRADES.filter(t => t.date >= _expDateFrom).length;
    if (_expDateTo)   count = TRADES.filter(t => (!_expDateFrom || t.date >= _expDateFrom) && t.date <= _expDateTo).length;
    countEl.textContent = count;
  } else {
    summary.style.display = 'none';
  }
}

// Close calendar on outside click
document.addEventListener('click', e => {
  const popup = $('exp-calendar-popup');
  const fromBtn = $('exp-cal-from-display');
  const toBtn   = $('exp-cal-to-display');
  if (popup && popup.style.display === 'block') {
    if (!popup.contains(e.target) && e.target !== fromBtn && !fromBtn?.contains(e.target) && e.target !== toBtn && !toBtn?.contains(e.target)) {
      popup.style.display = 'none';
      _expCalTarget = null;
    }
  }
});

function getExportTrades() {
  let trades = [...TRADES];
  if (_expScope === 'account') {
    if (_expSelectedAccounts.size > 0) {
      trades = trades.filter(t => _expSelectedAccounts.has(t.account || 'Unknown'));
    }
    // if none selected, return all
  } else if (_expScope === 'daterange') {
    const from = $('exp-date-from')?.value;
    const to   = $('exp-date-to')?.value;
    if (from) trades = trades.filter(t => t.date >= from);
    if (to)   trades = trades.filter(t => t.date <= to);
  }
  return trades;
}

function exportReport(fmt) {
  const trades = getExportTrades();
  const now = new Date().toISOString().split('T')[0];
  if (fmt === 'json') {
    const blob = new Blob([JSON.stringify({ exportDate: now, totalTrades: trades.length, trades }, null, 2)], { type: 'application/json' });
    dlBlob(blob, `equity-trace-${now}.json`);
    showToast('JSON export ready', 'success', '🗂️');
  } else if (fmt === 'csv') {
    const headers = ['ID','Date','Time','Symbol','Type','Direction','Entry','Exit','Size','SL','TP','Commission','P&L','Setup','Session','Model','Rating','Account','Notes'];
    const rows = trades.map(t => [
      t.id, t.date, t.time||'', t.symbol, t.type, t.dir,
      t.entry, t.exit, t.size, t.sl||'', t.tp||'',
      t.comm, t.pnl, t.setup||'', t.session||'', t.model||'',
      t.rating||'', t.account||'',
      (t.notes||'').replace(/,/g,' ').replace(/\n/g,' ')
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    dlBlob(new Blob([csv], { type: 'text/csv' }), `equity-trace-${now}.csv`);
    showToast('CSV export ready', 'success', '');
  } else if (fmt === 'md') {
    const T = trades;
    const net = T.reduce((s,t) => s+t.pnl, 0);
    const wins = T.filter(t => t.pnl > 0);
    const wr = T.length ? ((wins.length/T.length)*100).toFixed(1) : '0.0';
    let md = `# Equity Trace — Trading Report\n_Exported: ${now}_\n\n`;
    md += `## Summary\n| Metric | Value |\n|---|---|\n`;
    md += `| Total Trades | ${T.length} |\n`;
    md += `| Net P&L | ${net >= 0 ? '+' : ''}$${net.toFixed(2)} |\n`;
    md += `| Win Rate | ${wr}% |\n`;
    md += `| Winners | ${wins.length} |\n`;
    md += `| Losers | ${T.length - wins.length} |\n\n`;
    md += `## Trade Log\n| Date | Symbol | Dir | Entry | Exit | P&L | Setup | Account |\n|---|---|---|---|---|---|---|---|\n`;
    T.forEach(t => {
      md += `| ${t.date} | ${t.symbol} | ${t.dir.toUpperCase()} | ${t.entry} | ${t.exit} | ${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)} | ${t.setup||'-'} | ${t.account||'-'} |\n`;
    });
    dlBlob(new Blob([md], { type: 'text/markdown' }), `equity-trace-${now}.md`);
    showToast('Markdown export ready', 'success', '');
  } else if (fmt === 'html') {
    const T = trades;
    const net = T.reduce((s,t) => s+t.pnl, 0);
    const wins = T.filter(t => t.pnl > 0);
    const wr = T.length ? ((wins.length/T.length)*100).toFixed(1) : '0.0';
    const avgWin  = wins.length ? (wins.reduce((s,t)=>s+t.pnl,0)/wins.length).toFixed(2) : '0.00';
    const losses  = T.filter(t => t.pnl < 0);
    const avgLoss = losses.length ? (Math.abs(losses.reduce((s,t)=>s+t.pnl,0)/losses.length)).toFixed(2) : '0.00';
    const prof = loadProfile();
    const rows = T.map(t => `<tr style="border-bottom:1px solid #222">
      <td style="padding:8px 10px;color:#999">${t.date}</td>
      <td style="padding:8px 10px;font-weight:600">${t.symbol}</td>
      <td style="padding:8px 10px;color:${t.dir==='long'?'#2ecc8a':'#e8504a'};text-transform:uppercase;font-size:11px">${t.dir}</td>
      <td style="padding:8px 10px;color:#aaa">${t.entry}</td>
      <td style="padding:8px 10px;color:#aaa">${t.exit}</td>
      <td style="padding:8px 10px;font-weight:700;color:${t.pnl>=0?'#2ecc8a':'#e8504a'}">${t.pnl>=0?'+':''}$${t.pnl.toFixed(2)}</td>
      <td style="padding:8px 10px;color:#888">${t.setup||'—'}</td>
      <td style="padding:8px 10px;color:#888">${t.account||'—'}</td>
    </tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Equity Trace Report — ${now}</title>
    <style>body{background:#0a0b10;color:#dde1ef;font-family:system-ui,sans-serif;padding:40px;max-width:1100px;margin:0 auto}
    h1{font-size:26px;margin-bottom:4px}p{color:#666;margin-bottom:32px}
    .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:36px}
    .stat{background:#111318;border:1px solid var(--ac-20);border-radius:10px;padding:16px 18px}
    .stat-label{font-size:10px;color:#4a5068;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px}
    .stat-val{font-size:22px;font-weight:700}
    table{width:100%;border-collapse:collapse;background:#111318;border-radius:10px;overflow:hidden}
    th{padding:10px 10px;font-size:10px;letter-spacing:.1em;color:#4a5068;text-transform:uppercase;text-align:left;background:#0d0e14;border-bottom:1px solid #1e2030}
    </style></head><body>
    <h1>Equity Trace — Trading Report</h1>
    <p>Generated ${now}${prof.name ? ' · ' + prof.name : ''}</p>
    <div class="stats">
      <div class="stat"><div class="stat-label">Net P&amp;L</div><div class="stat-val" style="color:${net>=0?'#2ecc8a':'#e8504a'}">${net>=0?'+':''}$${net.toFixed(2)}</div></div>
      <div class="stat"><div class="stat-label">Win Rate</div><div class="stat-val" style="color:var(--purple)">${wr}%</div></div>
      <div class="stat"><div class="stat-label">Avg Win</div><div class="stat-val" style="color:#2ecc8a">+$${avgWin}</div></div>
      <div class="stat"><div class="stat-label">Avg Loss</div><div class="stat-val" style="color:#e8504a">-$${avgLoss}</div></div>
    </div>
    <table><thead><tr><th>Date</th><th>Symbol</th><th>Dir</th><th>Entry</th><th>Exit</th><th>P&amp;L</th><th>Setup</th><th>Account</th></tr></thead>
    <tbody>${rows}</tbody></table>
/* ─── DASHBOARD EQUITY CURVE ─── */
(function(){
  let _ecChart = null;
  let _ecPeriod = 'month';

  window.dashEcPeriod = function(btn, period){
    _ecPeriod = period;
    $$('#dash-ec-pills .aa-pill').forEach(b=>b.classList.remove('aa-pill-active'));
    btn.classList.add('aa-pill-active');
    renderDashEc();
  };

  function getTrades(period){
    const all = (typeof TRADES !== "undefined" ? TRADES : (window.TRADES || []));
    const now = new Date();
    if(period === 'week'){
      const ws = new Date(now); ws.setDate(now.getDate() - now.getDay());
      return all.filter(t => new Date(t.date) >= ws);
    }
    if(period === 'month'){
      const ms = new Date(now.getFullYear(), now.getMonth(), 1);
      return all.filter(t => new Date(t.date) >= ms);
    }
    return all;
  }

  function renderDashEc(){
    const canvas = $('dash-ec-chart');
    const emptyEl = $('dash-ec-empty');
    const badgeEl = $('dash-ec-badge');
    const pnlEl   = $('dash-ec-pnl');
    if(!canvas) return;

    const trades = getTrades(_ecPeriod).slice().sort((a,b)=>a.date.localeCompare(b.date)||(a.id>b.id?1:-1));

    if(!trades.length){
      canvas.style.display = 'none';
      if(emptyEl){ emptyEl.style.display='flex'; }
      if(badgeEl) badgeEl.textContent = '0 trades';
      if(pnlEl){ pnlEl.textContent=''; }
      return;
    }

    canvas.style.display = 'block';
    if(emptyEl) emptyEl.style.display='none';

    // Build cumulative P&L series
    let cum = 0;
    const labels = [];
    const data   = [];
    trades.forEach(t => {
      cum += (t.pnl || 0);
      labels.push(t.date.slice(5));   // MM-DD
      data.push(+cum.toFixed(2));
    });

    const net = data[data.length-1] || 0;
    const isPos = net >= 0;
    const color = isPos ? '#2ecc8a' : '#e8504a';
    const colorFade = isPos ? 'rgba(46,204,138,0)' : 'rgba(232,80,74,0)';
    const colorMid  = isPos ? 'rgba(46,204,138,0.18)' : 'rgba(232,80,74,0.18)';

    if(badgeEl) badgeEl.textContent = trades.length + ' trades';
    if(pnlEl){
      pnlEl.textContent = (net>=0?'+$':'-$') + Math.abs(net).toFixed(2);
      pnlEl.style.color = color;
    }

    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0,0,0,160);
    grad.addColorStop(0, colorMid);
    grad.addColorStop(1, colorFade);

    if(_ecChart){ _ecChart.destroy(); _ecChart=null; }

    _ecChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets:[{
          data,
          borderColor: color,
          borderWidth: 2,
          backgroundColor: grad,
          fill: true,
          tension: 0.38,
          pointRadius: trades.length > 60 ? 0 : 3,
          pointHoverRadius: 5,
          pointBackgroundColor: color,
          pointBorderColor: document.documentElement.classList.contains('light') ? '#ffffff' : '#121419',
          pointBorderWidth: 2,
        }]
      },
      options:{
        responsive: true,
        maintainAspectRatio: false,
        animation:{ duration: 600, easing:'easeOutCubic' },
        interaction:{ mode:'index', intersect:false },
        plugins:{
          legend:{ display:false },
          tooltip:{
            backgroundColor:'var(--bg2)',
            borderColor:'var(--ac-30)',
            borderWidth:1,
            titleColor:'var(--text3)',
            bodyColor: color,
            titleFont:{ family:'JetBrains Mono', size:9 },
            bodyFont:{ family:'JetBrains Mono', size:12 },
            callbacks:{
              label: ctx => (ctx.raw>=0?'+$':'-$')+Math.abs(ctx.raw).toFixed(2)
            }
          }
        },
        scales:{
          x:{
            grid:{ display:false },
            border:{ display:false },
            ticks:{
              color:'rgba(160,168,190,.4)',
              font:{ family:'JetBrains Mono', size:8 },
              maxTicksLimit: 8,
              maxRotation: 0,
            }
          },
          y:{
            grid:{ color:'rgba(255,255,255,.04)', drawBorder:false },
            border:{ display:false, dash:[3,3] },
            ticks:{
              color:'rgba(160,168,190,.4)',
              font:{ family:'JetBrains Mono', size:8 },
              callback: v => (v>=0?'+$':'-$')+Math.abs(v)
            }
          }
        }
      }
    });
  }

  // Hook into refreshDashboard or applyFilters to re-render
  const origRefresh = window.refreshDashboard;
  window.refreshDashboard = function(){
    if(typeof origRefresh==='function') origRefresh.apply(this, arguments);
    setTimeout(renderDashEc, 50);
  };

  // Also render on initial load
  document.addEventListener('DOMContentLoaded', ()=> setTimeout(renderDashEc, 600));
  // Re-render when trades change
  const origSave = window.saveTrade;
  if(origSave){
    window.saveTrade = function(){
      const r = origSave.apply(this,arguments);
      setTimeout(renderDashEc, 100);
      return r;
    };
  }
  // Expose for external refresh
  window.renderDashEc = renderDashEc;
})();


/* ─── BACK TO TOP ─── */
(function(){
  const btn = $('back-to-top');
  if(!btn) return;
  window.addEventListener('scroll', ()=>{
    btn.classList.toggle('visible', window.scrollY > 400);
  }, { passive:true });
})();

/* ─── CMD+K COMMAND PALETTE ─── */
(function(){
  const VIEWS = [
    {icon:'📊', label:'Dashboard',          sub:'Overview & stats',       view:'dashboard'},
    {icon:'📋', label:'Trade Journal',      sub:'All your trades',        view:'tradelog'},
    {icon:'📈', label:'Analytics',          sub:'Charts & heatmap',       view:'analytics'},
    {icon:'🔬', label:'Advanced Analytics', sub:'Equity curve & streaks', view:'advanalytics'},
    {icon:'📖', label:'Entry Models',           sub:'Your trading rules',     view:'playbook'},
    {icon:'📅', label:'Calendar',           sub:'Calendar view',          view:'calendar'},
    {icon:'📑', label:'Reports',            sub:'Monthly summaries',      view:'reports'},
    {icon:'⚙️',  label:'Settings',           sub:'Preferences',            view:'settings'},
  ];
  const VIEW_SHORTCUT = {dashboard:'D',tradelog:'J',analytics:'A',advanalytics:'V',playbook:'P',calendar:'C',reports:'R',settings:'S'};
  let _sel = 0;
  let _items = [];

  window.openCmdK = function(){
    const ov = $('cmdk-overlay');
    const inp = $('cmdk-input');
    if(!ov||!inp) return;
    ov.classList.add('open');
    inp.value = '';
    window.cmdkSearch('');
    setTimeout(()=>inp.focus(), 30);
  };
  window.closeCmdK = function(){
    const ov = $('cmdk-overlay');
    if(ov) ov.classList.remove('open');
  };

  /* Build results using DOM to avoid template literal / quote escaping issues */
  window.cmdkSearch = function(q){
    const q2 = q.toLowerCase().trim();
    const res = $('cmdk-results');
    if(!res) return;
    _sel = 0;
    _items = [];
    res.innerHTML = '';

    const views = VIEWS.filter(v=>!q2||v.label.toLowerCase().includes(q2)||v.sub.toLowerCase().includes(q2));
    const allTrades = (typeof TRADES !== 'undefined' ? TRADES : (window.TRADES||[]));
    const trades = allTrades.filter(t=>{
      if(!q2) return false;
      return t.symbol.toLowerCase().includes(q2)||
             (t.setup||'').toLowerCase().includes(q2)||
             (t.notes||'').toLowerCase().includes(q2);
    }).slice(0,5);

    function makeItem(type, data, primary, secondary, iconContent, shortcut){
      const idx = _items.length;
      _items.push({type, data});
      const row = document.createElement('div');
      row.className = 'cmdk-item' + (idx===0?' cmdk-sel':'');
      row.dataset.cmdki = idx;
      row.onclick = ()=>window.cmdkExecute(idx);

      const icon = document.createElement('div');
      icon.className = 'cmdk-item-icon';
      icon.textContent = iconContent;
      row.appendChild(icon);

      const text = document.createElement('div');
      text.style.flex = '1';
      const lbl = document.createElement('div');
      lbl.className = 'cmdk-item-label';
      lbl.textContent = primary;
      const sub = document.createElement('div');
      sub.className = 'cmdk-item-sub';
      sub.textContent = secondary;
      text.appendChild(lbl);
      text.appendChild(sub);
      row.appendChild(text);

      if(shortcut){
        const kbd = document.createElement('kbd');
        kbd.style.cssText = 'margin-left:auto;background:var(--bg4);border:1px solid var(--border2);border-radius:4px;padding:2px 6px;font-family:var(--font-mono);font-size:9px;color:var(--purple)';
        kbd.textContent = shortcut;
        row.appendChild(kbd);
      }
      return row;
    }

    if(views.length){
      const grp = document.createElement('div');
      grp.className = 'cmdk-group-label';
      grp.textContent = 'Navigate';
      res.appendChild(grp);
      views.forEach(v=>{
        res.appendChild(makeItem('view', v, v.label, v.sub, v.icon, VIEW_SHORTCUT[v.view]||''));
      });
    }
    if(trades.length){
      const grp = document.createElement('div');
      grp.className = 'cmdk-group-label';
      grp.textContent = 'Trades';
      res.appendChild(grp);
      trades.forEach(t=>{
        const pnl = t.pnl||0;
        const pnlStr = (pnl>=0?'+$':'-$')+Math.abs(pnl).toFixed(2);
        const sub = (t.setup||'—') + ' · ' + pnlStr;
        const row = makeItem('trade', t, t.symbol+' · '+t.date, sub, t.symbol.slice(0,3), '');
        /* colour the P&L part in the sub label */
        const subEl = row.querySelector('.cmdk-item-sub');
        if(subEl){
          subEl.innerHTML = '';
          const sp1 = document.createElement('span'); sp1.textContent = (t.setup||'—') + ' · ';
          const sp2 = document.createElement('span'); sp2.textContent = pnlStr;
          sp2.style.color = pnl>=0 ? 'var(--green)' : 'var(--red)';
          subEl.appendChild(sp1); subEl.appendChild(sp2);
        }
        const icon = row.querySelector('.cmdk-item-icon');
        if(icon){ icon.style.fontSize='10px'; icon.style.fontFamily='var(--font-mono)'; icon.style.fontWeight='700'; }
        res.appendChild(row);
      });
    }
    if(!_items.length){
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:24px;text-align:center;font-size:12px;color:var(--text3);font-family:var(--font-mono)';
      empty.textContent = 'No results';
      res.appendChild(empty);
    }
  };

  window.cmdkKey = function(e){
    const res2 = $('cmdk-results');
    const all = res2 ? Array.from(res2.querySelectorAll('.cmdk-item')) : [];
    if(!all.length) return;
    if(e.key==='ArrowDown'){e.preventDefault();_sel=Math.min(_sel+1,all.length-1);}
    else if(e.key==='ArrowUp'){e.preventDefault();_sel=Math.max(_sel-1,0);}
    else if(e.key==='Enter'){e.preventDefault();window.cmdkExecute(_sel);return;}
    else if(e.key==='Escape'){window.closeCmdK();return;}
    all.forEach(function(it,i){it.classList.toggle('cmdk-sel',i===_sel);});
    if(all[_sel]) all[_sel].scrollIntoView({block:'nearest'});
  };

  window.cmdkExecute = function(idx){
    const item = _items[idx]; if(!item) return;
    window.closeCmdK();
    if(item.type==='view'){
      const nav = document.querySelector('[data-view="'+item.data.view+'"]');
      if(nav) nav.click();
    } else if(item.type==='trade'){
      const nav = document.querySelector('[data-view="tradelog"]');
      if(nav) nav.click();
      setTimeout(()=>{
        const row = document.querySelector('.trade-table tbody tr[data-id="'+item.data.id+'"]');
        if(row){ row.click(); row.scrollIntoView({behavior:'smooth',block:'center'}); }
      }, 300);
    }
  };

  /* Cmd+K / Ctrl+K global trigger */
  document.addEventListener('keydown', function(e){
    if((e.ctrlKey||e.metaKey)&&e.key==='k'){
      e.preventDefault();
      const ov = $('cmdk-overlay');
      if(ov&&ov.classList.contains('open')) window.closeCmdK();
      else window.openCmdK();
    }
  });
})();

</body></html>`;
    dlBlob(new Blob([html], { type: 'text/html' }), `equity-trace-report-${now}.html`);
    showToast('HTML report ready', 'success', '');
  }
}

function dlBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── SNAPSHOT ACCOUNT FILTER ──────────────────────────────
let _snapAccount = '__all__';

function buildSnapshotAccountBtns() {
  const container = $('snap-acct-btns');
  if (!container) return;
  const acctNames = [...new Set(TRADES.map(t => t.account || 'Unknown'))].sort();
  container.innerHTML = '';
  acctNames.forEach(name => {
    const short = name
      .replace('FTM Prop Firm - ', '')
      .replace('Apex Trader - ', 'Apex ')
      .replace('GOAT - ', 'GOAT ');
    const btn = document.createElement('button');
    // Add logo + text
    const logoUrl = getFirmLogo(name);
    if (logoUrl) {
      const img = document.createElement('img');
      img.src = logoUrl;
      img.alt = '';
      img.style.cssText = 'width:14px;height:14px;object-fit:contain;vertical-align:middle;margin-right:4px;border-radius:3px';
      img.onerror = () => img.remove();
      btn.appendChild(img);
    }
    btn.appendChild(document.createTextNode(short));
    btn.dataset.acct = name;
    btn.style.cssText = 'padding:5px 13px;border-radius:20px;font-size:11px;font-family:var(--font-body);cursor:pointer;transition:all .15s;border:1px solid var(--border);background:var(--bg4);color:var(--text2);white-space:nowrap';
    btn.addEventListener('mouseenter', () => {
      if (btn.dataset.acct !== _snapAccount) btn.style.borderColor = 'var(--border2)';
    });
    btn.addEventListener('mouseleave', () => {
      if (btn.dataset.acct !== _snapAccount) btn.style.borderColor = 'var(--border)';
    });
    btn.addEventListener('click', () => setSnapAccount(name, btn));
    container.appendChild(btn);
  });
}
function setSnapAccount(name, clickedBtn) {
  _snapAccount = name;
  // Reset all buttons style
  const allBtn = $('snap-acct-btn-all');
  if (allBtn) {
    if (name === '__all__') {
      allBtn.style.border = '1px solid var(--ac-50)';
      allBtn.style.background = 'var(--ac-18)';
      allBtn.style.color = 'var(--purple)';
      allBtn.style.fontWeight = '600';
    } else {
      allBtn.style.border = '1px solid var(--border)';
      allBtn.style.background = 'var(--bg4)';
      allBtn.style.color = 'var(--text2)';
      allBtn.style.fontWeight = '400';
    }
  }
  $$('#snap-acct-btns button').forEach(btn => {
    const isActive = btn.dataset.acct === name;
    btn.style.border     = isActive ? '1px solid var(--ac-50)' : '1px solid var(--border)';
    btn.style.background = isActive ? 'var(--ac-18)' : 'var(--bg4)';
    btn.style.color      = isActive ? 'var(--purple)' : 'var(--text2)';
    btn.style.fontWeight = isActive ? '600' : '400';
  });
  buildSnapshotCards();
}

function buildSnapshotCards() {
  const el = $('rpt-snapshot');
  if (!el) return;
  // Build account buttons first if not yet done
  if (!document.querySelector('#snap-acct-btns button')) buildSnapshotAccountBtns();

  // Filter trades — compare trimmed strings to avoid whitespace mismatches
  const T = _snapAccount === '__all__'
    ? TRADES
    : TRADES.filter(t => (t.account || '').trim() === _snapAccount.trim());

  // Get account size for % calcs
  let acctSize = 0;
  if (_snapAccount === '__all__') {
    acctSize = (typeof ACCOUNTS !== 'undefined' ? ACCOUNTS : []).reduce((s,a) => s + (a.startBal||0), 0) || 25000;
  } else {
    const matched = (typeof ACCOUNTS !== 'undefined' ? ACCOUNTS : []).find(a => {
      const n = (a.key || a.phase).trim();
      return n === _snapAccount.trim();
    });
    acctSize = matched?.startBal || 25000;
  }

  const net    = T.reduce((s,t) => s+t.pnl, 0);
  const wins   = T.filter(t => t.pnl > 0);
  const losses = T.filter(t => t.pnl < 0);
  const be     = T.filter(t => t.pnl === 0);
  const wr     = T.length ? ((wins.length/T.length)*100).toFixed(1) : '0.0';
  const avgWVal  = wins.length   ? wins.reduce((s,t)=>s+t.pnl,0)/wins.length   : 0;
  const avgLVal  = losses.length ? Math.abs(losses.reduce((s,t)=>s+t.pnl,0)/losses.length) : 0;
  const avgW = avgWVal.toFixed(2);
  const avgL = avgLVal.toFixed(2);
  const pf   = losses.length && avgLVal > 0 ? (avgWVal/avgLVal).toFixed(2) : '∞';
  const netPct  = acctSize ? ((net/acctSize)*100).toFixed(2) : null;
  const bestPnl  = wins.length   ? Math.max(...wins.map(t=>t.pnl))   : null;
  const worstPnl = losses.length ? Math.min(...losses.map(t=>t.pnl)) : null;
  const bestPct  = bestPnl  != null && acctSize ? ((bestPnl/acctSize)*100).toFixed(2)          : null;
  const worstPct = worstPnl != null && acctSize ? ((Math.abs(worstPnl)/acctSize)*100).toFixed(2) : null;
  const avgWPct  = acctSize ? ((avgWVal/acctSize)*100).toFixed(2) : null;
  const avgLPct  = acctSize ? ((avgLVal/acctSize)*100).toFixed(2) : null;
  const totalComm = T.reduce((s,t) => s+(t.comm||0), 0);

  const card = (label, val, color, sub, subColor) => `
    <div style="background:var(--bg4);border:1px solid var(--border);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:4px">
      <div style="font-size:9px;letter-spacing:.12em;color:var(--text3);font-family:var(--font-mono);text-transform:uppercase">${label}</div>
      <div style="font-family:var(--font-display);font-weight:700;font-size:20px;color:${color};line-height:1.1">${val}</div>
      ${sub ? `<div style="font-size:10px;color:${subColor||'var(--text3)'};font-family:var(--font-mono);margin-top:1px">${sub}</div>` : ''}
    </div>`;

  el.style.gridTemplateColumns = 'repeat(4,1fr)';
  el.innerHTML = [
    card('Net P&L',
      (net>=0?'+':'') + '$' + net.toFixed(2),
      net>=0 ? 'var(--green)' : 'var(--red)',
      netPct != null ? (net>=0?'+':'-') + Math.abs(netPct) + '% of account' : null,
      net>=0 ? 'var(--green)' : 'var(--red)'
    ),
    card('Win Rate',
      wr + '%',
      'var(--purple)',
      `${wins.length}W · ${losses.length}L${be.length ? ' · '+be.length+'BE' : ''}`,
      'var(--text3)'
    ),
    card('Total Trades',
      T.length,
      'var(--text)',
      T.length ? `${(T.length / Math.max(1, [...new Set(T.map(t=>t.date))].length)).toFixed(1)} trades/day avg` : null,
      'var(--text3)'
    ),
    card('Profit Factor',
      pf,
      parseFloat(pf) >= 1 ? 'var(--green)' : 'var(--red)',
      parseFloat(pf) >= 2 ? 'Excellent' : parseFloat(pf) >= 1.5 ? 'Strong' : parseFloat(pf) >= 1 ? 'Break-even zone' : 'Losing',
      parseFloat(pf) >= 1.5 ? 'var(--green)' : parseFloat(pf) >= 1 ? 'var(--amber)' : 'var(--red)'
    ),
    card('Avg Win',
      '+$' + avgW,
      'var(--green)',
      avgWPct ? '+' + avgWPct + '% per trade' : null,
      'var(--green)'
    ),
    card('Avg Loss',
      '-$' + avgL,
      'var(--red)',
      avgLPct ? '-' + avgLPct + '% per trade' : null,
      'var(--red)'
    ),
    card('Best Trade',
      bestPnl != null ? '+$' + bestPnl.toFixed(2) : '—',
      'var(--green)',
      bestPct ? '+' + bestPct + '% of account' : null,
      'var(--green)'
    ),
    card('Worst Trade',
      worstPnl != null ? '-$' + Math.abs(worstPnl).toFixed(2) : '—',
      'var(--red)',
      worstPct ? '-' + worstPct + '% of account' : null,
      'var(--red)'
    ),
    card('Total Commission',
      '-$' + totalComm.toFixed(2),
      'var(--amber)',
      T.length ? '-$' + (totalComm/T.length).toFixed(2) + ' avg per trade' : null,
      'var(--text3)'
    ),
    card('Expectancy',
      (() => {
        if (!T.length) return '—';
        const exp = (wins.length/T.length * avgWVal) - (losses.length/T.length * avgLVal);
        return (exp>=0?'+':'') + '$' + exp.toFixed(2);
      })(),
      (() => {
        if (!T.length) return 'var(--text)';
        const exp = (wins.length/T.length * avgWVal) - (losses.length/T.length * avgLVal);
        return exp >= 0 ? 'var(--green)' : 'var(--red)';
      })(),
      'per trade expectancy',
      'var(--text3)'
    ),
    card('Net P&L %',
      netPct != null ? (net>=0?'+':'-') + Math.abs(netPct) + '%' : '—',
      net>=0 ? 'var(--green)' : 'var(--red)',
      `vs $${acctSize.toLocaleString()} account`,
      'var(--text3)'
    ),
    card('Win/Loss Ratio',
      avgLVal > 0 ? (avgWVal/avgLVal).toFixed(2)+'R' : '—',
      avgWVal >= avgLVal ? 'var(--green)' : 'var(--amber)',
      avgWVal >= avgLVal ? 'Favourable ratio' : 'Losses outsize wins',
      avgWVal >= avgLVal ? 'var(--green)' : 'var(--amber)'
    ),
  ].join('');
  // 3 columns for 12 cards
  el.style.gridTemplateColumns = 'repeat(4,1fr)';
}

function buildMonthlyTable() {
  const el = $('rpt-monthly-table');
  if (!el) return;

  const acctNames   = [...new Set(TRADES.map(t => t.account || 'Unknown'))].sort();
  const acctColors  = ['var(--purple)','var(--blue)','var(--amber)','var(--green)','var(--red)'];
  const acctColorMap = {};
  acctNames.forEach((a,i) => acctColorMap[a] = acctColors[i % acctColors.length]);
  const shortName = n => n.replace('FTM Prop Firm - ','').replace('Apex Trader - ','Apex ').replace('GOAT - ','GOAT ');

  const monthMap = {};
  TRADES.forEach(t => {
    const m = t.date.substring(0,7), a = t.account || 'Unknown';
    if (!monthMap[m]) monthMap[m] = {};
    if (!monthMap[m][a]) monthMap[m][a] = { pnl:0, trades:0, wins:0 };
    monthMap[m][a].pnl += t.pnl; monthMap[m][a].trades++;
    if (t.pnl > 0) monthMap[m][a].wins++;
  });

  const months = Object.keys(monthMap).sort().reverse();
  if (!months.length) { el.innerHTML = '<div style="color:var(--text3);font-size:12px;font-family:var(--font-mono);text-align:center;padding:20px">No data yet</div>'; return; }

  const headerCols = `1fr ${acctNames.map(()=>'90px').join(' ')} 90px 52px`;
  const headerRow = `<div style="display:grid;grid-template-columns:${headerCols};gap:4px;padding:5px 10px 8px;font-size:9px;letter-spacing:.1em;color:var(--text3);font-family:var(--font-mono);text-transform:uppercase;border-bottom:1px solid var(--border);margin-bottom:4px">
    <span>Month</span>
    ${acctNames.map(a=>{
      const u=getFirmLogo(a);
      const img = u ? `<img src="${u}" style="width:10px;height:10px;object-fit:contain;border-radius:2px;vertical-align:middle;margin-right:3px" onerror="this.remove()">` : '';
      return `<span style="text-align:right;color:${acctColorMap[a]};opacity:.8">${img}${shortName(a)}</span>`;
    }).join('')}
    <span style="text-align:right">Total</span><span style="text-align:center">Win%</span>
  </div>`;

  const renderRow = m => {
    const [y,mo] = m.split('-');
    const label  = new Date(y, parseInt(mo)-1, 1).toLocaleString('en-US',{month:'short',year:'numeric'});
    const all    = Object.values(monthMap[m]);
    const tPnl   = all.reduce((s,d)=>s+d.pnl,0);
    const tT     = all.reduce((s,d)=>s+d.trades,0);
    const tW     = all.reduce((s,d)=>s+d.wins,0);
    const wr     = tT ? ((tW/tT)*100).toFixed(0) : 0;
    const cells  = acctNames.map(a => {
      const d = monthMap[m][a];
      if (!d) return `<span style="text-align:right;font-size:11px;color:var(--text4);font-family:var(--font-mono)">—</span>`;
      return `<span style="text-align:right;font-size:11.5px;font-weight:600;font-family:var(--font-mono);color:${d.pnl>=0?'var(--green)':'var(--red)'}">${d.pnl>=0?'+':''}$${d.pnl.toFixed(2)}</span>`;
    }).join('');
    return `<div style="display:grid;grid-template-columns:${headerCols};gap:4px;padding:8px 10px;border-radius:7px;background:var(--bg4);align-items:center;margin-bottom:3px">
      <span style="font-size:12px;font-weight:600;color:var(--text2)">${label}</span>
      ${cells}
      <span style="font-size:12px;font-weight:700;text-align:right;color:${tPnl>=0?'var(--green)':'var(--red)'}">${tPnl>=0?'+':''}$${tPnl.toFixed(2)}</span>
      <span style="font-size:11px;color:var(--text3);text-align:center;font-family:var(--font-mono)">${wr}%</span>
    </div>`;
  };

  // State: collapsed=6, expanded=12, paginated beyond 12
  const total = months.length;
  const show6  = months.slice(0,6);
  const show12 = months.slice(0,12);

  // Determine initial view based on _monthlyExpanded state
  const expanded  = window._monthlyExpanded || false;
  const visible   = expanded ? show12 : show6;

  el.innerHTML = headerRow + visible.map(renderRow).join('');

  // Badge + expand button
  const badge = $('rpt-monthly-badge');
  const btn   = $('rpt-monthly-expand-btn');
  if (badge && total > 6) {
    badge.textContent = `${total} months total`;
    badge.style.display = 'inline-block';
  }
  if (btn) {
    if (total > 6 && !expanded) {
      btn.style.display = 'inline-block';
      btn.textContent = `Show 12 months ▾`;
    } else if (total > 6 && expanded && total <= 12) {
      btn.style.display = 'inline-block';
      btn.textContent = `Show less ▴`;
    } else if (total > 12 && expanded) {
      btn.style.display = 'inline-block';
      btn.textContent = `Show all months ▾`;
    } else {
      btn.style.display = 'none';
    }
  }

  // Pagination panel (13+ months)
  const pagesEl = $('rpt-monthly-pages');
  if (pagesEl) pagesEl.style.display = 'none';

  // Store data for pagination
  window._monthlyAllMonths = months;
  window._monthlyHeaderRow = headerRow;
  window._monthlyRenderRow = renderRow;
  window._monthlyPage      = 0;
}

function toggleMonthlyExpand() {
  window._monthlyExpanded = !window._monthlyExpanded;
  const months = window._monthlyAllMonths || [];
  if (window._monthlyExpanded && months.length > 12) {
    // Show paginated subpanel
    window._monthlyPage = 0;
    renderMonthlyPage();
    const pagesEl = $('rpt-monthly-pages');
    if (pagesEl) pagesEl.style.display = 'block';
    const btn = $('rpt-monthly-expand-btn');
    if (btn) btn.textContent = 'Show less ▴';
  } else {
    const pagesEl = $('rpt-monthly-pages');
    if (pagesEl) pagesEl.style.display = 'none';
    buildMonthlyTable();
  }
}

function renderMonthlyPage() {
  const PAGE_SIZE = 12;
  const months    = window._monthlyAllMonths || [];
  const page      = window._monthlyPage || 0;
  const start     = page * PAGE_SIZE;
  const slice     = months.slice(start, start + PAGE_SIZE);
  const total     = months.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const el = $('rpt-monthly-page-table');
  const label = $('rpt-monthly-page-label');
  const prev  = $('rpt-monthly-prev');
  const next  = $('rpt-monthly-next');

  if (!el) return;
  el.innerHTML = (window._monthlyHeaderRow || '') + slice.map(window._monthlyRenderRow).join('');
  if (label) label.textContent = `Page ${page+1} / ${totalPages}`;
  if (prev)  prev.disabled  = page === 0;
  if (next)  next.disabled  = page >= totalPages - 1;
  if (prev)  prev.style.opacity  = page === 0 ? '.3' : '1';
  if (next)  next.style.opacity  = page >= totalPages-1 ? '.3' : '1';
}

function monthlyPageNav(dir) {
  const months = window._monthlyAllMonths || [];
  const totalPages = Math.ceil(months.length / 12);
  window._monthlyPage = Math.max(0, Math.min(totalPages-1, (window._monthlyPage||0) + dir));
  renderMonthlyPage();
}

function buildAccountTable() {
  const el = $('rpt-account-table');
  if (!el) return;

  const map = {};
  TRADES.forEach(t => {
    const k = t.account || 'Unknown';
    if (!map[k]) map[k] = { pnl:0, trades:0, wins:0 };
    map[k].pnl += t.pnl; map[k].trades++;
    if (t.pnl > 0) map[k].wins++;
  });

  const sorted = Object.keys(map).sort((a,b) => map[b].pnl - map[a].pnl);
  if (!sorted.length) { el.innerHTML = '<div style="color:var(--text3);font-size:12px;font-family:var(--font-mono);text-align:center;padding:20px">No data yet</div>'; return; }

  const SHOW_DEFAULT = 6;
  const expanded = window._acctExpanded || false;
  const total    = sorted.length;
  const visible  = expanded ? sorted.slice(0,12) : sorted.slice(0, SHOW_DEFAULT);

  const headerRow = `<div style="display:grid;grid-template-columns:32px 1fr 90px 90px 60px 60px;gap:6px;padding:4px 10px 8px;font-size:9px;letter-spacing:.1em;color:var(--text3);font-family:var(--font-mono);text-transform:uppercase;border-bottom:1px solid var(--border);margin-bottom:4px">
    <span></span><span>Account</span><span style="text-align:right">Net P&L</span><span style="text-align:right">P&L%</span><span style="text-align:center">Trades</span><span style="text-align:center">Win%</span>
  </div>`;

  const renderAcctRow = k => {
    const d    = map[k];
    const wr   = d.trades ? ((d.wins/d.trades)*100).toFixed(0) : 0;
    const acct = (typeof ACCOUNTS !== 'undefined' ? ACCOUNTS : []).find(a => (a.key||a.phase).trim() === k.trim());
    const startBal = acct?.startBal || 0;
    const pct  = startBal ? ((d.pnl/startBal)*100).toFixed(2) : null;
    const shortAcct = k.replace('FTM Prop Firm - ','').replace('Apex Trader - ','Apex ').replace('GOAT - ','GOAT ');
    return `<div style="display:grid;grid-template-columns:32px 1fr 90px 90px 60px 60px;gap:6px;padding:9px 10px;border-radius:7px;background:var(--bg4);align-items:center;margin-bottom:3px">
      <div style="flex-shrink:0">${firmLogoHTML(k, 24, 6)}</div>
      <span style="font-size:12px;font-weight:600;color:var(--text2)" title="${k}">${shortAcct}</span>
      <span style="font-size:12px;font-weight:700;text-align:right;color:${d.pnl>=0?'var(--green)':'var(--red)'}">${d.pnl>=0?'+':''}$${d.pnl.toFixed(2)}</span>
      <span style="font-size:11px;text-align:right;font-family:var(--font-mono);color:${d.pnl>=0?'var(--green)':'var(--red)'}">${pct != null ? (d.pnl>=0?'+':'')+pct+'%' : '—'}</span>
      <span style="font-size:11px;color:var(--text3);text-align:center;font-family:var(--font-mono)">${d.trades}</span>
      <span style="font-size:11px;color:${parseInt(wr)>=50?'var(--green)':'var(--red)'};text-align:center;font-family:var(--font-mono)">${wr}%</span>
    </div>`;
  };

  el.innerHTML = headerRow + visible.map(renderAcctRow).join('');

  // Badge + expand button
  const badge = $('rpt-acct-badge');
  const btn   = $('rpt-acct-expand-btn');
  if (badge && total > SHOW_DEFAULT) {
    badge.textContent = `${total} accounts`;
    badge.style.display = 'inline-block';
  }
  if (btn) {
    if (total > SHOW_DEFAULT && !expanded) {
      btn.style.display = 'inline-block';
      btn.textContent = `Show all (${total}) ▾`;
    } else if (total > SHOW_DEFAULT && expanded && total <= 12) {
      btn.style.display = 'inline-block';
      btn.textContent = 'Show less ▴';
    } else if (total > 12 && expanded) {
      btn.style.display = 'inline-block';
      btn.textContent = `See all pages ▾`;
    } else {
      btn.style.display = 'none';
    }
  }

  // Hide pagination panel initially
  const pagesEl = $('rpt-acct-pages');
  if (pagesEl) pagesEl.style.display = 'none';

  // Store for pagination
  window._acctAllSorted    = sorted;
  window._acctRenderRow    = renderAcctRow;
  window._acctHeaderRow    = headerRow;
  window._acctPage         = 0;
}

function toggleAcctExpand() {
  window._acctExpanded = !window._acctExpanded;
  const sorted = window._acctAllSorted || [];
  if (window._acctExpanded && sorted.length > 12) {
    window._acctPage = 0;
    renderAcctPage();
    const pagesEl = $('rpt-acct-pages');
    if (pagesEl) pagesEl.style.display = 'block';
    const btn = $('rpt-acct-expand-btn');
    if (btn) btn.textContent = 'Show less ▴';
  } else {
    const pagesEl = $('rpt-acct-pages');
    if (pagesEl) pagesEl.style.display = 'none';
    buildAccountTable();
  }
}

function renderAcctPage() {
  const PAGE_SIZE  = 12;
  const sorted     = window._acctAllSorted || [];
  const page       = window._acctPage || 0;
  const slice      = sorted.slice(page * PAGE_SIZE, (page+1) * PAGE_SIZE);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

  const el    = $('rpt-acct-page-table');
  const label = $('rpt-acct-page-label');
  const prev  = $('rpt-acct-prev');
  const next  = $('rpt-acct-next');

  if (!el) return;
  el.innerHTML = (window._acctHeaderRow || '') + slice.map(window._acctRenderRow).join('');
  if (label) label.textContent = `Page ${page+1} / ${totalPages}`;
  if (prev)  { prev.disabled = page===0; prev.style.opacity = page===0?'.3':'1'; }
  if (next)  { next.disabled = page>=totalPages-1; next.style.opacity = page>=totalPages-1?'.3':'1'; }
}

function acctPageNav(dir) {
  const totalPages = Math.ceil((window._acctAllSorted||[]).length / 12);
  window._acctPage = Math.max(0, Math.min(totalPages-1, (window._acctPage||0)+dir));
  renderAcctPage();
}


function buildTopWorstTrades() {
  const top   = $('rpt-top-trades');
  const worst = $('rpt-worst-trades');
  const sorted = [...TRADES].sort((a,b) => b.pnl - a.pnl);

  const render = (el, list) => {
    if (!el) return;
    if (!list.length) {
      el.innerHTML = '<div style="color:var(--text3);font-size:12px;font-family:var(--font-mono);text-align:center;padding:20px">No trades yet</div>';
      return;
    }
    el.innerHTML = list.map((t, i) => {
      const acctShort = (t.account || 'Unknown')
        .replace('FTM Prop Firm - ', '')
        .replace('Apex Trader - ', 'Apex ')
        .replace('GOAT - ', 'GOAT ');
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;background:var(--bg4);border:1px solid var(--border)">
          <!-- Rank badge -->
          <div style="width:24px;height:24px;border-radius:6px;background:var(--bg5);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:10px;font-family:var(--font-mono);color:var(--text3);flex-shrink:0;font-weight:700">${i+1}</div>
          <!-- Info -->
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:3px">
              <span style="font-size:13px;font-weight:700;color:var(--text)">${t.symbol}</span>
              <span style="font-size:9px;font-family:var(--font-mono);font-weight:700;padding:1px 6px;border-radius:4px;
                background:${t.dir==='long'?'var(--green2)':'var(--red2)'};
                color:${t.dir==='long'?'var(--green)':'var(--red)'};
                border:1px solid ${t.dir==='long'?'rgba(46,204,138,.25)':'rgba(232,80,74,.25)'}">${t.dir.toUpperCase()}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="font-size:10px;color:var(--text3);font-family:var(--font-mono)">${t.date}</span>
              ${t.setup ? `<span style="font-size:10px;color:var(--text3);font-family:var(--font-mono)">· ${t.setup}</span>` : ''}
              <span style="font-size:9.5px;padding:1px 7px;border-radius:4px;background:var(--purple2);color:var(--purple);font-family:var(--font-mono);border:1px solid var(--ac-20);display:inline-flex;align-items:center;gap:4px">
                ${(()=>{ const u=getFirmLogo(t.account||''); return u ? `<img src="${u}" style="width:11px;height:11px;object-fit:contain;border-radius:2px;vertical-align:middle" onerror="this.remove()">` : ''; })()}
                ${acctShort}
              </span>
            </div>
          </div>
          <!-- P&L -->
          <div style="text-align:right;flex-shrink:0">
            <div style="font-family:var(--font-display);font-weight:700;font-size:15px;color:${t.pnl>=0?'var(--green)':'var(--red)'}">${t.pnl>=0?'+':''}$${t.pnl.toFixed(2)}</div>
            <div style="font-size:9px;color:var(--text3);font-family:var(--font-mono);margin-top:1px">${t.size} lot${t.size!==1?'s':''}</div>
          </div>
        </div>`;
    }).join('');
  };

  render(top,   sorted.slice(0, 5));
  render(worst, sorted.slice(-5).reverse());
}

function buildSetupTable() {
  const el = $('rpt-setup-table');
  if (!el) return;
  const map = {};
  TRADES.forEach(t => {
    const k = t.setup || 'No Setup';
    if (!map[k]) map[k] = { pnl:0, trades:0, wins:0 };
    map[k].pnl += t.pnl;
    map[k].trades++;
    if (t.pnl > 0) map[k].wins++;
  });
  const sorted = Object.keys(map).sort((a,b) => map[b].pnl - map[a].pnl);
  el.innerHTML = sorted.map(k => {
    const d = map[k];
    const wr = d.trades ? ((d.wins/d.trades)*100).toFixed(0) : 0;
    return `<div style="background:var(--bg4);border:1px solid var(--border);border-radius:9px;padding:13px 14px">
      <div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:8px">${k}</div>
      <div style="font-family:var(--font-display);font-weight:700;font-size:16px;color:${d.pnl>=0?'var(--green)':'var(--red)'};margin-bottom:6px">${d.pnl>=0?'+':''}$${d.pnl.toFixed(2)}</div>
      <div style="display:flex;gap:8px">
        <span style="font-size:10px;color:var(--text3);font-family:var(--font-mono)">${d.trades} trades</span>
        <span style="font-size:10px;color:var(--purple);font-family:var(--font-mono)">${wr}% WR</span>
      </div>
    </div>`;
  }).join('');
}

// ── IMPORT ────────────────────────────────────────────────
function importJSONData() {
  $('import-file-input')?.click();
}
function handleImportFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      const imported = Array.isArray(data) ? data : (data.trades || []);
      if (!imported.length) { showToast('No trades found in file', 'error', ''); return; }
      showConfirmModal(
        '📥 Import Trades',
        `Import <strong>${imported.length} trade${imported.length !== 1 ? 's' : ''}</strong>?<br><br>This will <strong>replace</strong> your current journal data.`,
        'Import',
        'Cancel',
        'primary',
        function() {
          TRADES.length = 0;
          TRADES.push(...imported);
          saveTradesToStorage();
          if (typeof populateDashboard === 'function') populateDashboard();
          if (typeof renderTrades === 'function') renderTrades(TRADES);
          showToast(`Imported ${imported.length} trades`, 'success', '📥');
          input.value = '';
        }
      );
    } catch(err) {
      showToast('Invalid JSON file', 'error', '');
    }
  };
  reader.readAsText(file);
}

// ── VIEW SWITCH HOOK ──────────────────────────────────────
// Intercept switchView to init pages on first visit
const _origSV2 = window.switchView;
window.switchView = function(el) {
  _origSV2.apply(this, arguments);
  const view = el?.dataset?.view;
  if (view === 'reports')  { requestAnimationFrame(() => { initReportsPage(); updateStorageUsageBar(); }); }
  if (view === 'settings') { requestAnimationFrame(() => { initSettingsUI(); initProfileUI(); }); }
};

// Init on load if these views are somehow active
document.addEventListener('DOMContentLoaded', () => {
  initProfileUI();
  initPublicTraderRoute();
  const s = loadSettings();
  // Apply saved accent — always apply (default to purple if none saved)
  applyAccentColor(s.accentColor || '#995dff');
  if (s.accentColor) {
    // Mark the active swatch with a visible ring
    setTimeout(function(){
      document.querySelectorAll('[data-accent-swatch]').forEach(function(el){
        el.style.border = el.dataset.accentSwatch === s.accentColor
          ? '2.5px solid rgba(255,255,255,.9)'
          : '2px solid transparent';
      });
    }, 100);
  }
  // Update sidebar avatar/name from profile
  setTimeout(() => {
    initProfileUI();
  }, 400);
});
