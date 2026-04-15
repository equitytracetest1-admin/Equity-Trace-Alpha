// ═══ Reports Module ═══

// ══════════════════════════════════════════════
// COLUMN EDITOR
// ══════════════════════════════════════════════
const ALL_COLS = [
  { key:'account',   label:'Account',    th:'account' },
  { key:'date',      label:'Date / Time',th:'date' },
  { key:'symbol',    label:'Symbol',     th:'symbol' },
  { key:'model',     label:'Model',      th:'model' },
  { key:'dir',       label:'Direction',  th:'dir' },
  { key:'entry',     label:'Entry',      th:'entry' },
  { key:'exit',      label:'Exit',       th:'exit' },
  { key:'size',      label:'Lots',       th:'size' },
  { key:'pnl',       label:'Net P&L',    th:'pnl' },
  { key:'rmult',     label:'R-Multiple', th:'rmult' },
  { key:'result',    label:'Result',     th:'result' },
];

// Always-visible columns
const LOCKED_COLS = new Set(['symbol','pnl']);

let hiddenCols = new Set();

function applyColVisibility() {
  ALL_COLS.forEach(col => {
    const visible = !hiddenCols.has(col.key);
    // Hide/show thead th
    const th = document.querySelector(`#trade-table thead th[data-col="${col.th}"]`);
    if (th) th.style.display = visible ? '' : 'none';
    // Hide/show tbody tds by column index
  });
  // Re-hide tds based on column index
  const ths = [...$$('#trade-table thead th:not(#sel-th-all)')];
  ths.forEach((th, i) => {
    const show = th.style.display !== 'none';
    $$(`#trade-table tbody tr`).forEach(tr => {
      const td = tr.children[i + ($('sel-th-all') ? 1 : 0)];
      if (td) td.style.display = show ? '' : 'none';
    });
  });
}

