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

function confirmResetData() {
  toggleDataMenu();
  showConfirmModal(
    '⚠️ Reset to Demo Data',
    'This will delete <strong>all your trades</strong> and restore the sample demo data.<br><br>This action <strong>cannot be undone</strong>.',
    'Reset Data',
    'Cancel',
    'danger',
    function() {
      localStorage.removeItem('tradingJournalTrades');
      TRADES.length = 0;
      TRADES.push(...getDefaultTrades());
      saveTradesToStorage();
      filteredTrades = [...TRADES];
      renderTrades(filteredTrades);
      populateDashboard();
      refreshAdvAnalytics();
      if (dailyPnlChartInstance) initDailyPnlChart();
      showToast('Data reset to demo trades', 'success', '🔄', 2500);
    }
  );
}