function openColumnEditor() {
  const list = $('col-editor-list');
  list.innerHTML = ALL_COLS.map(col => {
    const locked = LOCKED_COLS.has(col.key);
    const checked = !hiddenCols.has(col.key);
    const bg = checked ? 'var(--ac-07)' : 'transparent';
    const toggleBg = checked ? 'var(--purple)' : 'var(--bg5)';
    const knobLeft = checked ? '17px' : '2px';
    const cursor = locked ? 'default' : 'pointer';
    const labelColor = locked ? 'var(--text3)' : 'var(--text)';
    const lockedBadge = locked ? ' <span style="font-size:10px;color:var(--text4)">locked</span>' : '';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:8px;background:${bg};transition:background .12s" id="col-lbl-${col.key}">
      <span style="font-family:var(--font-body);font-size:13px;color:${labelColor}">${col.label}${lockedBadge}</span>
      <div onclick="if(!${locked})toggleCol('${col.key}')"
        style="width:36px;height:20px;border-radius:99px;background:${toggleBg};border:1px solid ${checked?'transparent':'var(--border)'};position:relative;transition:background .2s;flex-shrink:0;cursor:${cursor}"
        id="col-toggle-${col.key}">
        <div style="position:absolute;top:2px;left:${knobLeft};width:14px;height:14px;border-radius:50%;background:#fff;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)" id="col-knob-${col.key}"></div>
      </div>
    </div>`;
  }).join('');
  $('col-editor-overlay').style.display = 'flex';
}

function closeColumnEditor() {
  $('col-editor-overlay').style.display = 'none';
}

function toggleCol(key) {
  if (LOCKED_COLS.has(key)) return;
  if (hiddenCols.has(key)) hiddenCols.delete(key);
  else hiddenCols.add(key);
  // Update toggle UI
  const checked = !hiddenCols.has(key);
  const tog = $('col-toggle-'+key);
  const knob = $('col-knob-'+key);
  const lbl = $('col-lbl-'+key);
  if (tog) { tog.style.background = checked ? 'var(--purple)' : 'var(--bg5)'; tog.style.borderColor = checked ? 'transparent' : 'var(--border)'; }
  if (knob) knob.style.left = checked ? '17px' : '2px';
  if (lbl) lbl.style.background = checked ? 'var(--ac-07)' : 'transparent';
  applyColVisibility();
}

function colResetAll() {
  hiddenCols.clear();
  openColumnEditor(); // re-render toggles
  applyColVisibility();
}

// Re-apply after every renderTrades
const _origRenderTrades = window.renderTrades;
if (typeof renderTrades === 'function') {
  const _orig = renderTrades;
  window.renderTrades = function(trades) {
    _orig(trades);
    applyColVisibility();
  };
}

// Esc closes column editor
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && $('col-editor-overlay').style.display === 'flex') {
    closeColumnEditor();
  }

  // Backspace — go back to Symbol Breakdown if we drilled in from there
  if (e.key === 'Backspace' && window._symbolQuickFilter) {
    const tag = (e.target.tagName || '').toLowerCase();
    const isInput = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
    if (!isInput) {
      e.preventDefault();
      goBackToSymbolBreakdown();
    }
  }
});

// ══════════════════════════════════════════════
// ── DATA MANAGEMENT FUNCTIONS ──
// ══════════════════════════════════════════════

function toggleDataMenu() {
  const menu = $('data-menu');
  const btn = $('data-menu-btn');
  if (menu.style.display === 'none' || !menu.style.display) {
    menu.style.display = 'block';
    btn.style.borderColor = 'var(--border3)';
    // Close when clicking outside
    setTimeout(() => {
      document.addEventListener('click', closeDataMenuOutside);
    }, 10);
  } else {
    menu.style.display = 'none';
    btn.style.borderColor = 'var(--border)';
    document.removeEventListener('click', closeDataMenuOutside);
  }
}

function closeDataMenuOutside(e) {
  const menu = $('data-menu');
  const wrap = $('data-menu-wrap');
  if (!wrap.contains(e.target)) {
    menu.style.display = 'none';
    $('data-menu-btn').style.borderColor = 'var(--border)';
    document.removeEventListener('click', closeDataMenuOutside);
  }
}

function exportTrades() {
  const dataStr = JSON.stringify(TRADES, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `trading-journal-export-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
  
  // Close menu and show feedback
  toggleDataMenu();
  const btn = document.querySelector('.add-trade-btn');
  const origText = btn.innerHTML;
  const origBg = btn.style.background;
  btn.textContent = '✓ Exported!';
  btn.style.background = 'var(--green)';
  setTimeout(() => { btn.innerHTML = origText; btn.style.background = origBg; }, 1800);
}

// ══════════════════════════════════════════════
// ── RESET VERIFY MODAL — Magic Link flow ──
// Supabase sends a magic link; we listen for the
// resulting SIGNED_IN auth-state-change event.
// ══════════════════════════════════════════════
let _resetVerifySubscription = null;
let _resetVerifyCallback    = null;
let _resetVerifyEmail       = '';

function _ensureResetVerifyModal() {
  if (document.getElementById('reset-verify-overlay')) return;
  const el = document.createElement('div');
  el.id = 'reset-verify-overlay';
  el.style.cssText = [
    'display:none;position:fixed;inset:0;z-index:9999',
    'background:rgba(0,0,0,.72);backdrop-filter:blur(6px)',
    'align-items:center;justify-content:center'
  ].join(';');
  el.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:18px;
                padding:36px 30px 28px;width:380px;max-width:94vw;
                box-shadow:0 24px 80px rgba(0,0,0,.7);font-family:var(--font-body);
                position:relative;text-align:center">

      <!-- close × -->
      <button onclick="_cancelResetVerify()" style="position:absolute;top:14px;right:14px;
        background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;
        line-height:1;padding:4px 6px;border-radius:6px;transition:color .15s"
        onmouseenter="this.style.color='var(--text)'" onmouseleave="this.style.color='var(--text3)'">✕</button>

      <!-- animated email icon -->
      <div style="width:56px;height:56px;border-radius:16px;background:rgba(139,92,246,.13);
                  border:1px solid rgba(139,92,246,.35);display:flex;align-items:center;
                  justify-content:center;font-size:26px;margin:0 auto 20px">📧</div>

      <h3 style="margin:0 0 8px;font-size:17px;font-weight:700;color:var(--text);
                 font-family:var(--font-display)">Check Your Email</h3>

      <p id="reset-verify-desc" style="margin:0 0 24px;font-size:13px;color:var(--text3);line-height:1.7">
        A verification link was sent to<br>
        <strong id="reset-verify-email-display" style="color:var(--text)"></strong><br>
        <span style="font-size:12px">Click the link in that email to confirm the reset.<br>
        It will open in a new tab — come back here after.</span>
      </p>

      <!-- spinner + status -->
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;
                  padding:12px 16px;border-radius:10px;background:var(--bg3);
                  border:1px solid var(--border);margin-bottom:20px">
        <div id="reset-verify-spinner" style="width:16px;height:16px;border-radius:50%;
             border:2px solid var(--ac-30);border-top-color:var(--purple);
             animation:spin .8s linear infinite;flex-shrink:0"></div>
        <span id="reset-verify-status" style="font-size:12px;font-family:var(--font-mono);
              color:var(--text3)">Waiting for verification…</span>
      </div>

      <!-- success state (hidden initially) -->
      <div id="reset-verify-success" style="display:none;align-items:center;
           justify-content:center;gap:8px;padding:12px 16px;border-radius:10px;
           background:rgba(46,204,138,.1);border:1px solid rgba(46,204,138,.3);margin-bottom:20px">
        <span style="font-size:16px">✅</span>
        <span style="font-size:12px;font-family:var(--font-mono);color:var(--green);font-weight:600">
          Identity verified — resetting now…</span>
      </div>

      <!-- cancel + resend row -->
      <div style="display:flex;gap:10px">
        <button onclick="_cancelResetVerify()" style="flex:1;padding:10px;border-radius:10px;
          border:1px solid var(--border2);background:transparent;color:var(--text2);
          font-size:13px;font-weight:600;cursor:pointer;transition:all .15s"
          onmouseenter="this.style.background='var(--bg4)'" onmouseleave="this.style.background='transparent'">
          Cancel
        </button>
        <button onclick="_resendVerifyLink()" id="reset-verify-resend" style="flex:1;padding:10px;
          border-radius:10px;border:1px solid var(--ac-40);background:transparent;
          color:var(--purple);font-size:13px;font-weight:600;cursor:pointer;transition:all .15s"
          onmouseenter="this.style.background='var(--ac-10)'" onmouseleave="this.style.background='transparent'">
          Resend Link
        </button>
      </div>
    </div>`;

  // Inject spin keyframe once
  if (!document.getElementById('reset-verify-styles')) {
    const s = document.createElement('style');
    s.id = 'reset-verify-styles';
    s.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
  }

  document.body.appendChild(el);
}

function _openResetVerifyModal(email, onSuccess) {
  _ensureResetVerifyModal();
  _resetVerifyEmail    = email;
  _resetVerifyCallback = onSuccess;

  // Show masked email
  const masked = email.replace(/(.{2}).+(@.+)/, '$1•••$2');
  const disp = document.getElementById('reset-verify-email-display');
  if (disp) disp.textContent = masked;

  // Reset to waiting state
  const spinner = document.getElementById('reset-verify-spinner');
  const status  = document.getElementById('reset-verify-status');
  const success = document.getElementById('reset-verify-success');
  if (spinner) spinner.style.display = 'block';
  if (status)  { status.textContent = 'Waiting for verification…'; status.style.color = 'var(--text3)'; }
  if (success) success.style.display = 'none';

  document.getElementById('reset-verify-overlay').style.display = 'flex';

  // Subscribe to Supabase auth state — fire when user clicks the magic link
  _unsubscribeResetVerify(); // clean up any old sub
  if (typeof getSupabase === 'function') {
    const sb = getSupabase();
    if (sb) {
      const { data } = sb.auth.onAuthStateChange(function(event, session) {
        if (event === 'SIGNED_IN' && session?.user?.email === email) {
          _unsubscribeResetVerify();
          _onResetVerified();
        }
      });
      _resetVerifySubscription = data?.subscription ?? data;
    }
  }
}

function _unsubscribeResetVerify() {
  if (_resetVerifySubscription) {
    try {
      if (typeof _resetVerifySubscription.unsubscribe === 'function') {
        _resetVerifySubscription.unsubscribe();
      } else if (_resetVerifySubscription.subscription?.unsubscribe) {
        _resetVerifySubscription.subscription.unsubscribe();
      }
    } catch (_) {}
    _resetVerifySubscription = null;
  }
}

function _onResetVerified() {
  // Show success state briefly, then execute reset
  const spinner = document.getElementById('reset-verify-spinner');
  const status  = document.getElementById('reset-verify-status');
  const success = document.getElementById('reset-verify-success');
  const wrap    = spinner?.parentElement;
  if (wrap)    wrap.style.display = 'none';
  if (success) success.style.display = 'flex';

  setTimeout(function() {
    _closeResetVerifyModal();
    if (typeof _resetVerifyCallback === 'function') _resetVerifyCallback();
  }, 1200);
}

function _cancelResetVerify() {
  _unsubscribeResetVerify();
  const ov = document.getElementById('reset-verify-overlay');
  if (ov) ov.style.display = 'none';
  _resetVerifyCallback = null;
}

function _closeResetVerifyModal() {
  const ov = document.getElementById('reset-verify-overlay');
  if (ov) ov.style.display = 'none';
}

async function _resendVerifyLink() {
  const btn = document.getElementById('reset-verify-resend');
  if (btn) { btn.textContent = 'Sending…'; btn.disabled = true; }
  const status = document.getElementById('reset-verify-status');
  try {
    const sb = (typeof getSupabase === 'function') ? getSupabase() : null;
    if (!sb) throw new Error('Supabase not connected');
    const { error } = await sb.auth.signInWithOtp({
      email: _resetVerifyEmail,
      options: { shouldCreateUser: false }
    });
    if (error) throw error;
    if (status) status.textContent = 'New link sent — check your inbox';
    if (typeof showToast === 'function') showToast('New link sent — check your inbox', 'success', '📧', 3000);
  } catch (e) {
    if (typeof showToast === 'function') showToast('Could not resend: ' + (e.message || 'Error'), 'error', '', 3000);
  } finally {
    if (btn) { btn.textContent = 'Resend Link'; btn.disabled = false; }
    setTimeout(() => { if (status) status.textContent = 'Waiting for verification…'; }, 3000);
  }
}

// ── RESET EXECUTION (runs only after magic-link verified) ──
function _executeReset() {
  const keysToRemove = [
    'tradingJournalTrades', 'equityTraceAccounts', 'eq_playbooks',
    'et-theme', 'et-accent', 'et-user-profile', 'et-settings',
    'et_trade_images', 'et-filter-state', 'hiddenAccountIds',
    'profile_v3_cleaned', 'playbooks_v4_full_clean', 'et-profile-photo'
  ];
  keysToRemove.forEach(key => localStorage.removeItem(key));

  TRADES.length = 0;
  TRADES.push(...getDefaultTrades());
  saveTradesToStorage();
  filteredTrades = [...TRADES];

  ACCOUNTS.length = 0;
  saveAccounts();

  setPbList([]);

  document.documentElement.className = 'dark';
  localStorage.setItem('et-theme', 'dark');
  document.documentElement.style.setProperty('--purple', '#8b5cf6');
  localStorage.setItem('et-accent', 'purple');

  if (typeof renderTrades === 'function') renderTrades(filteredTrades);
  if (typeof populateDashboard === 'function') populateDashboard();
  if (typeof refreshAdvAnalytics === 'function') refreshAdvAnalytics();
  if (typeof renderAccountsPage === 'function') renderAccountsPage();
  if (typeof initPlaybook === 'function') initPlaybook();
  if (typeof dailyPnlChartInstance !== 'undefined' && dailyPnlChartInstance) {
    if (typeof initDailyPnlChart === 'function') initDailyPnlChart();
  }

  showToast('✓ Reset complete — all data cleared', 'success', '🔄', 3000);
  setTimeout(() => window.location.reload(), 1500);
}

// ══════════════════════════════════════════════
// ── ENTRY POINT: double confirm → magic link verify ──
// ══════════════════════════════════════════════
function confirmResetData() {
  const dataMenu = document.getElementById('data-menu');
  if (dataMenu && dataMenu.style.display === 'block') toggleDataMenu();

  // ── Step 1: first confirmation ──
  showConfirmModal(
    '⚠️ Reset to Factory Defaults',
    'This will permanently delete <strong>all your trades, accounts, playbooks, images, and settings</strong>.<br><br>The app will return to its original state. This action <strong>cannot be undone</strong>.',
    'Yes, continue →',
    'Cancel',
    'danger',
    function () {
      setTimeout(function () {

        // ── Step 2: final confirmation ──
        showConfirmModal(
          '🚨 Last Chance — Are You Sure?',
          '<strong>Everything will be wiped.</strong> There is no undo, no backup, no recovery.<br><br>A verification link will be sent to your registered email. You must click it to confirm.',
          'Send Verification Link',
          'No, go back',
          'danger',
          async function () {
            setTimeout(async function () {

              // Resolve user email
              let email = '';
              try {
                if (window.SB) {
                  const user = await window.SB.getUser();
                  email = user?.email || '';
                }
                if (!email && typeof getSupabase === 'function') {
                  const { data: { user } } = await getSupabase().auth.getUser();
                  email = user?.email || '';
                }
              } catch (_) {}

              if (!email) {
                setTimeout(() => showConfirmModal(
                  '🔒 Sign-In Required',
                  'Email verification requires an active account session.<br><br>Please sign in first, then try the reset again.',
                  'OK', '', 'danger', null
                ), 50);
                return;
              }

              // Send magic link
              try {
                const sb = (typeof getSupabase === 'function') ? getSupabase() : null;
                if (!sb) throw new Error('Supabase not connected — check supabase.js credentials.');
                const { error } = await sb.auth.signInWithOtp({
                  email,
                  options: { shouldCreateUser: false }
                });
                if (error) throw error;
                if (typeof showToast === 'function') showToast('Verification link sent — check your inbox', 'success', '📧', 4000);
              } catch (e) {
                setTimeout(() => showConfirmModal(
                  '⚠️ Could Not Send Link',
                  'Failed to send verification email:<br><em style="color:var(--text3);font-size:12px">' + (e.message || 'Unknown error') + '</em>',
                  'OK', '', 'danger', null
                ), 50);
                return;
              }

              // ── Step 3: wait for magic-link click ──
              _openResetVerifyModal(email, _executeReset);

            }, 50);
          }
        );

      }, 50);
    }
  );
}

// ══════════════════════════════════════════════
// ── EXPORT MODAL (Performance Snapshot, Monthly Breakdown & By Account)
// ══════════════════════════════════════════════

let _exportTarget  = 'snapshot'; // 'snapshot' | 'monthly' | 'account'
let _exportFormat  = 'csv';
let _exportEmail   = false;

function openExportModal(target) {
  _exportTarget = target || 'snapshot';
  _exportFormat = 'csv';
  _exportEmail  = false;

  const titles = { snapshot: 'Export Performance Snapshot', monthly: 'Export Monthly Breakdown', account: 'Export Account Data' };
  const title = document.getElementById('export-modal-title');
  if (title) title.textContent = titles[_exportTarget] || 'Export Data';

  // Reset format buttons
  document.querySelectorAll('.exp-fmt-btn').forEach(b => {
    b.classList.remove('exp-fmt-active');
    b.style.borderColor = 'var(--border2)';
    b.style.background  = 'var(--bg3)';
  });
  const csvBtn = document.getElementById('exp-fmt-csv');
  if (csvBtn) { csvBtn.classList.add('exp-fmt-active'); csvBtn.style.borderColor = 'var(--purple)'; csvBtn.style.background = 'var(--ac-10)'; }

  // Reset email toggle
  const tog  = document.getElementById('exp-email-toggle');
  const knob = document.getElementById('exp-email-knob');
  const row  = document.getElementById('exp-email-row');
  if (tog)  tog.style.background = 'var(--bg5)';
  if (knob) knob.style.left = '2px';
  if (row)  row.style.display = 'none';
  const inp = document.getElementById('exp-email-input');
  if (inp) inp.value = '';

  // Pre-fill email from profile if available
  try {
    const prof = JSON.parse(localStorage.getItem('et-user-profile') || '{}');
    if (prof.email && inp) inp.value = prof.email;
  } catch (_) {}

  document.getElementById('export-modal-overlay').style.display = 'flex';
}

function closeExportModal() {
  document.getElementById('export-modal-overlay').style.display = 'none';
}

function selectExportFormat(fmt) {
  _exportFormat = fmt;
  document.querySelectorAll('.exp-fmt-btn').forEach(b => {
    b.classList.remove('exp-fmt-active');
    b.style.borderColor = 'var(--border2)';
    b.style.background  = 'var(--bg3)';
  });
  const btn = document.getElementById('exp-fmt-' + fmt);
  if (btn) { btn.classList.add('exp-fmt-active'); btn.style.borderColor = 'var(--purple)'; btn.style.background = 'var(--ac-10)'; }
}

function toggleExportEmail() {
  _exportEmail = !_exportEmail;
  const tog  = document.getElementById('exp-email-toggle');
  const knob = document.getElementById('exp-email-knob');
  const row  = document.getElementById('exp-email-row');
  if (tog)  tog.style.background = _exportEmail ? 'var(--purple)' : 'var(--bg5)';
  if (knob) knob.style.left = _exportEmail ? '17px' : '2px';
  if (row)  row.style.display = _exportEmail ? 'block' : 'none';
}

// ── Data builders ──
function _getSnapshotRows() {
  if (typeof TRADES === 'undefined') return [];
  const trades = TRADES;
  if (!trades.length) return [];
  const wins   = trades.filter(t => (t.pnl || 0) > 0);
  const losses = trades.filter(t => (t.pnl || 0) < 0);
  const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
  const avgWin  = wins.length   ? wins.reduce((s,t) => s+(t.pnl||0), 0) / wins.length   : 0;
  const avgLoss = losses.length ? losses.reduce((s,t) => s+(t.pnl||0), 0) / losses.length : 0;
  const bestTrade  = trades.reduce((b,t) => (t.pnl||0) > (b.pnl||0) ? t : b, trades[0]);
  const worstTrade = trades.reduce((w,t) => (t.pnl||0) < (w.pnl||0) ? t : w, trades[0]);
  const symbols = [...new Set(trades.map(t => t.symbol).filter(Boolean))];
  return [
    { Metric: 'Total Trades',   Value: trades.length },
    { Metric: 'Winning Trades', Value: wins.length },
    { Metric: 'Losing Trades',  Value: losses.length },
    { Metric: 'Win Rate',       Value: trades.length ? ((wins.length / trades.length) * 100).toFixed(1) + '%' : '0%' },
    { Metric: 'Net P&L',        Value: '$' + totalPnl.toFixed(2) },
    { Metric: 'Avg Win',        Value: '$' + avgWin.toFixed(2) },
    { Metric: 'Avg Loss',       Value: '$' + avgLoss.toFixed(2) },
    { Metric: 'Best Trade',     Value: bestTrade  ? bestTrade.symbol  + ' $' + (bestTrade.pnl||0).toFixed(2)  : '-' },
    { Metric: 'Worst Trade',    Value: worstTrade ? worstTrade.symbol + ' $' + (worstTrade.pnl||0).toFixed(2) : '-' },
    { Metric: 'Symbols Traded', Value: symbols.join(', ') || '-' },
  ];
}

function _getMonthlyRows() {
  if (typeof TRADES === 'undefined') return [];
  const byMonth = {};
  TRADES.forEach(t => {
    if (!t.date) return;
    const key = t.date.slice(0, 7);
    if (!byMonth[key]) byMonth[key] = { month: key, trades: 0, wins: 0, losses: 0, pnl: 0 };
    byMonth[key].trades++;
    if ((t.pnl || 0) >= 0) byMonth[key].wins++; else byMonth[key].losses++;
    byMonth[key].pnl += (t.pnl || 0);
  });
  return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)).map(r => ({
    Month: r.month, Trades: r.trades, Wins: r.wins, Losses: r.losses,
    'Win Rate': r.trades > 0 ? ((r.wins / r.trades) * 100).toFixed(1) + '%' : '0%',
    'Net P&L': '$' + r.pnl.toFixed(2)
  }));
}

function _getAccountRows() {
  if (typeof TRADES === 'undefined') return [];
  const byAcct = {};
  TRADES.forEach(t => {
    const key = t.account || 'Unknown';
    if (!byAcct[key]) byAcct[key] = { account: key, trades: 0, wins: 0, losses: 0, pnl: 0 };
    byAcct[key].trades++;
    if ((t.pnl || 0) >= 0) byAcct[key].wins++; else byAcct[key].losses++;
    byAcct[key].pnl += (t.pnl || 0);
  });
  return Object.values(byAcct).map(r => ({
    Account: r.account, Trades: r.trades, Wins: r.wins, Losses: r.losses,
    'Win Rate': r.trades > 0 ? ((r.wins / r.trades) * 100).toFixed(1) + '%' : '0%',
    'Net P&L': '$' + r.pnl.toFixed(2)
  }));
}

function _rowsToCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape  = v => `"${String(v).replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
}

function _rowsToHTML(rows, title) {
  if (!rows.length) return '<p>No data available.</p>';
  const headers = Object.keys(rows[0]);
  const ths = headers.map(h => `<th style="padding:8px 12px;text-align:left;border-bottom:2px solid #8b5cf6;font-size:12px;color:#8b5cf6;font-family:monospace;text-transform:uppercase;letter-spacing:.05em">${h}</th>`).join('');
  const trs = rows.map((r, i) =>
    `<tr style="background:${i % 2 === 0 ? '#1a1a2e' : '#16213e'}">` +
    headers.map(h => {
      const v = String(r[h]);
      let color = '#e2e8f0';
      if (h === 'Net P&L' || h === 'Value') {
        if (v.startsWith('$') || v.startsWith('-$')) color = v.startsWith('-') ? '#e8504a' : '#2ecc8a';
      }
      return `<td style="padding:8px 12px;font-size:13px;color:${color};font-family:monospace;border-bottom:1px solid rgba(255,255,255,.05)">${v}</td>`;
    }).join('') + '</tr>'
  ).join('');
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title></head>
<body style="background:#0f0f1a;color:#e2e8f0;font-family:system-ui,sans-serif;margin:0;padding:32px">
  <div style="max-width:900px;margin:0 auto">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;padding-bottom:16px;border-bottom:1px solid rgba(139,92,246,.3)">
      <div>
        <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#fff">${title}</h1>
        <div style="font-size:12px;color:#6b7280;font-family:monospace">Generated ${date} · Equity Trace</div>
      </div>
      <div style="font-size:28px">📊</div>
    </div>
    <table style="width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden">
      <thead><tr>${ths}</tr></thead><tbody>${trs}</tbody>
    </table>
    <div style="margin-top:20px;font-size:11px;color:#4b5563;font-family:monospace;text-align:right">Equity Trace · Trading Journal</div>
  </div>
</body></html>`;
}

function _download(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function _sendExportEmail(email, subject, body) {
  const maxLen = 1800;
  const truncated = body.length > maxLen ? body.slice(0, maxLen) + '\n\n[Content truncated — see downloaded file for full data]' : body;
  window.open(`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(truncated)}`, '_blank');
}

function runExport() {
  const dataMap = { snapshot: _getSnapshotRows, monthly: _getMonthlyRows, account: _getAccountRows };
  const rows  = (dataMap[_exportTarget] || _getSnapshotRows)();
  const labelMap = { snapshot: 'Performance-Snapshot', monthly: 'Monthly-Breakdown', account: 'By-Account' };
  const titleMap = { snapshot: 'Performance Snapshot',  monthly: 'Monthly Breakdown',  account: 'Account Performance' };
  const label = labelMap[_exportTarget] || 'Report';
  const title = titleMap[_exportTarget] || 'Report';
  const date  = new Date().toISOString().split('T')[0];
  const btn   = document.getElementById('exp-run-btn');

  if (!rows.length) {
    if (typeof showToast === 'function') showToast('No data to export', 'error', '', 2000);
    return;
  }

  let content, filename, mime, emailBody;

  switch (_exportFormat) {
    case 'csv':
      content   = _rowsToCSV(rows);
      filename  = `EquityTrace-${label}-${date}.csv`;
      mime      = 'text/csv';
      emailBody = `Equity Trace — ${title}\nExported: ${date}\n\n` + content;
      break;
    case 'json':
      content   = JSON.stringify({ title, exported: date, data: rows }, null, 2);
      filename  = `EquityTrace-${label}-${date}.json`;
      mime      = 'application/json';
      emailBody = `Equity Trace — ${title}\nExported: ${date}\n\n` + JSON.stringify(rows, null, 2);
      break;
    case 'html':
      content   = _rowsToHTML(rows, `${title} · Equity Trace`);
      filename  = `EquityTrace-${label}-${date}.html`;
      mime      = 'text/html';
      emailBody = `Equity Trace — ${title}\nExported: ${date}\n\nPlease open the downloaded HTML file to view the styled report.`;
      break;
    case 'pdf':
      const htmlContent = _rowsToHTML(rows, `${title} · Equity Trace`);
      const win = window.open('', '_blank');
      if (win) { win.document.write(htmlContent); win.document.close(); win.focus(); setTimeout(() => win.print(), 400); }
      emailBody = `Equity Trace — ${title}\nExported: ${date}\n\nYour PDF was opened in a new window. Use your browser's print dialog to save as PDF.`;
      filename  = null;
      break;
  }

  if (filename) _download(content, filename, mime);

  if (_exportEmail) {
    const emailInput = document.getElementById('exp-email-input');
    const email = emailInput ? emailInput.value.trim() : '';
    if (email && email.includes('@')) {
      _sendExportEmail(email, `Equity Trace — ${title} Export (${date})`, emailBody);
    } else {
      if (typeof showToast === 'function') showToast('Please enter a valid email address', 'error', '', 2000);
      return;
    }
  }

  if (btn) { btn.textContent = '✓ Done!'; btn.style.background = 'var(--green)'; }
  setTimeout(() => {
    closeExportModal();
    if (btn) { btn.textContent = 'Download'; btn.style.background = 'var(--purple)'; }
    if (typeof showToast === 'function') showToast(`${title} exported as ${_exportFormat.toUpperCase()}`, 'success', '📊', 2500);
  }, 900);
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const ov = document.getElementById('export-modal-overlay');
    if (ov && ov.style.display === 'flex') closeExportModal();
  }
});
