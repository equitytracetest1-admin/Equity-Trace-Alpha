// ═══ Core App — State, Trades, Dashboard, Charts ═══

// ── DOM + STORAGE HELPERS (global) ──────────────────────────
const $  = id  => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
function lsGet(key, fallback=null){
  try{ const v=localStorage.getItem(key); return v?JSON.parse(v):fallback; }catch{ return fallback; }
}
function lsSet(key,val){
  try{ localStorage.setItem(key,JSON.stringify(val)); }catch(e){ console.warn('Storage:',e); }
}
// ─────────────────────────────────────────────────────────
// ── READY FLAG ──
window._appReady = false; // Set to true after initialization complete

// ── CRITICAL GLOBAL VARIABLES (must be defined early) ──
let anCurrentAccount = '__all__'; // for analytics pages
let selectedAcct = -1; // Dashboard/Trade Log account selector
let analyticsInitialized = false;
let editTradeId = null;
let currentDir = 'long'; // 'long' or 'short'
let selectedRating = 0;
let currentDetailTrade = null;
let selectModeActive = false;

// ── PRICE FORMATTING ──
function formatPrice(symbol, price) {
  if (!price && price !== 0) return '—';
  const s = (symbol || '').toUpperCase();
  // JPY pairs → 3 decimals
  if (s.includes('JPY')) return price.toFixed(3);
  // Metals → 2 decimals
  if (s.match(/XAU|XAG|XPT|XPD/)) return price.toFixed(2);
  // Futures (ends with !, or known prefixes) → 2 decimals
  if (s.includes('!') || s.match(/^(ES|NQ|YM|RTY|CL|NG|GC|SI|HG|ZB|ZN|ZF|ZT|ZC|ZW|ZS|ZM|ZL|MES|MNQ|MCL|MGC)/)) return price.toFixed(2);
  // Crypto → 2 decimals
  if (s.match(/BTC|ETH|SOL|XRP|ADA|DOGE|AVAX|DOT|MATIC|LINK|UNI|LTC|BCH|BNB/)) return price.toFixed(2);
  // Default forex → 5 decimals
  return price.toFixed(5);
}

// ── Cleanup duplicate account names in trades ──
function cleanupTradeAccountNames(trades) {
  let anyChanged = false;
  const cleaned = trades.map(t => {
    if (!t.account) return t;
    const originalAccount = t.account;
    
    let normalized = t.account;
    
    // Normalize all variations to clean firm names
    normalized = normalized
      .replace(/Goat Funded Trader/i, 'GOAT')          // Old name → GOAT
      .replace(/^GOAT\s*-\s*Funded(?:\s*-\s*Phase\s*\d+)?$/i, 'GOAT')  // GOAT - Funded [- Phase X] → GOAT
      .replace(/FTM Prop Firm\s*-\s*Phase\s*(\d+)/i, 'FTM Prop Firm - Phase $1')  // Normalize FTM phases
      .replace(/Apex Trader\s*-\s*Eval/i, 'Apex Trader - Eval');  // Normalize Apex
    
    // Remove duplicate firm names
    const parts = normalized.split(' - ');
    if (parts.length >= 2) {
      const firstPart = parts[0];
      if (parts[1] === firstPart || parts[1].startsWith(firstPart + ' - ')) {
        normalized = parts.slice(1).join(' - ');
      }
    }
    
    t.account = normalized;
    if (t.account !== originalAccount) anyChanged = true;
    return t;
  });
  
  // Save back if any changes were made
  if (anyChanged) {
    try {
      localStorage.setItem('tradingJournalTrades', JSON.stringify(cleaned));
    } catch(e) {
      console.warn('Could not save cleaned trades:', e);
    }
  }
  return cleaned;
}

// ── DATA ──
// ══ TRADES DATA ══
// ── Model name migration map: old hardcoded → new playbook names ──
const MODEL_MIGRATION_MAP = {
  'OTE':                  'NY Open Breakout',
  'FVG':                  'VWAP Reclaim',
  'ChoCH':                'Reversal at Structure',
  'Power of 3':           'Trend Continuation',
  'Order Block':          'Reversal at Structure',
  'Silver Bullet':        'NY Open Breakout',
  'MSB':                  'Trend Continuation',
  'Breaker':              'Opening Gap Fill',
  'Rejection Block':      'Reversal at Structure',
  'EMA Cross':            'News Play',
  'Support / Resistance': 'Reversal at Structure',
  'CRT Low':              'Reversal at Structure',
  'CRT High':             'Reversal at Structure',
  'CRT Midpoint':         'Reversal at Structure',
  'CRT Expansion':        'Trend Continuation',
  'CISD':                 'NY Open Breakout',
  'BMS':                  'Trend Continuation',
  'Liquidity Grab':       'NY Open Breakout',
  'Supply Zone':          'Reversal at Structure',
  'Demand Zone':          'Reversal at Structure',
  'Imbalance Fill':       'Opening Gap Fill',
  'Premium / Discount':   'Reversal at Structure',
  'NWOG':                 'Opening Gap Fill',
  'NDOG':                 'Opening Gap Fill',
  'Judas Swing':          'NY Open Breakout',
  'Vacuum':               'Trend Continuation',
  'Propulsion Block':     'Trend Continuation',
  'RSI Divergence':       'Reversal at Structure',
  'VWAP Reclaim':         'VWAP Reclaim',
  'Bull Flag':            'Trend Continuation',
  'Bear Flag':            'Trend Continuation',
  'Double Top':           'Reversal at Structure',
  'Double Bottom':        'Reversal at Structure',
  'Head & Shoulders':     'Reversal at Structure',
  'EMA Cross':            'News Play',
  'Trendline Bounce':     'Reversal at Structure',
};

const TRADE_DATA_VERSION = 2; // bump this to force re-migration

function migrateTradeModels(trades) {
  const pbNames = new Set(PB_DEFAULTS.map(p => p.name));
  return trades.map(t => {
    if (t.model && !pbNames.has(t.model) && MODEL_MIGRATION_MAP[t.model]) {
      return { ...t, model: MODEL_MIGRATION_MAP[t.model] };
    }
    return t;
  });
}

// Load trades from localStorage or use default demo data
function loadTrades() {
  // IMPORTANT: Clear any old hardcoded demo data on first load
  const migrationKey = 'tradingJournal_v3_cleaned';
  if (!localStorage.getItem(migrationKey)) {
    // First time after cleanup - clear old demo data
    const stored = localStorage.getItem('tradingJournalTrades');
    if (stored) {
      try {
        const trades = JSON.parse(stored);
        // If any of the old demo trades exist, wipe the cache
        const oldTradeIds = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
        if (trades.some(t => oldTradeIds.includes(t.id))) {
          console.warn('Old demo trades detected - clearing cache...');
          localStorage.removeItem('tradingJournalTrades');
          localStorage.removeItem('tradeDataVersion');
          localStorage.removeItem(migrationKey);
          return [];
        }
      } catch(e) {}
    }
    localStorage.setItem(migrationKey, '1');
  }

  const stored = localStorage.getItem('tradingJournalTrades');
  const storedVersion = parseInt(localStorage.getItem('tradeDataVersion') || '0', 10);
  if (stored) {
    try {
      let trades = JSON.parse(stored);
      // Clean up any duplicate account names from old data
      trades = cleanupTradeAccountNames(trades);
      // Migrate old model names to current playbook names
      if (storedVersion < TRADE_DATA_VERSION) {
        trades = migrateTradeModels(trades);
        localStorage.setItem('tradingJournalTrades', JSON.stringify(trades));
        localStorage.setItem('tradeDataVersion', String(TRADE_DATA_VERSION));
      }
      return trades;
    } catch (e) {
      console.error('Error loading trades from localStorage:', e);
      return getDefaultTrades();
    }
  }
  localStorage.setItem('tradeDataVersion', String(TRADE_DATA_VERSION));
  return getDefaultTrades();
}

function saveTradesToStorage() {
  try {
    localStorage.setItem('tradingJournalTrades', JSON.stringify(TRADES));
    hideStorageWarning();
  } catch(e) {
    showStorageWarning();
  }
  // Sync to Supabase if signed in
  if (window.SB) {
    window.SB.getUser().then(user => {
      if (user) window.SB.saveAllTrades(TRADES).catch(e => console.warn('SB sync trades:', e));
    });
  }
}

function showStorageWarning() {
  let banner = document.getElementById('storage-warning-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'storage-warning-banner';
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;background:rgba(232,80,74,.95);color:#fff;font-size:12px;font-family:var(--font-body);padding:10px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px;backdrop-filter:blur(4px)';
    banner.innerHTML = '<span><strong>⚠️ Storage full</strong> — Your trade data could not be saved. Export a backup from Settings → Reports immediately, then clear old screenshots or browser data.</span><button onclick="hideStorageWarning()" style="background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);color:#fff;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:11px;white-space:nowrap">Dismiss</button>';
    document.body.appendChild(banner);
  }
  banner.style.display = 'flex';
}

function hideStorageWarning() {
  const banner = document.getElementById('storage-warning-banner');
  if (banner) banner.style.display = 'none';
}

// ── Hardcoded demo trades have been REMOVED ──
// Application now loads all trades from Supabase backend only
function getDefaultTrades() {
  return []; // No hardcoded trades — loads from Supabase
}

// Initialize TRADES from localStorage
let TRADES = loadTrades();
// Force save cleaned trades to ensure consistency across all accounts
saveTradesToStorage();

// Persistent filter lists — user edits (add/remove) survive across opens
let fpSymbolList  = [...new Set(TRADES.map(t => t.symbol))].sort();
let fpSessionList = [...new Set(TRADES.map(t => t.session))].sort();

// Note: currentDir, selectedRating, currentDetailTrade already defined at top
let filteredTrades = [...TRADES];
let dirFilter = 'all';

// ── VIEW SWITCH ──
// ── Scroll position store ──
const _viewScrollPos = {};

function goToView(view) {
  var el = document.querySelector('[data-view="' + view + '"]');
  if (el) switchView(el);
}
function goToSettings() {
  var el = document.querySelector('[data-view="settings"]');
  if (el) switchView(el);
}
function switchView(el) {
  try {
    console.log('↓ switchView starting');
    
    // Save scroll position of current view before switching
    const currentView = document.querySelector('.view.active');
    if (currentView) {
      const key = currentView.id;
      _viewScrollPos[key] = window.scrollY || document.documentElement.scrollTop || 0;
    }

    $$('.nav-item').forEach(i=>i.classList.remove('active'));
    console.log('  → Found nav items:', $$('.nav-item').length);
    el.classList.add('active');
    console.log('  → Added active class to:', el.dataset?.view);
    const v = el.dataset.view;
    console.log('  → Switching to view:', v);
    
    $$('.view').forEach(i=>i.classList.remove('active'));
    const newView = $('view-'+v);
    if (newView) {
      newView.classList.add('active');
      console.log('  ✓ View element activated:', v);
    } else {
      console.error('  ✗ View element not found: view-' + v);
      throw new Error('View element not found: view-' + v);
    }
    
    // Show account selector only on dashboard and trade log
    const acctWrap = $('acct-dropdown-wrap');
    if (acctWrap) acctWrap.style.display = (v === 'dashboard' || v === 'tradelog') ? '' : 'none';

    // Show Add Trade button only on Dashboard (page 1) and Trade Log (page 2)
    const addTradeBtn = $('add-trade-btn-topbar');
    if (addTradeBtn) addTradeBtn.style.display = (v === 'dashboard' || v === 'tradelog') ? '' : 'none';

    // Initialize view-specific content
    try {
      if(v==='analytics'){ 
        console.log('  → Initializing analytics...');
        analyticsInitialized = false; 
        if (typeof initAnalyticsCharts === 'function') initAnalyticsCharts();
        if (typeof updateAnalyticsCards === 'function') updateAnalyticsCards();
        console.log('  ✓ Analytics initialized');
      }
    } catch(ea) { console.warn('  ! Analytics init error:', ea); }

    try {
      if(v==='advanalytics'){
        console.log('  → Initializing advanced analytics...');
        const barP4 = $('an-acct-bar-p4');
        if (barP4 && typeof buildAnAccountBar === 'function') barP4.innerHTML = buildAnAccountBar();
        const equityPanel = document.querySelector('#advan-grid .panel');
        const isAll = !anCurrentAccount || anCurrentAccount === '__all__';
        if (equityPanel) equityPanel.style.display = isAll ? 'none' : '';
        if (!isAll && typeof initEquityCurve === 'function') setTimeout(() => initEquityCurve('all'), 0);
        if (typeof initMonthlyPnL === 'function') setTimeout(() => initMonthlyPnL(), 50);
        if (typeof initRMultiple === 'function') setTimeout(() => initRMultiple(), 100);
        if (typeof initSymbolBreakdown === 'function') setTimeout(() => initSymbolBreakdown(), 150);
        if (typeof initStreaks === 'function') setTimeout(() => initStreaks(), 200);
        console.log('  ✓ Advanced analytics initialized');
      }
    } catch(eaa) { console.warn('  ! Advanced analytics error:', eaa); }

    try {
      if(v==='tradelog') {
        console.log('  → Initializing trade log...');
        if (typeof initTlogScrollIndicator === 'function') setTimeout(() => initTlogScrollIndicator(), 50);
        console.log('  ✓ Trade log initialized');
      }
    } catch(et) { console.warn('  ! Trade log error:', et); }

    closeDetail();
    
    // Show ? FAB only on settings page
    const fab = document.getElementById('kb-help-fab');
    if (fab) { fab.style.display = v === 'settings' ? 'flex' : 'none'; }
    
    // Normal navigation always goes to top (history nav overrides this via _go)
    if (!window._histNavInProgress) {
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    }
    
    console.log('↑ switchView complete');
  } catch (e) {
    console.error('✗ switchView error:', e);
  }
}

// ── RENDER TRADE TABLE ──
// ── UPDATE TRADE LOG STAT CARDS FROM filteredTrades ──
function updateTlCards(trades) {
  const total  = trades.length;
  const wins   = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);
  const winCount  = wins.length;
  const lossCount = losses.length;
  const winRate   = total > 0 ? ((winCount / total) * 100).toFixed(1) : '0.0';
  const grossPnl  = trades.reduce((s, t) => s + t.pnl + (t.comm || 0), 0);
  const totalComm = trades.reduce((s, t) => s + (t.comm || 0), 0);
  const netPnl    = trades.reduce((s, t) => s + t.pnl, 0);

  const now = new Date();
  const todayStr  = now.toISOString().slice(0, 10);
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  const monthStart= new Date(now.getFullYear(), now.getMonth(), 1);

  const todayTrades = trades.filter(t => t.date === todayStr).length;
  const weekTrades  = trades.filter(t => new Date(t.date) >= weekStart).length;
  const monthTrades = trades.filter(t => new Date(t.date) >= monthStart).length;

  // ── Card 1: Total Trades ticker ──
  const ttVal0 = $('tl-tt-val-0');
  const ttVal1 = $('tl-tt-val-1');
  const ttVal2 = $('tl-tt-val-2');
  const ttVal3 = $('tl-tt-val-3');
  if (ttVal0) ttVal0.textContent = total;
  if (ttVal1) ttVal1.textContent = todayTrades;
  if (ttVal2) ttVal2.textContent = weekTrades;
  if (ttVal3) ttVal3.textContent = monthTrades;

  // ── Card 2: P&L Breakdown ──
  const netEl = $('tl-net');
  if (netEl) {
    netEl.textContent = (netPnl >= 0 ? '+$' : '-$') + Math.abs(netPnl).toFixed(2);
    netEl.className = 'stat-val ' + (netPnl >= 0 ? 'c-green' : 'c-red');
  }
  const grossEl = $('tl-gross');
  if (grossEl) {
    grossEl.textContent = (grossPnl >= 0 ? '+$' : '-$') + Math.abs(grossPnl).toFixed(2);
    grossEl.style.color = grossPnl >= 0 ? 'var(--green)' : 'var(--red)';
  }
  const commEl = $('tl-comm');
  if (commEl) commEl.textContent = '-$' + Math.abs(totalComm).toFixed(2);

  // W/L bar
  const lossEl = $('tl-wl-loss');
  const winEl  = $('tl-wl-win');
  const barWin = $('tl-wl-bar-win');
  if (lossEl) lossEl.textContent = lossCount + 'L';
  if (winEl)  winEl.textContent  = winCount  + 'W';
  if (barWin) barWin.style.width = (total > 0 ? ((winCount / total) * 100).toFixed(1) : 0) + '%';

  // ── Card 3: Win Rate ──
  const wrEl = $('tl-winrate');
  const wrBadge = $('tl-wr-badge');
  const wrBar = document.querySelector('.mini-bar .mini-bar-fill');
  const wrColor = parseFloat(winRate) >= 50 ? 'var(--green)' : parseFloat(winRate) >= 40 ? 'var(--amber)' : 'var(--red)';
  const wrBarClass = parseFloat(winRate) >= 50 ? 'g' : parseFloat(winRate) >= 40 ? 'a' : 'r';
  const wrBadgeClass = parseFloat(winRate) >= 50 ? 'badge badge-green' : parseFloat(winRate) >= 40 ? 'badge badge-amber' : 'badge badge-red';
  const wrBadgeText  = parseFloat(winRate) >= 50 ? '● Profitable' : parseFloat(winRate) >= 40 ? '● Soon to be' : '● Broke';
  if (wrEl) { wrEl.textContent = winRate + '%'; wrEl.style.color = wrColor; }
  if (wrBadge) { wrBadge.className = wrBadgeClass; wrBadge.textContent = wrBadgeText; }

  // ── Profit Factor ──
  const grossWins   = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLosses = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const pfEl = $('tl-profit-factor');
  if (pfEl) {
    if (losses.length === 0 && wins.length > 0) {
      pfEl.textContent = '∞';
      pfEl.style.color = 'var(--green)';
    } else if (grossLosses === 0) {
      pfEl.textContent = '—';
      pfEl.style.color = 'var(--text3)';
    } else {
      const pf = (grossWins / grossLosses);
      pfEl.textContent = pf.toFixed(2);
      pfEl.style.color = pf >= 1.5 ? 'var(--green)' : pf >= 1 ? 'var(--amber)' : 'var(--red)';
    }
  }
  // ── Best & Worst trade (hover overlay) ──
  if (trades.length > 0) {
    // Helper: get startBal for a trade's account
    function _tradeAcctBal(t) {
      const acct = ACCOUNTS.find(a =>
        (a.key || a.phase) === (t.account || '') ||
        (a.firm + ' - ' + (a.key || a.phase)) === (t.account || '')
      );
      return (acct && acct.startBal > 0) ? acct.startBal : 25000;
    }

    // Mode: 'dollar' = best/worst by $PnL (default), 'pct' = best/worst by % of account
    const bwMode = window._bwCardMode || 'dollar';

    let best, worst;
    if (bwMode === 'pct') {
      // Rank by pnl as % of that trade's own account size
      best  = trades.reduce((b, t) => (t.pnl / _tradeAcctBal(t)) > (b.pnl / _tradeAcctBal(b)) ? t : b, trades[0]);
      worst = trades.reduce((w, t) => (t.pnl / _tradeAcctBal(t)) < (w.pnl / _tradeAcctBal(w)) ? t : w, trades[0]);
    } else {
      best  = trades.reduce((b, t) => t.pnl > b.pnl ? t : b, trades[0]);
      worst = trades.reduce((w, t) => t.pnl < w.pnl ? t : w, trades[0]);
    }

    const barTotal = Math.abs(best.pnl) + Math.abs(worst.pnl) || 1;
    const bestBarPct = ((Math.abs(best.pnl) / barTotal) * 100).toFixed(1);

    const bestValEl  = $('tl-best-val');
    const worstValEl = $('tl-worst-val');
    const bestSymEl  = $('tl-best-sym');
    const worstSymEl = $('tl-worst-sym');
    const bestLblEl  = $('tl-best-label');
    const worstLblEl = $('tl-worst-label');
    const bestBar    = $('tl-best-bar');

    // Build both dollar and pct strings
    const bestAcctBal   = _tradeAcctBal(best);
    const worstAcctBal  = _tradeAcctBal(worst);
    const bestPctVal    = (best.pnl  / bestAcctBal)  * 100;
    const worstPctVal   = (worst.pnl / worstAcctBal) * 100;
    const bestDolStr    = (best.pnl  >= 0 ? '+$' : '-$') + Math.abs(best.pnl).toFixed(2);
    const worstDolStr   = (worst.pnl >= 0 ? '+$' : '-$') + Math.abs(worst.pnl).toFixed(2);
    const bestPctStr    = (bestPctVal  >= 0 ? '+' : '') + bestPctVal.toFixed(2)  + '%';
    const worstPctStr   = (worstPctVal >= 0 ? '+' : '') + worstPctVal.toFixed(2) + '%';
    const bestColor     = best.pnl  >= 0 ? 'var(--green)' : 'var(--red)';
    const worstColor    = worst.pnl <  0 ? 'var(--red)'   : '#4a9e6b';

    // Store BOTH values as data-attributes — setBwCardMode reads them directly (no re-render)
    if (bestValEl)  { bestValEl.dataset.dollar  = bestDolStr;   bestValEl.dataset.pct  = bestPctStr;  bestValEl.dataset.color  = bestColor;
                      bestValEl.dataset.tradeId  = best.id;  bestValEl.style.cursor = 'pointer'; bestValEl.title = 'Click to view trade'; }
    if (worstValEl) { worstValEl.dataset.dollar = worstDolStr;  worstValEl.dataset.pct = worstPctStr; worstValEl.dataset.color = worstColor;
                      worstValEl.dataset.tradeId = worst.id; worstValEl.style.cursor = 'pointer'; worstValEl.title = 'Click to view trade'; }
    if (bestLblEl)  { bestLblEl.dataset.dollar  = bestDolStr;   bestLblEl.dataset.pct  = bestPctStr;  bestLblEl.dataset.color  = bestColor; }
    if (worstLblEl) { worstLblEl.dataset.dollar = worstDolStr;  worstLblEl.dataset.pct = worstPctStr; worstLblEl.dataset.color = worstColor; }
    if (bestSymEl)  bestSymEl.dataset.tradeId  = best.id;
    if (worstSymEl) worstSymEl.dataset.tradeId = worst.id;

    // Render based on current mode (large val = mode format, small label = other format)
    const _bwM = window._bwCardMode || 'dollar';
    if (bestValEl)  { bestValEl.textContent  = _bwM === 'pct' ? bestPctStr  : bestDolStr;  bestValEl.style.color  = bestColor; }
    if (worstValEl) { worstValEl.textContent = _bwM === 'pct' ? worstPctStr : worstDolStr; worstValEl.style.color = worstColor; }
    if (bestLblEl)  { bestLblEl.textContent  = _bwM === 'pct' ? bestDolStr  : bestPctStr;  bestLblEl.style.color  = bestColor; }
    if (worstLblEl) { worstLblEl.textContent = _bwM === 'pct' ? worstDolStr : worstPctStr; worstLblEl.style.color = worstColor; }
    if (bestBar)    bestBar.style.width    = bestBarPct + '%';
    const worstBar = $('tl-worst-bar');
    if (worstBar) {
      worstBar.style.background = worst.pnl < 0
        ? 'linear-gradient(90deg,#b53030,#e8504a)'
        : 'linear-gradient(90deg,#2a6644,#4a9e6b)';
      worstBar.style.boxShadow = worst.pnl < 0
        ? '0 0 6px rgba(232,80,74,.25)'
        : '0 0 6px rgba(74,158,107,.2)';
    }

    // Sync toggle button active state
    const btnDollar = $('tl-bw-toggle-dollar');
    const btnPct    = $('tl-bw-toggle-pct');
    if (btnDollar) { btnDollar.style.background = bwMode === 'dollar' ? 'var(--purple)' : 'transparent'; btnDollar.style.color = bwMode === 'dollar' ? '#fff' : 'var(--text3)'; btnDollar.style.boxShadow = bwMode === 'dollar' ? '0 1px 4px rgba(0,0,0,.35)' : 'none'; }
    if (btnPct)    { btnPct.style.background    = bwMode === 'pct'    ? 'var(--purple)' : 'transparent'; btnPct.style.color    = bwMode === 'pct'    ? '#fff' : 'var(--text3)'; btnPct.style.boxShadow    = bwMode === 'pct'    ? '0 1px 4px rgba(0,0,0,.35)' : 'none'; }
  }
}

// ── Best & Worst card: $ / % toggle ──
function setBwCardMode(mode) {
  if (window._bwCardMode === mode) return;
  window._bwCardMode = mode;

  const ids = ['tl-best-val','tl-worst-val','tl-best-label','tl-worst-label'];
  const els = ids.map(id => $(id)).filter(Boolean);

  // Fade out
  els.forEach(el => { el.style.transition = 'opacity .13s'; el.style.opacity = '0'; });

  setTimeout(function() {
    // Swap text from stored data-attributes
    const bestValEl  = $('tl-best-val');
    const worstValEl = $('tl-worst-val');
    const bestLblEl  = $('tl-best-label');
    const worstLblEl = $('tl-worst-label');

    if (bestValEl)  { bestValEl.textContent  = mode === 'pct' ? bestValEl.dataset.pct   : bestValEl.dataset.dollar;  bestValEl.style.color  = bestValEl.dataset.color  || ''; }
    if (worstValEl) { worstValEl.textContent = mode === 'pct' ? worstValEl.dataset.pct  : worstValEl.dataset.dollar; worstValEl.style.color = worstValEl.dataset.color || ''; }
    // Small labels show the OTHER format
    if (bestLblEl)  { bestLblEl.textContent  = mode === 'pct' ? bestLblEl.dataset.dollar  : bestLblEl.dataset.pct;  bestLblEl.style.color  = bestLblEl.dataset.color  || ''; }
    if (worstLblEl) { worstLblEl.textContent = mode === 'pct' ? worstLblEl.dataset.dollar : worstLblEl.dataset.pct; worstLblEl.style.color = worstLblEl.dataset.color || ''; }

    // Fade in
    els.forEach(el => { el.style.opacity = '1'; });

    // Update button styles
    const btnDollar = $('tl-bw-toggle-dollar');
    const btnPct    = $('tl-bw-toggle-pct');
    if (btnDollar) { btnDollar.style.background = mode === 'dollar' ? 'var(--purple)' : 'transparent'; btnDollar.style.color = mode === 'dollar' ? '#fff' : 'var(--text3)'; btnDollar.style.boxShadow = mode === 'dollar' ? '0 1px 4px rgba(0,0,0,.35)' : 'none'; }
    if (btnPct)    { btnPct.style.background    = mode === 'pct'    ? 'var(--purple)' : 'transparent'; btnPct.style.color    = mode === 'pct'    ? '#fff' : 'var(--text3)'; btnPct.style.boxShadow    = mode === 'pct'    ? '0 1px 4px rgba(0,0,0,.35)' : 'none'; }
  }, 140);
}

function navigateToBwTrade(el) {
  const id = el && el.dataset.tradeId;
  if (!id) return;
  const trade = TRADES.find(t => String(t.id) === String(id));
  if (!trade) return;
  window._streakIdFilter = [id];
  window._symbolQuickFilter = null;
  const nav = document.querySelector('.nav-item[data-view="tradelog"]');
  if (nav) switchView(nav);
  setTimeout(() => {
    applyFilters();
    setTimeout(() => {
      const row = document.querySelector('.trade-table tbody tr[data-id="' + id + '"]');
      if (trade && typeof showDetail === 'function') showDetail(trade, row || document.createElement('tr'));
      if (row) { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); row.classList.add('selected-row'); }
    }, 120);
  }, 60);
}

// ── PAGINATION STATE ──
const TRADES_PER_PAGE = 10;
let currentPage = 1;
let _lastTradesForPaging = [];

function renderTrades(trades) {
  _lastTradesForPaging = trades;
  const totalPages = Math.max(1, Math.ceil(trades.length / TRADES_PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * TRADES_PER_PAGE;
  const pageTrades = trades.slice(start, start + TRADES_PER_PAGE);

  const tb = $('trade-tbody');
  tb.innerHTML = '';

  // Manage select checkbox column in thead
  const thead = document.querySelector('#trade-table thead tr');
  let selTh = $('sel-th-all');
  if (selectModeActive) {
    if (!selTh) {
      selTh = document.createElement('th');
      selTh.id = 'sel-th-all';
      selTh.style.cssText = 'width:36px;padding:9px 10px';
      thead.insertBefore(selTh, thead.firstChild);
    }
  } else {
    if (selTh) selTh.remove();
  }

  pageTrades.forEach(t => {
    const tradeRes = getTradeResult(t);
    const isPos = t.pnl > 0;
    const isBE  = tradeRes === 'be';
    // Safety check: ensure denominator is not zero for R-multiple calculation
    const slDiff = t.sl ? Math.abs(t.entry - t.sl) : 0;
    const rmult = (t.sl && slDiff > 0) ? ((Math.abs(t.exit-t.entry)) / slDiff).toFixed(2) : '—';
    const tr = document.createElement('tr');
    tr.dataset.id = t.id;
    tr.classList.add(tradeRes === 'win' ? 'win-row' : tradeRes === 'be' ? 'be-row' : 'loss-row');
    if (selectModeActive && selectedIds.has(t.id)) tr.classList.add('sel-row-checked');

    let checkboxCell = '';
    if (selectModeActive) {
      checkboxCell = '<td style="width:36px;padding:9px 10px" onclick="toggleSelectRow(' + t.id + ', event)"><div id="sel-cb-' + t.id + '" class="sel-checkbox' + (selectedIds.has(t.id) ? ' checked' : '') + '" style="margin:0 auto"></div></td>';
    }

    tr.innerHTML = checkboxCell + `
      <td><span style="font-family:var(--font-mono);font-size:10px;background:var(--bg5);padding:3px 8px;border-radius:5px;white-space:nowrap">${t.account || '—'}</span></td>
      <td><span style="font-family:var(--font-mono);font-size:11.5px">${t.date}</span><br><span style="font-size:10px;color:var(--text3)">${format24to12Hour(t.time)}</span></td>
      <td>
        <div class="sym-cell">
          <div>
            <div class="sym-name">${t.symbol}</div>
            <div class="sym-type">${t.type}</div>
          </div>
        </div>
      </td>
      <td>${t.model ? `<span style="font-family:var(--font-mono);font-size:10px;background:var(--ac-15);border:1px solid var(--ac-25);color:#a97de8;padding:3px 8px;border-radius:5px;white-space:nowrap">${t.model}</span>` : '<span style="color:var(--text3);font-size:11px">—</span>'}</td>
      <td>${t.session ? `<span style="font-family:var(--font-mono);font-size:10px;background:rgba(99,179,237,.1);border:1px solid rgba(99,179,237,.25);color:#63b3ed;padding:3px 8px;border-radius:5px;white-space:nowrap">${t.session}</span>` : '<span style="color:var(--text3);font-size:11px">—</span>'}</td>
      <td><span class="dir-badge ${t.dir==='long'?'dir-long':'dir-short'}">${t.dir==='long'?'▲ LONG':'▼ SHORT'}</span></td>
      <td style="font-family:var(--font-mono);font-size:12px">${formatPrice(t.symbol, t.entry)}</td>
      <td style="font-family:var(--font-mono);font-size:12px">${formatPrice(t.symbol, t.exit)}</td>
      <td style="font-family:var(--font-mono);font-size:12px">${t.size}</td>
      <td><span class="${isBE?'pnl-be':isPos?'pnl-pos':'pnl-neg'}">${t.pnl>0?'+':''}\$${Math.abs(t.pnl).toFixed(2)}</span></td>
      <td style="font-family:var(--font-mono);font-size:12px;color:${parseFloat(rmult)>=1?'var(--green)':'var(--red)'}">${rmult === '—' ? '—' : (parseFloat(rmult)>=0?'+':'')+rmult+'R'}</td>
      <td><span class="${tradeRes==='win'?'result-win':tradeRes==='be'?'result-be':'result-loss'}">${tradeRes==='win'?'● WIN':tradeRes==='be'?'● BE':'● LOSS'}</span></td>
    `;
    tr.addEventListener('click', () => {
      if (selectModeActive) toggleSelectRow(t.id, {stopPropagation:()=>{}});
      else showDetail(t, tr);
    });
    tb.appendChild(tr);
  });

  const showing = trades.length === 0 ? 0 : Math.min(start + TRADES_PER_PAGE, trades.length);
  const tlogCount = $('tlog-count');
  if (tlogCount) {
    tlogCount.textContent = `Showing ${start + 1}–${showing} of ${trades.length} trades`;
    if (trades.length === 0) tlogCount.textContent = `No trades found`;
  }

  updateTlCards(trades);
  renderPagination(totalPages);
  if (selectModeActive) updateSelectAllCheckbox();
  initTlogScrollIndicator();
  if(typeof applyColVisibility==='function') applyColVisibility();
}

function goToPage(page) {
  currentPage = page;
  renderTrades(_lastTradesForPaging);
  // Scroll table to top smoothly
  const card = document.querySelector('.trade-record-card');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderPagination(totalPages) {
  const container = $('tlog-pages');
  if (!container) return;
  container.innerHTML = '';

  if (totalPages <= 1) return;

  const btn = (label, page, isActive, isDisabled) => {
    const b = document.createElement('button');
    b.className = 'page-btn' + (isActive ? ' active' : '');
    b.textContent = label;
    b.disabled = isDisabled;
    if (isDisabled) b.style.opacity = '0.3';
    if (!isDisabled) b.addEventListener('click', () => goToPage(page));
    return b;
  };

  // ‹ prev
  container.appendChild(btn('‹', currentPage - 1, false, currentPage === 1));

  // Page number buttons with smart ellipsis
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('…');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  pages.forEach(p => {
    if (p === '…') {
      const span = document.createElement('span');
      span.textContent = '…';
      span.style.cssText = 'color:var(--text3);font-size:11px;padding:0 4px;display:flex;align-items:center';
      container.appendChild(span);
    } else {
      container.appendChild(btn(p, p, p === currentPage, false));
    }
  });

  // › next
  container.appendChild(btn('›', currentPage + 1, false, currentPage === totalPages));
}

// Debounced filter — waits 150ms after last keystroke before applying
let _filterDebounce = null;
function filterTrades(q) {
  clearTimeout(_filterDebounce);
  _filterDebounce = setTimeout(applyFilters, 150);
}

function fpillClick(btn) {
  const group = btn.dataset.group;
  const isActive = btn.classList.contains('active');
  if (group === 'symbol' || group === 'session') {
    btn.classList.toggle('active');
    const check = btn.querySelector('.tl-check');
    if (btn.classList.contains('active')) {
      btn.style.background = 'var(--purple2)';
      btn.style.boxShadow = 'inset 0 0 8px var(--ac-50),inset 0 0 3px var(--ac-30)';
      btn.style.color = '#a97de8';
      if (check) check.style.opacity = '1';
    } else {
      btn.style.background = 'transparent';
      btn.style.boxShadow = '';
      btn.style.color = '#fff';
      if (check) check.style.opacity = '0';
    }
    updateListLabel(group);
  } else if (group === 'emotion') {
    // Multi-select for emotions
    btn.classList.toggle('active');
    if (btn.classList.contains('active')) {
      btn.style.background = 'rgba(107,31,212,.18)';
      btn.style.boxShadow = 'inset 0 0 8px var(--ac-50)';
      btn.style.color = '#c09ef5';
      btn.style.borderColor = 'var(--ac-50)';
    } else {
      btn.style.background = '';
      btn.style.boxShadow = '';
      btn.style.color = '';
      btn.style.borderColor = '';
    }
  } else {
    // Single-select (dir, result)
    $$(`.fpill[data-group="${group}"]`).forEach(b => b.classList.remove('active'));
    if (!isActive) btn.classList.add('active');
  }
}

function toggleListDropdown(type) {
  const triggerId = `fp-${type}-trigger`;
  const listId    = `fp-${type}-pills`;
  const arrowId   = `fp-${type}-arrow`;
  const trigger   = $(triggerId);
  const arrow     = $(arrowId);

  // Close the other dropdown if open
  const other = type === 'symbol' ? 'session' : 'symbol';
  const otherList = $(`fp-${other}-pills`);
  if (otherList) { otherList.style.display = 'none'; }
  const otherArrow = $(`fp-${other}-arrow`);
  if (otherArrow) otherArrow.style.transform = '';
  const otherTrigger = $(`fp-${other}-trigger`);
  if (otherTrigger) otherTrigger.style.borderColor = 'var(--border)';

  // Create list on body if not exists, and populate from persistent array
  let list = $(listId);
  if (!list) {
    list = document.createElement('div');
    list.id = listId;
    list.style.cssText = 'display:none;position:fixed;z-index:9999;background:var(--bg3);border:1px solid var(--ac-35);border-radius:8px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.6)';
    document.body.appendChild(list);
  }

  // Always rebuild from persistent list so add/remove changes stick
  const persistentList = type === 'symbol' ? fpSymbolList : fpSessionList;
  const activeVals = [...$$(`.fpill[data-group="${type}"].active`)].map(b => b.dataset.val);
  list.innerHTML = '';
  const scrollArea = document.createElement('div');
  scrollArea.style.cssText = 'overflow-y:auto;max-height:180px';
  persistentList.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'fpill'; b.dataset.group = type; b.dataset.val = s;
    if (activeVals.includes(s)) {
      b.classList.add('active');
      b.style.background = 'var(--purple2)';
      b.style.boxShadow = 'inset 0 0 8px var(--ac-50),inset 0 0 3px var(--ac-30)';
      b.style.color = '#a97de8';
    }
    b.onclick = () => fpillClick(b);
    b.style.cssText += `;display:flex;align-items:center;justify-content:space-between;width:100%;border:none;border-radius:0;padding:8px 14px;border-bottom:${i < persistentList.length-1 ? '1px solid rgba(255,255,255,.05)' : 'none'};font-size:12px;font-family:var(--font-body);color:${activeVals.includes(s)?'#a97de8':'#fff'};text-align:left;cursor:pointer;transition:background .15s`;
    b.innerHTML = `<span>${s}</span><div style="display:flex;align-items:center;gap:8px"><span class="tl-check" style="opacity:${activeVals.includes(s)?'1':'0'};color:var(--purple);font-size:11px">✓</span><span class="tl-trash" onclick="removeListItem(event,this)" style="opacity:0;color:var(--text3);font-size:11px;cursor:pointer;transition:all .15s;padding:2px 4px;border-radius:4px" onmouseenter="this.style.color='var(--red)';this.style.background='rgba(232,80,74,.1)'" onmouseleave="this.style.color='var(--text3)';this.style.background='transparent'" style="display:flex"><svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5 4V2.5h6V4M6 7v5M10 7v5M3 4l1 9.5h8L13 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></span></div>`;
    b.onmouseenter = () => { if (!b.classList.contains('active')) b.style.background = 'var(--ac-08)'; b.querySelector('.tl-trash').style.opacity='1'; };
    b.onmouseleave = () => { if (!b.classList.contains('active')) b.style.background = b.classList.contains('active') ? 'var(--purple2)' : 'transparent'; b.querySelector('.tl-trash').style.opacity='0'; };
    scrollArea.appendChild(b);
  });
  list.appendChild(scrollArea);
  if (type === 'symbol') {
    const addBar = document.createElement('div');
    addBar.style.cssText = 'border-top:1px solid var(--ac-20)';
    addBar.innerHTML = `
      <div id="fp-symbol-add-form" style="display:none">
        <div id="fp-symbol-results" style="max-height:207px;overflow-y:auto"></div>
        <div style="padding:7px 8px 5px;border-top:1px solid var(--ac-20)">
          <div style="display:flex;align-items:center;gap:6px;background:var(--bg5);border:1px solid var(--ac-35);border-radius:7px;padding:5px 10px">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="var(--ac-70)"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.156a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"/></svg>
            <input id="fp-symbol-new-input" placeholder="Search symbol..." oninput="symbolSearch(this.value)" onkeydown="symbolSearchKey(event)" autocomplete="off" style="flex:1;background:none;border:none;color:#fff;font-size:11px;font-family:var(--font-mono);outline:none;min-width:0"/>
          </div>
        </div>
        <div style="padding:4px 8px 6px;border-top:1px solid rgba(255,255,255,.04)">
          <button onclick="cancelAddSymbol()" style="width:100%;background:none;border:none;color:var(--text3);font-size:10px;font-family:var(--font-body);cursor:pointer;padding:2px 0;transition:color .15s;letter-spacing:.05em" onmouseenter="this.style.color='var(--red)'" onmouseleave="this.style.color='var(--text3)'"><span style="display:inline-flex;align-items:center;gap:4px"><svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg> Close</span></button>
        </div>
      </div>
      <button id="fp-symbol-add-btn" onclick="showAddSymbol()" style="width:100%;display:flex;align-items:center;gap:6px;background:none;border:none;padding:7px 10px;color:var(--ac-80);font-size:11px;font-family:var(--font-body);cursor:pointer;transition:color .15s" onmouseenter="this.style.color='var(--purple)'" onmouseleave="this.style.color='var(--ac-80)'">
        <span style="font-size:15px;line-height:1">+</span><span>Add Symbol</span>
      </button>
    `;
    list.appendChild(addBar);
  }
  if (type === 'session') {
    const addBar = document.createElement('div');
    addBar.style.cssText = 'border-top:1px solid var(--ac-20)';
    addBar.innerHTML = `
      <div id="fp-session-add-form" style="display:none">
        <div style="padding:7px 8px 5px">
          <div style="display:flex;align-items:center;gap:6px;background:var(--bg5);border:1px solid var(--ac-35);border-radius:7px;padding:5px 10px">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="var(--ac-70)"><path d="M2 5h12M2 8h12M2 11h7" stroke="var(--ac-70)" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>
            <input id="fp-session-new-input" placeholder="e.g. London, Asia..." onkeydown="sessionInputKey(event)" autocomplete="off" style="flex:1;background:none;border:none;color:#fff;font-size:11px;font-family:var(--font-body);outline:none;min-width:0"/>
            <button onclick="confirmAddSession()" style="background:var(--ac-20);border:1px solid var(--ac-40);border-radius:5px;color:var(--ac-90);font-size:10px;padding:2px 7px;cursor:pointer;font-family:var(--font-body);white-space:nowrap" onmouseenter="this.style.background='var(--ac-35)'" onmouseleave="this.style.background='var(--ac-20)'">Add</button>
          </div>
        </div>
        <div style="padding:4px 8px 6px;border-top:1px solid rgba(255,255,255,.04)">
          <button onclick="cancelAddSession()" style="width:100%;background:none;border:none;color:var(--text3);font-size:10px;font-family:var(--font-body);cursor:pointer;padding:2px 0;transition:color .15s;letter-spacing:.05em" onmouseenter="this.style.color='var(--red)'" onmouseleave="this.style.color='var(--text3)'"><span style="display:inline-flex;align-items:center;gap:4px"><svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg> Close</span></button>
        </div>
      </div>
      <button id="fp-session-add-btn" onclick="showAddSession()" style="width:100%;display:flex;align-items:center;gap:6px;background:none;border:none;padding:7px 10px;color:var(--ac-80);font-size:11px;font-family:var(--font-body);cursor:pointer;transition:color .15s" onmouseenter="this.style.color='var(--purple)'" onmouseleave="this.style.color='var(--ac-80)'">
        <span style="font-size:15px;line-height:1">+</span><span>Custom</span>
      </button>
    `;
    list.appendChild(addBar);
  }

  const isOpen = list.style.display !== 'none';
  if (isOpen) {
    list.style.display = 'none';
    arrow.style.transform = '';
    trigger.style.borderColor = 'var(--border)';
    trcUpdateHover();
    return;
  }

  // Always position below trigger, cap height if near bottom of viewport
  const rect = trigger.getBoundingClientRect();
  list.style.display = 'block';
  list.style.left  = rect.left + 'px';
  list.style.width = rect.width + 'px';
  list.style.top   = (rect.bottom + 4) + 'px';
  // Cap height so it doesn't go off bottom of screen
  const maxH = window.innerHeight - rect.bottom - 12;
  list.style.maxHeight = Math.max(120, maxH) + 'px';
  list.style.overflowY = 'auto';

  arrow.style.transform = 'rotate(180deg)';
  trigger.style.borderColor = 'var(--ac-50)';
  trcUpdateHover();

  // Reposition on scroll so dropdown follows the trigger
  function reposition() {
    if (list.style.display === 'none') return;
    const r = trigger.getBoundingClientRect();
    list.style.left = r.left + 'px';
    list.style.width = r.width + 'px';
    list.style.top = (r.bottom + 4) + 'px';
    const maxH = window.innerHeight - r.bottom - 12;
    list.style.maxHeight = Math.max(120, maxH) + 'px';
  }
  list._reposition = reposition;
  window.addEventListener('scroll', reposition, true);

  setTimeout(() => {
    function outsideClick(e) {
      if (!list.contains(e.target) && !trigger.contains(e.target)) {
        list.style.display = 'none';
        arrow.style.transform = '';
        trigger.style.borderColor = 'var(--border)';
        document.removeEventListener('click', outsideClick);
        window.removeEventListener('scroll', reposition, true);
      }
    }
    document.addEventListener('click', outsideClick);
  }, 0);
}

// ── SYMBOL SEARCH DATABASE ──
const SYMBOL_DB = [
  // Forex Majors
  {s:'EUR/USD',n:'Euro / US Dollar',t:'Forex'},
  {s:'GBP/USD',n:'British Pound / US Dollar',t:'Forex'},
  {s:'USD/JPY',n:'US Dollar / Japanese Yen',t:'Forex'},
  {s:'USD/CHF',n:'US Dollar / Swiss Franc',t:'Forex'},
  {s:'AUD/USD',n:'Australian Dollar / US Dollar',t:'Forex'},
  {s:'USD/CAD',n:'US Dollar / Canadian Dollar',t:'Forex'},
  {s:'NZD/USD',n:'New Zealand Dollar / US Dollar',t:'Forex'},
  // Forex Minors
  {s:'EUR/GBP',n:'Euro / British Pound',t:'Forex'},
  {s:'EUR/JPY',n:'Euro / Japanese Yen',t:'Forex'},
  {s:'GBP/JPY',n:'British Pound / Japanese Yen',t:'Forex'},
  {s:'EUR/CHF',n:'Euro / Swiss Franc',t:'Forex'},
  {s:'EUR/AUD',n:'Euro / Australian Dollar',t:'Forex'},
  {s:'EUR/CAD',n:'Euro / Canadian Dollar',t:'Forex'},
  {s:'GBP/CHF',n:'British Pound / Swiss Franc',t:'Forex'},
  {s:'GBP/AUD',n:'British Pound / Australian Dollar',t:'Forex'},
  {s:'GBP/CAD',n:'British Pound / Canadian Dollar',t:'Forex'},
  {s:'AUD/JPY',n:'Australian Dollar / Japanese Yen',t:'Forex'},
  {s:'AUD/CHF',n:'Australian Dollar / Swiss Franc',t:'Forex'},
  {s:'AUD/CAD',n:'Australian Dollar / Canadian Dollar',t:'Forex'},
  {s:'CAD/JPY',n:'Canadian Dollar / Japanese Yen',t:'Forex'},
  {s:'CHF/JPY',n:'Swiss Franc / Japanese Yen',t:'Forex'},
  {s:'NZD/JPY',n:'New Zealand Dollar / Japanese Yen',t:'Forex'},
  {s:'NZD/CHF',n:'New Zealand Dollar / Swiss Franc',t:'Forex'},
  // Metals
  {s:'XAU/USD',n:'Gold / US Dollar',t:'Metals'},
  {s:'XAG/USD',n:'Silver / US Dollar',t:'Metals'},
  {s:'XPT/USD',n:'Platinum / US Dollar',t:'Metals'},
  {s:'XPD/USD',n:'Palladium / US Dollar',t:'Metals'},
  // Futures
  {s:'ES1!',n:'E-Mini S&P 500',t:'Futures'},
  {s:'NQ1!',n:'E-Mini NASDAQ-100',t:'Futures'},
  {s:'YM1!',n:'E-Mini Dow Jones',t:'Futures'},
  {s:'RTY1!',n:'E-Mini Russell 2000',t:'Futures'},
  {s:'CL1!',n:'Crude Oil WTI',t:'Futures'},
  {s:'NG1!',n:'Natural Gas',t:'Futures'},
  {s:'GC1!',n:'Gold Futures',t:'Futures'},
  {s:'SI1!',n:'Silver Futures',t:'Futures'},
  {s:'ZB1!',n:'US 30-Year Treasury Bond',t:'Futures'},
  {s:'ZN1!',n:'US 10-Year Treasury Note',t:'Futures'},
  {s:'ZC1!',n:'Corn Futures',t:'Futures'},
  {s:'ZW1!',n:'Wheat Futures',t:'Futures'},
  {s:'ZS1!',n:'Soybean Futures',t:'Futures'},
  {s:'MES1!',n:'Micro E-Mini S&P 500',t:'Futures'},
  {s:'MNQ1!',n:'Micro E-Mini NASDAQ-100',t:'Futures'},
  {s:'MCL1!',n:'Micro Crude Oil',t:'Futures'},
  {s:'MGC1!',n:'Micro Gold',t:'Futures'},
  // Crypto
  {s:'BTC/USD',n:'Bitcoin / US Dollar',t:'Crypto'},
  {s:'ETH/USD',n:'Ethereum / US Dollar',t:'Crypto'},
  {s:'BTC/USDT',n:'Bitcoin / Tether',t:'Crypto'},
  {s:'ETH/USDT',n:'Ethereum / Tether',t:'Crypto'},
  {s:'BNB/USDT',n:'BNB / Tether',t:'Crypto'},
  {s:'SOL/USDT',n:'Solana / Tether',t:'Crypto'},
  {s:'XRP/USDT',n:'Ripple / Tether',t:'Crypto'},
  {s:'ADA/USDT',n:'Cardano / Tether',t:'Crypto'},
  {s:'DOGE/USDT',n:'Dogecoin / Tether',t:'Crypto'},
  {s:'AVAX/USDT',n:'Avalanche / Tether',t:'Crypto'},
  {s:'DOT/USDT',n:'Polkadot / Tether',t:'Crypto'},
  {s:'LINK/USDT',n:'Chainlink / Tether',t:'Crypto'},
  {s:'SOL/USD',n:'Solana / US Dollar',t:'Crypto'},
  {s:'ETH/BTC',n:'Ethereum / Bitcoin',t:'Crypto'},
];

let symbolSearchIndex = 0;

function symbolSearch(q) {
  const results = $('fp-symbol-results');
  if (!results) return;
  symbolSearchIndex = 0;

  // Hide/show the main symbol list based on whether user is typing
  const scrollArea = document.querySelector('#fp-symbol-pills > div');
  if (scrollArea) scrollArea.style.display = q.trim() ? 'none' : 'block';

  if (!q.trim()) { results.innerHTML = ''; return; }
  const query = q.toUpperCase().replace('/','');
  const existing = fpSymbolList;
  const matches = SYMBOL_DB
    .filter(i => !existing.includes(i.s))
    .map(i => {
      const sym = i.s.replace('/','');
      let score = 0;
      if (sym.startsWith(query)) score = 100;
      else if (i.s.startsWith(q.toUpperCase())) score = 90;
      else if (sym.includes(query)) score = 50;
      else if (i.n.toUpperCase().includes(q.toUpperCase())) score = 30;
      return {...i, score};
    })
    .filter(i => i.score > 0)
    .sort((a,b) => b.score - a.score)
    .slice(0, 8);

  if (!matches.length) {
    results.innerHTML = '<div style="padding:10px 12px;color:var(--text3);font-size:11px;font-family:\'JetBrains Mono\',monospace;text-align:center">No results found</div>';
    return;
  }

  // Each row ~52px tall, show 4 full + half of 5th = ~4.5 * 52 = 234px
  results.style.maxHeight = '207px';

  const typeColors = {Forex:'var(--blue)',Futures:'var(--amber)',Crypto:'var(--green)',Metals:'#c9a84c'};
  const firstBg = 'var(--ac-08)';
  results.innerHTML = matches.map((m,idx) => {
    const isFirst = idx === 0;
    const bg = isFirst ? firstBg : 'transparent';
    const color = typeColors[m.t] || 'var(--text3)';
    return `<div onclick="addSymbolFromSearch('${m.s}')" data-idx="${idx}"
      style="display:flex;align-items:center;justify-content:space-between;padding:7px 12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.03);transition:background .1s;background:${bg}"
      onmouseenter="this.style.background='var(--ac-08)';symbolSearchIndex=${idx}"
      onmouseleave="this.style.background='${bg}'">
      <div>
        <div style="font-size:12px;font-family:var(--font-mono);color:#fff;font-weight:500">${m.s}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:1px">${m.n}</div>
      </div>
      <span style="font-size:9px;font-family:var(--font-mono);color:${color};background:rgba(255,255,255,.05);padding:2px 6px;border-radius:4px;letter-spacing:.05em">${m.t}</span>
    </div>`;
  }).join('');
}

function symbolSearchKey(e) {
  const results = $('fp-symbol-results');
  const rows = results?.querySelectorAll('div[data-idx]');
  if (!rows?.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    symbolSearchIndex = Math.min(symbolSearchIndex + 1, rows.length - 1);
    rows.forEach((r,i) => r.style.background = i===symbolSearchIndex ? 'var(--ac-08)' : 'transparent');
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    symbolSearchIndex = Math.max(symbolSearchIndex - 1, 0);
    rows.forEach((r,i) => r.style.background = i===symbolSearchIndex ? 'var(--ac-08)' : 'transparent');
  } else if (e.key === 'Enter') {
    const active = results.querySelector(`div[data-idx="${symbolSearchIndex}"]`);
    if (active) active.click();
  } else if (e.key === 'Escape') {
    cancelAddSymbol();
  }
}

function addSymbolFromSearch(sym) {
  if (fpSymbolList.includes(sym)) { cancelAddSymbol(); return; }
  fpSymbolList.unshift(sym);
  const scrollArea = document.querySelector('#fp-symbol-pills > div');
  if (scrollArea) {
    const b = document.createElement('button');
    b.className = 'fpill'; b.dataset.group = 'symbol'; b.dataset.val = sym;
    b.onclick = () => fpillClick(b);
    b.style.cssText = `display:flex;align-items:center;justify-content:space-between;width:100%;border:none;border-radius:0;padding:8px 14px;background:transparent;border-bottom:${scrollArea.children.length > 0 ? '1px solid rgba(255,255,255,.05)' : 'none'};font-size:12px;font-family:var(--font-body);color:#fff;text-align:left;cursor:pointer;transition:background .15s`;
    b.innerHTML = `<span>${sym}</span><div style="display:flex;align-items:center;gap:8px"><span class="tl-check" style="opacity:0;color:var(--purple);font-size:11px">✓</span><span class="tl-trash" onclick="removeListItem(event,this)" style="opacity:0;color:var(--text3);font-size:11px;cursor:pointer;transition:all .15s;padding:2px 4px;border-radius:4px" onmouseenter="this.style.color='var(--red)';this.style.background='rgba(232,80,74,.1)'" onmouseleave="this.style.color='var(--text3)';this.style.background='transparent'" style="display:flex"><svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5 4V2.5h6V4M6 7v5M10 7v5M3 4l1 9.5h8L13 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></span></div>`;
    b.onmouseenter = () => { if (!b.classList.contains('active')) b.style.background = 'var(--ac-08)'; b.querySelector('.tl-trash').style.opacity='1'; };
    b.onmouseleave = () => { if (!b.classList.contains('active')) b.style.background = 'transparent'; b.querySelector('.tl-trash').style.opacity='0'; };
    scrollArea.prepend(b);
  }
  cancelAddSymbol();
  updateListLabel('symbol');
}

function confirmAddSymbol() { /* replaced by search */ }

function removeListItem(e, trashEl) {
  e.stopPropagation();
  const btn = trashEl.closest('button');
  const group = btn.dataset.group;
  const val = btn.dataset.val;
  if (group === 'symbol') fpSymbolList = fpSymbolList.filter(s => s !== val);
  else fpSessionList = fpSessionList.filter(s => s !== val);
  btn.remove();
  updateListLabel(group);
}

function showAddSymbol() {
  $('fp-symbol-add-btn').style.display = 'none';
  $('fp-symbol-add-form').style.display = 'block';
  const input = $('fp-symbol-new-input');
  input.value = '';
  input.focus();
  symbolSearch('');
}
function cancelAddSymbol() {
  $('fp-symbol-add-form').style.display = 'none';
  $('fp-symbol-add-btn').style.display = 'flex';
  const input = $('fp-symbol-new-input');
  if (input) input.value = '';
  const results = $('fp-symbol-results');
  if (results) results.innerHTML = '';
  const scrollArea = document.querySelector('#fp-symbol-pills > div');
  if (scrollArea) scrollArea.style.display = 'block';
}

function showAddSession() {
  $('fp-session-add-btn').style.display = 'none';
  $('fp-session-add-form').style.display = 'block';
  const input = $('fp-session-new-input');
  if (input) { input.value = ''; input.focus(); }
}
function cancelAddSession() {
  $('fp-session-add-form').style.display = 'none';
  $('fp-session-add-btn').style.display = 'flex';
  const input = $('fp-session-new-input');
  if (input) input.value = '';
}
function sessionInputKey(e) {
  if (e.key === 'Enter') confirmAddSession();
  if (e.key === 'Escape') cancelAddSession();
}
function confirmAddSession() {
  const input = $('fp-session-new-input');
  if (!input) return;
  const val = input.value.trim();
  if (!val) {
    input.style.borderColor = 'var(--red)';
    setTimeout(() => input.style.borderColor = '', 1000);
    return;
  }
  if (fpSessionList.includes(val)) { cancelAddSession(); return; }
  fpSessionList.unshift(val);
  // Rebuild list by reopening
  const list = $('fp-list-session');
  if (!list) { cancelAddSession(); return; }
  const scrollArea = list.querySelector('div');
  if (!scrollArea) return;
  const activeVals = [...$$('.fpill[data-group="session"].active')].map(b => b.dataset.val);
  const b = document.createElement('button');
  b.className = 'fpill'; b.dataset.group = 'session'; b.dataset.val = val;
  b.onclick = () => fpillClick(b);
  b.style.cssText = `display:flex;align-items:center;justify-content:space-between;width:100%;border:none;border-radius:0;padding:8px 14px;background:transparent;border-bottom:${scrollArea.children.length > 0 ? '1px solid rgba(255,255,255,.05)' : 'none'};font-size:12px;font-family:var(--font-body);color:#fff;text-align:left;cursor:pointer;transition:background .15s`;
  b.innerHTML = `<span>${val}</span><div style="display:flex;align-items:center;gap:8px"><span class="tl-check" style="opacity:0;color:var(--purple);font-size:11px">✓</span><span class="tl-trash" onclick="removeListItem(event,this)" style="opacity:0;color:var(--text3);font-size:11px;cursor:pointer;transition:all .15s;padding:2px 4px;border-radius:4px" onmouseenter="this.style.color='var(--red)';this.style.background='rgba(232,80,74,.1)'" onmouseleave="this.style.color='var(--text3)';this.style.background='transparent'" style="display:flex"><svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5 4V2.5h6V4M6 7v5M10 7v5M3 4l1 9.5h8L13 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></span></div>`;
  b.onmouseenter = () => { if (!b.classList.contains('active')) b.style.background = 'var(--ac-08)'; b.querySelector('.tl-trash').style.opacity='1'; };
  b.onmouseleave = () => { if (!b.classList.contains('active')) b.style.background = 'transparent'; b.querySelector('.tl-trash').style.opacity='0'; };
  scrollArea.prepend(b);
  cancelAddSession();
  updateListLabel('session');
}
function updateListLabel(type) {
  const active = [...$$(`.fpill[data-group="${type}"].active`)].map(b => b.dataset.val);
  const label  = $(`fp-${type}-label`);
  if (!label) return;
  if (active.length === 0) label.textContent = type === 'symbol' ? 'All Symbols' : 'All Sessions';
  else if (active.length === 1) label.textContent = active[0];
  else label.textContent = `${active.length} selected`;
}

function closeFilterPanel() {
  const panel = $('filter-panel');
  const btn = $('filter-panel-btn');
  if (panel && panel.style.maxHeight !== '0px' && panel.style.maxHeight !== '') {
    panel.style.maxHeight = '0';
    panel.style.opacity = '0';
    panel.style.padding = '0 18px';
    panel.style.borderBottomWidth = '0px';
    if (btn) btn.classList.remove('active');
    updateFilterBtnState();
    document.removeEventListener('click', filterPanelOutsideClick);
  }
}

function filterPanelOutsideClick(e) {
  if (window._calJustPicked) return;
  const container = document.querySelector('.tlog-filters')?.closest('div');
  const panel = $('filter-panel');
  const cal = $('fp-cal');
  const symbolDrop = $('fp-symbol-pills');
  const sessionDrop = $('fp-session-pills');
  const acctDd = $('fp-acct-dd');
  if (
    (container && container.contains(e.target)) ||
    (panel && panel.contains(e.target)) ||
    (cal && cal.contains(e.target)) ||
    (symbolDrop && symbolDrop.contains(e.target)) ||
    (sessionDrop && sessionDrop.contains(e.target)) ||
    (acctDd && acctDd.contains(e.target))
  ) return;
  closeFilterPanel();
}

function toggleFilterPanel() {
  const panel = $('filter-panel');
  const btn = $('filter-panel-btn');
  const open = panel.style.maxHeight !== '0px' && panel.style.maxHeight !== '';
  if (open) {
    panel.style.maxHeight = '0';
    panel.style.opacity = '0';
    panel.style.padding = '0 18px';
    panel.style.borderBottomWidth = '0px';
    if (btn) btn.classList.remove('active');
    updateFilterBtnState();
    document.removeEventListener('click', filterPanelOutsideClick);
  } else {
    panel.style.maxHeight = '400px';
    panel.style.opacity = '1';
    panel.style.padding = '14px 18px';
    panel.style.borderBottomWidth = '1px';
    if (btn) btn.classList.toggle('active', true);
    setTimeout(() => document.addEventListener('click', filterPanelOutsideClick), 0);
  }
}

let _fpAcctOpen = false;
window._fpAcctOpen = false;

function toggleFpAcctDd() {
  if (_fpAcctOpen) { closeFpAcctDd(); return; }
  _fpAcctOpen = true;
  window._fpAcctOpen = true;

  const trigger = $('fp-acct-trigger');
  const chevron = $('fp-acct-chevron');
  const hidden  = $('fp-account');
  const current = hidden ? hidden.value : '';
  if (chevron) chevron.style.transform = 'rotate(180deg)';
  if (trigger) trigger.style.borderColor = 'var(--ac-50)';

  // Build or reuse dropdown appended to body
  let dd = $('fp-acct-dd');
  if (!dd) {
    dd = document.createElement('div');
    dd.id = 'fp-acct-dd';
    dd.style.cssText = 'position:fixed;background:var(--bg2);border:1px solid var(--ac-25);border-radius:8px;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,.6);overflow:hidden;min-width:200px';
    document.body.appendChild(dd);
  }

  // Populate options
  const opts = [{ key: '', label: 'All Accounts' }].concat(
    ACCOUNTS.map(a => ({ key: a.key || a.phase, label: a.firm + ' — ' + a.phase }))
  );
  dd.innerHTML = opts.map(o => {
    const sel = o.key === current;
    return `<div onclick="fpAcctSelect('${o.key.replace(/'/g,"\\'")}','${o.label.replace(/'/g,"\\'")}',this)"
      style="padding:8px 12px;font-size:11px;font-family:var(--font-mono);cursor:pointer;display:flex;align-items:center;justify-content:space-between;color:${sel?'var(--purple)':'var(--text2)'};background:${sel?'var(--ac-10)':'transparent'};transition:background .1s"
      onmouseenter="this.style.background='var(--ac-08)';this.style.color='var(--text)'"
      onmouseleave="this.style.background='${sel?'var(--ac-10)':'transparent'}';this.style.color='${sel?'var(--purple)':'var(--text2)'}'">
      <span>${o.label}</span>
      ${sel ? '<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M1.5 6l3 3 6-6" stroke="var(--purple)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
    </div>`;
  }).join('');

  // Position below trigger and track scroll
  function fpAcctReposition() {
    const t = $('fp-acct-trigger');
    const d = $('fp-acct-dd');
    if (!t || !d || d.style.display === 'none') {
      window.removeEventListener('scroll', fpAcctReposition, true);
      return;
    }
    const r = t.getBoundingClientRect();
    d.style.top  = (r.bottom + 4) + 'px';
    d.style.left = r.left + 'px';
    d.style.width = r.width + 'px';
  }
  fpAcctReposition();
  dd.style.display = 'block';
  dd._removeScroll = () => window.removeEventListener('scroll', fpAcctReposition, true);
  window.addEventListener('scroll', fpAcctReposition, true);

  setTimeout(() => {
    document.addEventListener('click', fpAcctOutside);
  }, 0);
}

function closeFpAcctDd() {
  _fpAcctOpen = false;
  window._fpAcctOpen = false;
  const dd = $('fp-acct-dd');
  if (dd) { dd.style.display = 'none'; if (dd._removeScroll) dd._removeScroll(); }
  const chevron = $('fp-acct-chevron');
  if (chevron) chevron.style.transform = 'rotate(0)';
  const trigger = $('fp-acct-trigger');
  const val = $('fp-account')?.value;
  if (trigger) trigger.style.borderColor = val ? 'var(--ac-40)' : 'var(--border)';
  document.removeEventListener('click', fpAcctOutside);
}

function fpAcctOutside(e) {
  const dd = $('fp-acct-dd');
  const trigger = $('fp-acct-trigger');
  if (dd && !dd.contains(e.target) && trigger && !trigger.contains(e.target)) closeFpAcctDd();
}

// Apply filters on Enter key while filter panel is open
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    const panel = $('filter-panel');
    if (panel && panel.style.maxHeight !== '0px' && panel.style.maxHeight !== '') {
      applyFilters();
      toggleFilterPanel();
    }
  }
});

function fpAcctSelect(key, label) {
  const hidden = $('fp-account');
  if (hidden) hidden.value = key;
  const lbl = $('fp-acct-label');
  if (lbl) { lbl.textContent = label; lbl.style.color = key ? 'var(--text)' : 'var(--text3)'; }
  closeFpAcctDd();
}

function updateFilterBtnState() {
  const dir     = document.querySelector('.fpill[data-group="dir"].active')?.dataset.val || 'all';
  const result  = document.querySelector('.fpill[data-group="result"].active')?.dataset.val || 'all';
  const symbols  = [...$$('.fpill[data-group="symbol"].active')];
  const sessions = [...$$('.fpill[data-group="session"].active')];
  const pnlMin  = NaN;
  const pnlMax  = NaN;
  const acctFilter = $('fp-account')?.value || '';
  const emotionsActive = [...$$('.fpill[data-group="emotion"].active')];
  const hasFilter = dir !== 'all' || result !== 'all' || symbols.length > 0 || sessions.length > 0 || emotionsActive.length > 0 || calFromVal || calToVal || acctFilter;
  const filterBtn = $('filter-panel-btn');
  const filterDot = $('filter-dot');
  if (filterDot) filterDot.style.display = 'none';
  if (filterBtn) filterBtn.style.boxShadow = hasFilter ? '0 0 8px var(--ac-80), 0 0 16px var(--ac-40)' : '';
  if (filterBtn) filterBtn.style.borderColor = hasFilter ? 'var(--ac-60)' : '';
}

function resetFilters() {
  // Clear symbol quick-filter
  window._symbolQuickFilter = null;
  // Clear streak id filter
  window._streakIdFilter = null;
  const symLabel = $('fp-symbol-label');
  if (symLabel) { symLabel.textContent = 'All Symbols'; symLabel.style.color = ''; }

  $$('.fpill').forEach(b => {
    b.classList.remove('active');
    const check = b.querySelector('.tl-check');
    if (check) check.style.opacity = '0';
    if (b.dataset.group === 'symbol' || b.dataset.group === 'session') {
      b.style.background = 'transparent'; b.style.boxShadow = ''; b.style.color = '#fff';
    }
    if (b.dataset.group === 'emotion') {
      b.style.background = ''; b.style.boxShadow = ''; b.style.color = ''; b.style.borderColor = '';
    }
  });
  updateListLabel('symbol'); updateListLabel('session');
  $('fp-from-label').textContent = 'From';
  $('fp-to-label').textContent = 'To';
  $('fp-date-from-display').style.color = 'var(--text3)';
  $('fp-date-to-display').style.color = 'var(--text3)';
  calFromVal = ''; calToVal = '';
  closeCal();
  const fpAcct = $('fp-account');
  if (fpAcct) fpAcct.value = '';
  const fpAcctLbl = $('fp-acct-label');
  if (fpAcctLbl) { fpAcctLbl.textContent = 'All Accounts'; fpAcctLbl.style.color = 'var(--text3)'; }
  const fpAcctTrigger = $('fp-acct-trigger');
  if (fpAcctTrigger) fpAcctTrigger.style.borderColor = 'var(--border)';
  // search bar removed
  applyFilters();
  closeFilterPanel();
}

function filterDir(el, dir) {
  $$('.filter-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  dirFilter = dir;
  applyFilters();
}

function applyFilters() {
  const search   = (document.querySelector('.filter-search')?.value || '').toLowerCase();
  const dir      = document.querySelector('.fpill[data-group="dir"].active')?.dataset.val || 'all';
  const result   = document.querySelector('.fpill[data-group="result"].active')?.dataset.val || 'all';
  const symbols  = [...$$('.fpill[data-group="symbol"].active')].map(b => b.dataset.val);
  const sessions = [...$$('.fpill[data-group="session"].active')].map(b => b.dataset.val);
  const emotions = [...$$('.fpill[data-group="emotion"].active')].map(b => b.dataset.val);
  const dateFrom = calFromVal || '';
  const dateTo   = calToVal   || '';
  const acctFilter2 = $('fp-account')?.value || '';

  // Account filtering: always driven by selectedAcct (header selector)
  const acctName = selectedAcct === -1 ? '' :
    (ACCOUNTS[selectedAcct] ? (ACCOUNTS[selectedAcct].key || ACCOUNTS[selectedAcct].phase) : '');

  // Save filter state to localStorage
  const filterState = { search, dir, result, symbols, sessions, emotions, dateFrom, dateTo, acctFilter2 };
  try { localStorage.setItem('et-filter-state', JSON.stringify(filterState)); } catch(e) {}

  // Quick-filter set by filterTradesBySymbol (bypasses pill DOM dependency)
  const quickSym = window._symbolQuickFilter || null;
  const quickSession = window._sessionQuickFilter || null;
  // Quick-filter set by streak badge click
  const quickIds = window._streakIdFilter ? new Set(window._streakIdFilter.map(String)) : null;

  let res = [...TRADES];
  if (acctName) res = res.filter(t => (t.account || '') === acctName);
  if (quickIds)           res = res.filter(t => quickIds.has(String(t.id)));
  else {
  if (dir !== 'all')      res = res.filter(t => t.dir === dir);
  if (result === 'win')   res = res.filter(t => t.pnl > 0);
  if (result === 'loss')  res = res.filter(t => t.pnl < 0);
  if (quickSym)           res = res.filter(t => t.symbol.toUpperCase() === quickSym.toUpperCase());
  else if (symbols.length > 0) res = res.filter(t => symbols.includes(t.symbol));
  if (quickSession)       res = res.filter(t => (t.session||'').toLowerCase() === quickSession.toLowerCase());
  else if (sessions.length > 0) res = res.filter(t => sessions.includes(t.session));
  if (dateFrom) res = res.filter(t => t.date >= dateFrom);
  if (dateTo)   res = res.filter(t => t.date <= dateTo);
  if (search)   res = res.filter(t => t.symbol.toLowerCase().includes(search) || t.setup.toLowerCase().includes(search) || (t.notes||'').toLowerCase().includes(search));
  if (emotions.length > 0) res = res.filter(t => {
    const te = t.emotions || [];
    return emotions.some(e => te.includes(e));
  });
  }

  // Glow filter button if any filter is active
  const hasFilter = dir !== 'all' || result !== 'all' || symbols.length > 0 || quickSym || quickSession || quickIds || sessions.length > 0 || emotions.length > 0 || dateFrom || dateTo || !!acctFilter2;
  const filterBtn = $('filter-panel-btn');
  const filterDot = $('filter-dot');
  if (filterDot) filterDot.style.display = 'none';
  if (filterBtn) filterBtn.style.boxShadow = hasFilter ? '0 0 8px var(--ac-80), 0 0 16px var(--ac-40)' : '';
  if (filterBtn) filterBtn.style.borderColor = hasFilter ? 'var(--ac-60)' : '';

  filteredTrades = res;
  currentPage = 1;
  renderTrades(res);
}

// Restore saved filter state from localStorage
function restoreSavedFilters() {
  try {
    const saved = localStorage.getItem('et-filter-state');
    if (!saved) return;
    
    const state = JSON.parse(saved);
    
    // Restore search
    if (state.search) {
      const searchInput = document.querySelector('.filter-search');
      if (searchInput) searchInput.value = state.search;
    }
    
    // Restore date range
    if (state.dateFrom) calFromVal = state.dateFrom;
    if (state.dateTo) calToVal = state.dateTo;
    
    // Account filter is now controlled by the header button — never restore from saved state
    const acctSelect = $('fp-account');
    if (acctSelect) acctSelect.value = '';
    
    // Note: Pills (dir, result, symbols, sessions) are dynamically generated
    // so they'll be restored when the filter panel is next opened
    // We just apply the filters with current state
    applyFilters();
  } catch(e) {
    console.log('Could not restore filters:', e);
  }
}

// Filter trades by specific date (used when clicking Daily P&L chart)
function filterTradesByDate(date) {
  // Set both from and to date to the same day
  calFromVal = date;
  calToVal = date;
  
  // Clear other filters
  $$('.fpill.active').forEach(pill => {
    if (pill.dataset.val !== 'all') {
      pill.classList.remove('active');
    }
  });
  
  // Set "all" pills to active
  $$('.fpill[data-val="all"]').forEach(pill => {
    pill.classList.add('active');
  });
  
  // Apply the date filter
  applyFilters();
  
  // Update calendar UI to show selected date
  updateCalendarHighlight(date);
}

// ── FILTER TRADE LOG BY SYMBOL (from Symbol Breakdown) ──
function goBackToSymbolBreakdown() {
  // Clear the symbol quick filter
  window._symbolQuickFilter = null;
  const symLabel = $('fp-symbol-label');
  if (symLabel) { symLabel.textContent = 'All Symbols'; symLabel.style.color = ''; }

  // Navigate to Advanced Analytics (Symbol Breakdown lives there)
  const advNav = document.querySelector('.nav-item[data-view="advanalytics"]');
  if (advNav) switchView(advNav);
}

/* ─── NAVIGATE TO TRADE LOG WITH FILTER ─────────────────────────────────────
 *  filter: { type: 'symbol'|'session'|'day'|'hour'|'result'|'ids', value: ... }
 */
function navigateToLog(filter) {
  // 0. Preserve the currently selected account so the trade log stays filtered to it.
  //    Analytics page uses selectedAcct; Adv Analytics uses anCurrentAccount — sync both.
  if (typeof anCurrentAccount !== 'undefined' && anCurrentAccount && anCurrentAccount !== '__all__') {
    const matchIdx = ACCOUNTS.findIndex(a => (a.key || a.phase) === anCurrentAccount);
    if (matchIdx !== -1 && selectedAcct !== matchIdx) selectAcct(matchIdx);
  }
  // selectedAcct is already correct when called from the regular Analytics page.

  // 1. Reset all quick-filters
  window._symbolQuickFilter = null;
  window._sessionQuickFilter = null;
  window._streakIdFilter = null;
  calFromVal = ''; calToVal = '';

  // Reset pills
  $$('.fpill').forEach(p => p.classList.remove('active'));
  const firstDir = document.querySelector('.fpill[data-group="dir"][data-val="all"]');
  const firstRes = document.querySelector('.fpill[data-group="result"][data-val="all"]');
  if (firstDir) firstDir.classList.add('active');
  if (firstRes) firstRes.classList.add('active');

  // 2. Determine the account scope for id-based filters (day/hour) so they respect the account too
  const acctName = selectedAcct === -1 ? '' :
    (ACCOUNTS[selectedAcct] ? (ACCOUNTS[selectedAcct].key || ACCOUNTS[selectedAcct].phase) : '');
  const scopedTrades = acctName
    ? (TRADES || []).filter(t => (t.account || '') === acctName)
    : (TRADES || []);

  // 3. Apply the requested filter
  if (filter.type === 'symbol') {
    window._symbolQuickFilter = filter.value;
  } else if (filter.type === 'session') {
    const pill = document.querySelector(`.fpill[data-group="session"][data-val="${CSS.escape(filter.value)}"]`);
    if (pill) { pill.classList.add('active'); }
    else { window._symbolQuickFilter = null; window._sessionQuickFilter = filter.value; }
  } else if (filter.type === 'day') {
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const dayIdx = dayNames.indexOf(filter.value);
    const ids = scopedTrades.filter(t => new Date(t.date).getDay() === dayIdx).map(t => String(t.id));
    window._streakIdFilter = ids;
  } else if (filter.type === 'hour') {
    const ids = scopedTrades.filter(t => {
      const h = parseInt((t.time||'0:0').split(':')[0]);
      const label = h < 12 ? h+'am' : h===12?'12pm':(h-12)+'pm';
      return label === filter.value;
    }).map(t => String(t.id));
    window._streakIdFilter = ids;
  } else if (filter.type === 'result') {
    const pill = document.querySelector(`.fpill[data-group="result"][data-val="${filter.value}"]`);
    if (pill) { if (firstRes) firstRes.classList.remove('active'); pill.classList.add('active'); }
  } else if (filter.type === 'ids') {
    window._streakIdFilter = filter.value;
  }

  // 4. Switch to trade log and apply
  const nav = document.querySelector('.nav-item[data-view="tradelog"]');
  if (nav) switchView(nav);
  setTimeout(() => { applyFilters(); }, 60);

  // 4. Flash a toast to explain the filter
  setTimeout(() => {
    const label = (() => {
      if (filter.type === 'symbol')  return 'Filtered: ' + filter.value;
      if (filter.type === 'session') return 'Filtered: ' + filter.value + ' session';
      if (filter.type === 'day')     return 'Filtered: ' + filter.value + ' trades';
      if (filter.type === 'hour')    return 'Filtered: ' + filter.value + ' trades';
      if (filter.type === 'result')  return 'Filtered: ' + (filter.value === 'win' ? 'Winning' : 'Losing') + ' trades';
      if (filter.type === 'ids')     return 'Filtered: ' + (Array.isArray(filter.value) ? filter.value.length : 0) + ' trades';
      return 'Filtered';
    })();
    if (typeof showToast === 'function') showToast(label, 'info', '', 2000);
  }, 180);
}

function filterTradesBySymbol(sym) {
  // Clear any previous quick filters
  window._symbolQuickFilter = sym;
  window._streakIdFilter = null;

  // If called from Advanced Analytics with a specific account selected,
  // sync that account into the trade log so only that account's trades show.
  if (typeof anCurrentAccount !== 'undefined' && anCurrentAccount && anCurrentAccount !== '__all__') {
    const matchIdx = ACCOUNTS.findIndex(a => (a.key || a.phase) === anCurrentAccount);
    if (matchIdx !== -1) selectAcct(matchIdx);
  }

  // Reset pill-based filters so nothing conflicts
  resetFilters();

  // resetFilters clears _symbolQuickFilter too if it calls applyFilters — re-set it
  window._symbolQuickFilter = sym;

  // Update the symbol trigger label so the user sees which symbol is active
  const symLabel = $('fp-symbol-label');
  if (symLabel) {
    symLabel.textContent = sym;
    symLabel.style.color = 'var(--purple)';
  }

  // Switch to Trade Log view
  const tradelogNav = document.querySelector('.nav-item[data-view="tradelog"]');
  if (tradelogNav) switchView(tradelogNav);

  // Apply filter (uses window._symbolQuickFilter)
  applyFilters();

  // Sort by P&L descending
  const sorted = [...filteredTrades].sort((a, b) => b.pnl - a.pnl);
  filteredTrades = sorted;
  renderTrades(sorted);

  // Glow the filter button
  const filterBtn = $('filter-panel-btn');
  if (filterBtn) {
    filterBtn.style.boxShadow  = '0 0 8px var(--ac-80), 0 0 16px var(--ac-40)';
    filterBtn.style.borderColor = 'var(--ac-60)';
  }
}

function updateCalendarHighlight(date) {
  // This will highlight the selected date in the calendar filter
  const calCells = $$('.cal-cell');
  calCells.forEach(cell => {
    if (cell.dataset.date === date) {
      cell.classList.add('from', 'to');
    }
  });
}

// ── DETAIL PANEL ──
function showDetail(t, row) {
  currentDetailTrade = t;
  $$('.trade-table tbody tr').forEach(r=>r.classList.remove('selected-row'));
  row.classList.add('selected-row');
  const isPos = t.pnl >= 0;
  const dp = $('detail-panel');
  $('detail-sym').textContent = `${t.symbol} — ${t.dir.toUpperCase()}`;
  $('detail-body').innerHTML = `
    <div class="detail-pnl">
      <div class="detail-pnl-label">Net P&L</div>
      <div class="detail-pnl-val" style="color:${isPos?'var(--green)':'var(--red)'}">${isPos?'+':'-'}\$${Math.abs(t.pnl).toFixed(2)}</div>
      <div class="detail-pnl-pct" style="color:${isPos?'var(--green)':'var(--red)'}">${isPos?'WIN':'LOSS'} · ${t.setup}</div>
    </div>
    <div class="detail-divider"></div>
    <div class="detail-grid">
      <div class="dg-item"><div class="dg-label">Date</div><div class="dg-val mono">${t.date} ${format24to12Hour(t.time)}</div></div>
      <div class="dg-item"><div class="dg-label">Direction</div><div class="dg-val"><span class="dir-badge ${t.dir==='long'?'dir-long':'dir-short'}">${t.dir==='long'?'▲ LONG':'▼ SHORT'}</span></div></div>
      <div class="dg-item"><div class="dg-label">Entry</div><div class="dg-val mono">${formatPrice(t.symbol, t.entry)}</div></div>
      <div class="dg-item"><div class="dg-label">Exit</div><div class="dg-val mono">${formatPrice(t.symbol, t.exit)}</div></div>
      <div class="dg-item"><div class="dg-label">Lot Size</div><div class="dg-val mono">${t.size} lots</div></div>
      <div class="dg-item"><div class="dg-label">Commission</div><div class="dg-val mono c-red">-\$${t.comm.toFixed(2)}</div></div>
      <div class="dg-item"><div class="dg-label">Stop Loss</div><div class="dg-val mono" style="color:var(--red)">${t.sl ? formatPrice(t.symbol, t.sl) : '—'}</div></div>
      <div class="dg-item"><div class="dg-label">Take Profit</div><div class="dg-val mono" style="color:var(--green)">${t.tp ? formatPrice(t.symbol, t.tp) : '—'}</div></div>
      <div class="dg-item"><div class="dg-label">Account</div><div class="dg-val">${t.account || '—'}</div></div>
      <div class="dg-item"><div class="dg-label">Session</div><div class="dg-val">${t.session}</div></div>
      <div class="dg-item"><div class="dg-label">Rating</div><div class="dg-val"><span style="color:#f5c542">${'★'.repeat(t.rating)}</span><span style="color:#f5c542;opacity:.25">${'★'.repeat(5-t.rating)}</span></div></div>
    </div>
    <div class="detail-divider"></div>
    <div id="detail-img-section"><!-- images injected by JS --></div>
    <div>
      <div class="dg-label" style="margin-bottom:6px">Notes</div>
      <div class="detail-note">${t.notes||'No notes added.'}</div>
    </div>
    ${t.emotions?.length ? `
    <div>
      <div class="dg-label" style="margin-bottom:7px">Emotions / Tags</div>
      <div class="detail-tags">${t.emotions.map(e=>`<span style="padding:3px 9px;border-radius:20px;font-size:11px;background:var(--bg5);border:1px solid var(--border2);color:var(--text2)">${e}</span>`).join('')}</div>
    </div>` : ''}
  `;
  // Set current trade ID immediately so upload works right away
  _currentImgTradeId = t.id;
  // rAF ensures innerHTML has settled before we inject into detail-img-section
  const _imgTradeId = t.id;
  requestAnimationFrame(() => {
    const sec = $('detail-img-section');
    if (sec) renderTradeImages(_imgTradeId);
  });
  dp.classList.add('open');
  setTimeout(() => document.addEventListener('click', detailOutsideClick), 0);
}

function detailOutsideClick(e) {
  const panel    = $('detail-panel');
  const table    = $('trade-table');
  const fileInp  = $('trade-img-file-input');
  const lightbox = $('trade-img-lightbox');
  const tfPicker = $('tf-picker-overlay');
  // Don't close if clicking inside panel, trade row, file picker, lightbox, or timeframe picker
  if (window._imgPickerOpen) return;
  if (lightbox && lightbox.classList.contains('open')) return;
  if (fileInp && (e.target === fileInp || fileInp.contains(e.target))) return;
  if (tfPicker && (tfPicker.style.display !== 'none' || tfPicker.contains(e.target))) return;
  if (panel && !panel.contains(e.target) && (!table || !table.contains(e.target))) {
    closeDetail();
  }
}

function deleteCurrentTrade() {
  if (!currentDetailTrade) return;
  const id = currentDetailTrade.id;
  undoSnapshot = { trades: [...TRADES], filtered: [...filteredTrades] };
  const idx = TRADES.findIndex(t => t.id === id);
  if (idx !== -1) TRADES.splice(idx, 1);
  
  // Save to localStorage
  saveTradesToStorage();
  
  filteredTrades = [...TRADES];
  closeDetail();
  renderTrades(filteredTrades);
  populateDashboard();
  refreshAdvAnalytics();
  
  // Refresh Daily P&L chart
  if (dailyPnlChartInstance) {
    initDailyPnlChart();
  }
  
  showUndoToast(1);
}

let _detailOriginView = null;

function closeDetail() {
  try {
    const dp = $('detail-panel');
    if (dp) dp.classList.remove('open');
    $$('.trade-table tbody tr').forEach(r=>r.classList.remove('selected-row'));
    document.removeEventListener('click', detailOutsideClick);
  } catch(e) {
    console.warn('closeDetail error:', e);
  }
}

// ── EQUITY CHART ──
let equityChartInstance;
let _equityChartInstances = [];

function initEquityChart() {
  _equityChartInstances.forEach(c => { try { c.destroy(); } catch(e){} });
  _equityChartInstances = [];
  if (equityChartInstance) { try { equityChartInstance.destroy(); } catch(e){} equityChartInstance = null; }

  const container = $('equity-multi-charts');
  if (!container) return;
  container.innerHTML = '';

  const light  = document.documentElement.classList.contains('light');
  const medium = document.documentElement.classList.contains('medium');
  const isAll = selectedAcct === -1;
  const acct  = !isAll ? ACCOUNTS[selectedAcct] : null;
  const acctName = acct ? (acct.key || acct.phase) : null;

  const allSorted = [...TRADES]
    .filter(t => isAll || (t.account || '') === acctName)
    .sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time));

  if (allSorted.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:60px 0;font-size:12px;color:var(--text3);font-family:var(--font-mono)">No trades yet for this account.</div>`;
    return;
  }

  const now = new Date();
  const periodKey = (currentChartPeriod || '7d').toLowerCase();
  let sorted = allSorted;
  if (periodKey === 'custom' && currentChartCustomFrom && currentChartCustomTo) {
    const from = new Date(currentChartCustomFrom + 'T00:00:00');
    const to   = new Date(currentChartCustomTo   + 'T23:59:59');
    sorted = allSorted.filter(t => { const d = new Date(t.date); return d >= from && d <= to; });
  } else if (periodKey !== 'all') {
    let cutoff = null;
    if (periodKey === '7d')  { cutoff = new Date(now); cutoff.setDate(now.getDate() - 7); }
    if (periodKey === '1m')  { cutoff = new Date(now); cutoff.setMonth(now.getMonth() - 1); }
    if (periodKey === '3m')  { cutoff = new Date(now); cutoff.setMonth(now.getMonth() - 3); }
    if (periodKey === 'ytd') { cutoff = new Date(now.getFullYear(), 0, 1); }
    if (cutoff) sorted = allSorted.filter(t => new Date(t.date) >= cutoff);
  }

  const filteredIds = new Set(sorted.map((t,i) => t.date+t.time+t.pnl+i));
  let preWindowPnl = 0;
  allSorted.forEach((t,i) => { if (!filteredIds.has(t.date+t.time+t.pnl+i)) preWindowPnl += (t.pnl||0); });

  const baseline = getAccountSize();
  let running = baseline + preWindowPnl;
  const data   = [running];
  const labels = ['Start'];
  sorted.forEach(t => {
    running += (t.pnl||0);
    data.push(running);
    labels.push(`#${allSorted.indexOf(t)+1}`);
  });

  const profitTarget = acct ? Math.round(baseline*(1+(acct.profitTarget||8)/100)) : Math.round(baseline*1.08);
  const maxLoss      = acct ? Math.round(baseline*(1-(acct.maxDrawdown||8)/100))  : Math.round(baseline*0.92);
  const dailyLoss    = acct ? Math.round(baseline*(1-(acct.dailyLoss||4)/100))    : Math.round(baseline*0.97);

  const pad  = Math.round((profitTarget - maxLoss) * 0.05);
  const yMin = maxLoss - pad;
  const yMax = profitTarget + pad;

  const refLines = [
    { value: profitTarget, color: '#2ecc8a', label: 'Profit Target' },
    { value: baseline,     color: '#8890a8', label: 'Initial'       },
    { value: dailyLoss,    color: '#f5a623', label: 'Daily Loss'    },
    { value: maxLoss,      color: '#e8504a', label: 'Max Loss'      },
  ];

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;height:480px';
  wrap.innerHTML = `<canvas id="equityChart"></canvas>`;
  container.appendChild(wrap);

  const canvasEl = wrap.querySelector('#equityChart');
  const newCtx = canvasEl.getContext('2d');

  let hoveredLine = null;

  // Create hover card for dashboard equity chart
  const dashRefCard = document.createElement('div');
  dashRefCard.style.cssText = 'display:none;position:absolute;pointer-events:none;background:var(--bg2);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:10px 14px;font-family:"JetBrains Mono",monospace;font-size:10px;z-index:50;white-space:nowrap;box-shadow:0 8px 32px rgba(0,0,0,.5);min-width:160px;transition:opacity .15s';
  wrap.appendChild(dashRefCard);

  canvasEl.addEventListener('mousemove', e => {
    const rect = canvasEl.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    if (!equityChartInstance) return;
    const y = equityChartInstance.scales.y;
    let found = null;
    refLines.forEach(l => { if (Math.abs(mouseY - y.getPixelForValue(l.value)) < 10) found = l; });
    const foundVal = found ? found.value : null;
    if (foundVal !== hoveredLine) { hoveredLine = foundVal; equityChartInstance.draw(); }
    if (found) {
      const currentEquity = data[data.length - 1];
      const diff = found.value - currentEquity;
      const diffStr = (diff >= 0 ? '+' : '-') + '$' + Math.abs(diff).toFixed(2);
      const diffColor = diff >= 0 ? 'var(--green)' : 'var(--red)';
      dashRefCard.innerHTML = `
        <div style="color:${found.color};font-weight:600;font-size:11px;margin-bottom:6px;letter-spacing:.04em">${found.label}</div>
        <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:3px">
          <span style="color:var(--text3)">Target</span>
          <span style="color:var(--text);font-weight:600">$${found.value.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:3px">
          <span style="color:var(--text3)">Current</span>
          <span style="color:var(--text)">$${currentEquity.toFixed(2)}</span>
        </div>
        <div style="border-top:1px solid var(--border);margin:5px 0"></div>
        <div style="display:flex;justify-content:space-between;gap:16px">
          <span style="color:var(--text3)">Distance</span>
          <span style="color:${diffColor};font-weight:600">${diffStr}</span>
        </div>`;
      let cardX = mouseX + 14;
      let cardY = mouseY - 10;
      dashRefCard.style.display = 'block';
      const cardW = dashRefCard.offsetWidth;
      const cardH = dashRefCard.offsetHeight;
      if (cardX + cardW > rect.width - 10) cardX = mouseX - cardW - 14;
      if (cardY + cardH > rect.height - 10) cardY = rect.height - cardH - 10;
      dashRefCard.style.left = cardX + 'px';
      dashRefCard.style.top = cardY + 'px';
    } else {
      dashRefCard.style.display = 'none';
    }
  });
  canvasEl.addEventListener('mouseleave', () => { hoveredLine = null; dashRefCard.style.display = 'none'; if (equityChartInstance) equityChartInstance.draw(); });

  const refLinePlugin = {
    id: 'refLines',
    afterDraw(chart) {
      const { ctx: c, chartArea: { left, right }, scales: { y } } = chart;
      const lt  = document.documentElement.classList.contains('light');
      const med = document.documentElement.classList.contains('medium');
      refLines.forEach(({ value, color, label }) => {
        const yPos = y.getPixelForValue(value);
        if (yPos < y.top || yPos > y.bottom) return;
        const isHov = hoveredLine === value;
        c.save();
        // Line — always full color, higher opacity in light/medium for contrast
        const lineAlpha = isHov ? 1 : (lt || med ? 0.9 : 0.6);
        c.setLineDash([3,4]); c.strokeStyle = color; c.lineWidth = isHov ? 2 : 1.5; c.globalAlpha = lineAlpha;
        c.beginPath(); c.moveTo(left, yPos); c.lineTo(right, yPos); c.stroke();
        c.setLineDash([]);
        // Label — draw background pill for readability in all modes
        const labelText = label + '  $' + value.toFixed(2);
        c.font = '600 9px "JetBrains Mono",monospace';
        const tw = c.measureText(labelText).width;
        const px = right - 6, py = yPos - 4;
        // Background pill
        c.globalAlpha = isHov ? 0.92 : 0.82;
        c.fillStyle = lt ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.55)';
        const pad = 4;
        c.beginPath();
        c.roundRect ? c.roundRect(px - tw - pad*2, py - 11, tw + pad*2, 13, 3)
                    : c.rect(px - tw - pad*2, py - 11, tw + pad*2, 13);
        c.fill();
        // Text
        c.globalAlpha = isHov ? 1 : 0.95;
        c.fillStyle = color; c.textAlign = 'right'; c.textBaseline = 'bottom';
        c.fillText(labelText, px, py);
        c.restore();
      });
    }
  };

  equityChartInstance = new Chart(newCtx, {
    type: 'line',
    data: { labels, datasets: [{ label:'Equity', data,
      borderWidth: 2, fill: false,
      segment: { borderColor: ctx2 => { const avg=((ctx2.p0.parsed.y||0)+(ctx2.p1.parsed.y||0))/2; return avg<baseline?'#8c1a0e':'#0e8c50'; } },
      tension: .4,
      pointRadius: data.length > 40 ? 0 : 3,
      pointBackgroundColor: data.map(v => v<baseline?'#8c1a0e':'#0e8c50'),
      pointBorderColor: light ? '#ffffff' : '#0b0c0f', pointBorderWidth: 2,
      pointHoverRadius: 8,
      pointHoverBackgroundColor: data.map(v => v<baseline?'#e8504a':'#2ecc8a'),
      pointHoverBorderColor: '#ffffff', pointHoverBorderWidth: 2
    }]},
    plugins: [refLinePlugin, {
      id: 'segFill',
      afterDraw(chart) {
        const { ctx: c, chartArea, scales } = chart;
        const pts = chart.getDatasetMeta(0).data;
        if (!pts.length) return;
        c.save(); c.beginPath(); c.rect(chartArea.left,chartArea.top,chartArea.width,chartArea.height); c.clip();
        for (let i=0;i<pts.length-1;i++) {
          const avg=(data[i]+data[i+1])/2, color=avg<baseline?'140,26,14':'14,140,80';
          const grad=c.createLinearGradient(0,Math.min(pts[i].y,pts[i+1].y),0,chartArea.bottom);
          grad.addColorStop(0,`rgba(${color},.35)`); grad.addColorStop(.3,`rgba(${color},.08)`); grad.addColorStop(1,`rgba(${color},0)`);
          c.beginPath(); c.moveTo(pts[i].x,pts[i].y); c.lineTo(pts[i+1].x,pts[i+1].y);
          c.lineTo(pts[i+1].x,chartArea.bottom); c.lineTo(pts[i].x,chartArea.bottom);
          c.closePath(); c.fillStyle=grad; c.fill();
        }
        c.restore();
      }
    }],
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: light?'#ffffff':'#111318', titleColor: light?'#0a0b10':'#dde1ef',
          bodyColor: light?'#1a1d2e':'#a0a8be', borderColor: light?'rgba(0,0,0,.12)':'rgba(255,255,255,.1)', borderWidth:1,
          titleFont:{family:'JetBrains Mono',size:11}, bodyFont:{family:'JetBrains Mono',size:11},
          callbacks: {
            label: ctx => {
              const v=ctx.raw;
              if (ctx.dataIndex===0) return '$'+v.toFixed(2);
              const pnl=v-ctx.dataset.data[ctx.dataIndex-1];
              return '$'+v.toFixed(2)+'  ('+(pnl>=0?'+':'-')+'$'+Math.abs(pnl).toFixed(2)+')';
            },
            title: ctx => ctx[0].label==='Start'?'Starting Balance':`Trade ${ctx[0].label}`
          }
        }
      },
      onClick: (e, elements) => {
        if (!elements.length) return;
        const idx=elements[0].index; if (idx===0) return;
        const trade=sorted[idx-1]; if (!trade) return;
        // Sync anCurrentAccount into selectedAcct so trade log filters correctly
        if(typeof anCurrentAccount!=='undefined'&&anCurrentAccount&&anCurrentAccount!=='__all__'){
          const mi=ACCOUNTS.findIndex(a=>(a.key||a.phase)===anCurrentAccount);
          if(mi!==-1&&typeof selectAcct==='function') selectAcct(mi);
        }
        _detailOriginView=document.querySelector('.nav-item.active')?.dataset?.view||null;
        document.querySelector('[data-view="tradelog"]').click();
        setTimeout(()=>{
          const row=document.querySelector(`.trade-table tbody tr[data-id="${trade.id}"]`);
          showDetail(trade,row||document.createElement('tr'));
          if(row){row.scrollIntoView({behavior:'smooth',block:'center'});row.classList.add('selected-row');}
        },80);
      },
      onHover:(e,elements)=>{ e.native.target.style.cursor=elements.length&&elements[0].index>0?'pointer':'default'; },
      scales: {
        x: { grid:{color:light?'rgba(0,0,0,.12)':'rgba(255,255,255,.06)'}, ticks:{color:light?'#0a0b10':(medium?'#a0a8be':'#6a7090'),font:{family:'JetBrains Mono',size:10},maxTicksLimit:10} },
        y: { min:yMin, max:yMax, grid:{color:light?'rgba(0,0,0,.12)':'rgba(255,255,255,.06)'},
          ticks:{color:light?'#0a0b10':(medium?'#a0a8be':'#6a7090'),font:{family:'JetBrains Mono',size:10},
            callback:v=>[profitTarget,baseline,dailyLoss,maxLoss].includes(v)?'$'+v.toFixed(2):'',
            afterBuildTicks:axis=>{axis.ticks=[maxLoss,dailyLoss,baseline,profitTarget].map(v=>({value:v}));}
          }
        }
      }
    }
  });
  _equityChartInstances.push(equityChartInstance);
}

let dailyPnlChartInstance = null;
let dailyPnlWeekDates = []; // Store current week dates for click handling
let dailyPnlActiveMode = 'this-week'; // Track current filter mode

function initDailyPnlChart() {
  const light  = document.documentElement.classList.contains('light');
  const medium = document.documentElement.classList.contains('medium');
  if (dailyPnlChartInstance) { dailyPnlChartInstance.destroy(); dailyPnlChartInstance = null; }

  // Use the existing canvas directly — no cloneNode to avoid scroll reflow
  const canvasEl = $('dailyPnlChart');
  const ctx = canvasEl.getContext('2d');
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

  // ── Handle empty data ──
  const dashT = getDashboardTrades();
  if (dashT.length === 0) {
    ctx.save();
    ctx.fillStyle = light ? '#8890a8' : '#4a5068';
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('No trades this week', ctx.canvas.width / 2, ctx.canvas.height / 2);
    ctx.restore();
    return;
  }

  // Build current week Mon–Fri
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon...
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const dayNames = ['Mon','Tue','Wed','Thu','Fri'];
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const weekDates = dayNames.map((d, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    return { label: `${d} ${monthNames[dt.getMonth()]} ${dt.getDate()}`, dateStr: dt.toISOString().split('T')[0] };
  });
  const labels = weekDates.map(d => d.label);
  
  // Store week dates globally for click handling
  dailyPnlWeekDates = weekDates;

  // Map account-filtered trades pnl to each weekday
  const data = weekDates.map(d => {
    const dayTrades = dashT.filter(t => t.date === d.dateStr);
    return dayTrades.reduce((sum, t) => sum + t.pnl, 0);
  });

  const centeredYLabels = {
    id:'centeredYLabels',
    afterDraw(chart){
      const yAxis = chart.scales.y;
      const c = chart.ctx;
      const chartLabels = chart.data.labels; // Use chart's labels instead of closure variable
      c.save();
      yAxis.ticks.forEach((tick, i) => {
        const y = yAxis.getPixelForTick(i);
        const l = chartLabels[i];
        if (!l) return; // Safety check
        const day = l.slice(0,3);
        const date = l.slice(4);
        const x = yAxis.left + (yAxis.right - yAxis.left) / 2 - 8;
        c.textAlign = 'center';
        c.font = '600 10px JetBrains Mono, monospace';
        c.fillStyle = light ? '#1a1d2e' : (medium ? '#a0a8be' : '#8890a8');
        c.fillText(day, x, y - 6);
        c.font = '10px JetBrains Mono, monospace';
        c.fillStyle = light ? '#3a4060' : (medium ? '#8890a8' : '#4a5068');
        c.fillText(date, x, y + 7);
      });
      c.restore();
    }
  };

  const chartAreaBg = {
    id:'chartAreaBg',
    beforeDraw(chart){
      const {ctx,chartArea:{left,top,width,height}} = chart;
      // Border only
      ctx.save();
      ctx.strokeStyle= light ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.08)';
      ctx.lineWidth=1;
      ctx.strokeRect(left,top,width,height);
      ctx.restore();
    }
  };

  const zeroLine = {
    id:'zeroLine',
    afterDraw(chart){
      const {ctx, chartArea:{top,bottom}, scales:{x}} = chart;
      ctx.save();
      // Only draw the zero line
      const xPos = x.getPixelForValue(0);
      ctx.beginPath();
      ctx.setLineDash([5,5]);
      ctx.moveTo(xPos, top);
      ctx.lineTo(xPos, bottom);
      ctx.strokeStyle = light ? 'rgba(0,0,0,0.25)' : (medium ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.18)');
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  };

  // ── Dynamic axis scale based on real account size ──
  const acctSize = getAccountSize() || 25000;
  const isAllAccts = selectedAcct === -1;
  // Auto-switch: $ for All Accounts, % for single account
  const step1pct = isAllAccts ? 500 : acctSize * 0.01;
  const axisMin = isAllAccts ? -2000 : -(step1pct * 2);
  const axisMax = isAllAccts ?  3000 :  (step1pct * 3);
  const fmtDollar = v => { if(v===0) return '$0'; const abs=Math.abs(v); const s=abs>=1000?(abs/1000).toFixed(abs%1000===0?0:1)+'k':abs.toFixed(0); return (v>0?'+':'-')+'$'+s; };
  const xTickCb = isAllAccts
    ? fmtDollar
    : v => { const p=(v/acctSize*100); return p===0?'0%':(p>0?'+':'')+p.toFixed(0)+'%'; };
  const tooltipCb = isAllAccts
    ? ctx => `${ctx.raw>=0?'+':''}$${parseFloat(ctx.raw).toFixed(2)}`
    : ctx => `${ctx.raw>=0?'+':''}$${parseFloat(ctx.raw).toFixed(2)} (${(ctx.raw/acctSize*100).toFixed(2)}%)`;

  dailyPnlChartInstance = new Chart(ctx,{
    type:'bar',
    data:{labels,datasets:[{label:'Daily P&L',data,
      backgroundColor:data.map(v=>v>=0
        ? (light?'rgba(26,158,98,.75)':'rgba(46,204,138,.55)')
        : (light?'rgba(214,60,55,.75)':'rgba(232,80,74,.55)')),
      borderColor:data.map(v=>v>=0
        ? (light?'#1a9e62':'#2ecc8a')
        : (light?'#d63c37':'#e8504a')),
      borderWidth:1.5,
      borderRadius:data.map(v=>v>=0?{topLeft:0,bottomLeft:0,topRight:5,bottomRight:5}:{topLeft:5,bottomLeft:5,topRight:0,bottomRight:0}),borderSkipped:false}]},
    options:{
      indexAxis:'y',
      responsive:true,maintainAspectRatio:false,
      layout:{padding:{left:10}},
      onClick: (event, activeElements) => {
        if (activeElements.length > 0) {
          const index = activeElements[0].index;
          const clickedDate = dailyPnlWeekDates[index];
          if (clickedDate) {
            const tradelogNav = document.querySelector('[data-view="tradelog"]');
            if (tradelogNav) {
              switchView(tradelogNav);
              setTimeout(() => { filterTradesByDate(clickedDate.dateStr); }, 100);
            }
          }
        }
      },
      plugins:{legend:{display:false},tooltip:{backgroundColor:light?'#ffffff':'#111318',titleColor:light?'#0a0b10':'#dde1ef',bodyColor:light?'#1a1d2e':'#a0a8be',borderColor:light?'rgba(0,0,0,.12)':'rgba(255,255,255,.1)',borderWidth:1,titleFont:{family:'JetBrains Mono',size:11},bodyFont:{family:'JetBrains Mono',size:11},callbacks:{label:tooltipCb}}},
      scales:{
        x:{
          min:axisMin, max:axisMax,
          grid:{display:false},
          ticks:{color:light?'#2a2d40':(medium?'#a0a8be':'#6a7090'),font:{family:'JetBrains Mono',size:10},stepSize:step1pct,callback:xTickCb},
          border:{display:false}
        },
        y:{grid:{display:false},ticks:{display:false},border:{display:false},afterFit(scale){scale.width=72;}}
      }
    },
    plugins:[centeredYLabels,chartAreaBg,zeroLine]
  });
}

// ── Custom PnL Week Calendar ──────────────────────────────
let _pnlCalYear = new Date().getFullYear();
let _pnlCalMonth = new Date().getMonth();
let _pnlCalSelectedMon = null; // selected Monday date

function togglePnlCal() {
  const popup = $('pnl-cal-popup');
  const btn   = $('pnl-cal-btn');
  const isOpen = popup.classList.contains('open');
  if (isOpen) {
    popup.style.display = 'none';
    popup.classList.remove('open');
    btn.style.borderColor = 'var(--border2)';
  } else {
    _pnlCalYear  = new Date().getFullYear();
    _pnlCalMonth = new Date().getMonth();
    if (_pnlCalSelectedMon) {
      _pnlCalYear  = _pnlCalSelectedMon.getFullYear();
      _pnlCalMonth = _pnlCalSelectedMon.getMonth();
    }
    renderPnlCal();
    popup.style.display = 'block';
    popup.classList.add('open');
    btn.style.borderColor = 'var(--ac-50)';
    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', pnlCalOutside, true);
    }, 10);
  }
}

function pnlCalOutside(e) {
  const wrap = $('pnl-cal-wrap');
  if (wrap && !wrap.contains(e.target)) {
    $('pnl-cal-popup').style.display = 'none';
    $('pnl-cal-popup').classList.remove('open');
    $('pnl-cal-btn').style.borderColor = 'var(--border2)';
    document.removeEventListener('click', pnlCalOutside, true);
  }
}

function pnlCalNav(dir) {
  _pnlCalMonth += dir;
  if (_pnlCalMonth > 11) { _pnlCalMonth = 0; _pnlCalYear++; }
  if (_pnlCalMonth < 0)  { _pnlCalMonth = 11; _pnlCalYear--; }
  renderPnlCal();
}

function getMonday(d) {
  const dt = new Date(d);
  const day = dt.getDay();
  dt.setDate(dt.getDate() - (day === 0 ? 6 : day - 1));
  dt.setHours(0,0,0,0);
  return dt;
}

function renderPnlCal() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  $('pnl-cal-month').textContent = months[_pnlCalMonth] + ' ' + _pnlCalYear;

  const firstDay = new Date(_pnlCalYear, _pnlCalMonth, 1);
  // Start grid from Saturday before the 1st
  const startDow = firstDay.getDay(); // 0=Sun,1=Mon...
  // Saturday = 6, so offset: startDow=0(Sun)->1, startDow=6(Sat)->0
  const offset = startDow === 6 ? 0 : (startDow + 1);
  const gridStart = new Date(firstDay);
  gridStart.setDate(1 - offset);

  const selMon = _pnlCalSelectedMon ? _pnlCalSelectedMon.getTime() : null;
  const today = new Date(); today.setHours(0,0,0,0);
  const todayMon = getMonday(today).getTime();

  let html = '';
  // 6 rows × 7 cols = 42 cells
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    d.setHours(0,0,0,0);
    const mon = getMonday(d);
    const isThisMonth = d.getMonth() === _pnlCalMonth;
    const isToday = d.getTime() === today.getTime();
    const isInSelWeek = selMon && mon.getTime() === selMon;
    const isInTodayWeek = mon.getTime() === todayMon;
    const dow = d.getDay(); // 0=Sun,1=Mon...6=Sat
    const isWeekday = dow >= 1 && dow <= 5; // Mon-Fri

    let bg = 'transparent';
    let color = isThisMonth ? 'var(--text2)' : 'var(--text4)';
    let border = '1px solid transparent';
    let fontWeight = '400';
    let borderRadius = '5px';

    if (isInSelWeek && isWeekday) {
      bg = 'var(--ac-30)';
      color = 'var(--text)';
      fontWeight = '600';
    }
    if (isInSelWeek && dow === 1) { bg = 'var(--purple)'; color = '#fff'; borderRadius = '5px 5px 5px 5px'; }
    if (isInSelWeek && dow === 5) { borderRadius = '5px'; }
    if (isToday) border = '1px solid var(--ac-50)';
    if (isInTodayWeek && !isInSelWeek && isWeekday) { bg = 'var(--ac-08)'; }

    html += `<div onclick="pnlCalSelectDay(${d.getFullYear()},${d.getMonth()},${d.getDate()})"
      style="text-align:center;font-size:10px;font-family:var(--font-mono);padding:5px 2px;border-radius:${borderRadius};background:${bg};color:${color};font-weight:${fontWeight};border:${border};cursor:pointer;transition:background .1s"
      onmouseenter="if(this.style.background==='transparent'||this.style.background==='')this.style.background='var(--ac-10)'"
      onmouseleave="this.style.background='${bg}'"
    >${d.getDate()}</div>`;
  }
  $('pnl-cal-days').innerHTML = html;
}

function pnlCalSelectDay(y, m, d) {
  const clicked = new Date(y, m, d);
  _pnlCalSelectedMon = getMonday(clicked);
  // Build ISO week string YYYY-Www for filterDailyPnl
  const jan1 = new Date(_pnlCalSelectedMon.getFullYear(), 0, 1);
  const weekNum = Math.ceil((((_pnlCalSelectedMon - jan1) / 86400000) + jan1.getDay() + 1) / 7);
  const wStr = _pnlCalSelectedMon.getFullYear() + '-W' + String(weekNum).padStart(2,'0');
  // Update label
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  $('pnl-cal-label').textContent = 'Week of ' + mo[_pnlCalSelectedMon.getMonth()] + ' ' + _pnlCalSelectedMon.getDate();
  $('pnl-cal-btn').style.color = 'var(--text)';
  // Trigger filter
  filterDailyPnlCustomDate(_pnlCalSelectedMon);
  renderPnlCal();
  // Close after short delay
  setTimeout(() => {
    $('pnl-cal-popup').style.display = 'none';
    $('pnl-cal-popup').classList.remove('open');
    $('pnl-cal-btn').style.borderColor = 'var(--border2)';
    document.removeEventListener('click', pnlCalOutside, true);
  }, 180);
}

function pnlCalClear() {
  _pnlCalSelectedMon = null;
  $('pnl-cal-label').textContent = 'Week —, ----';
  $('pnl-cal-btn').style.color = 'var(--text2)';
  $('pnl-cal-popup').style.display = 'none';
  $('pnl-cal-popup').classList.remove('open');
  document.removeEventListener('click', pnlCalOutside, true);
}

function pnlCalThisWeek() {
  pnlCalSelectDay(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
}

function filterDailyPnlCustomDate(monday) {
  try {
    const endDate = new Date(monday);
    endDate.setDate(monday.getDate() + 4);
    const dayNames   = ['Mon','Tue','Wed','Thu','Fri'];
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const weekDates  = dayNames.map((d, i) => {
      const dt = new Date(monday); dt.setDate(monday.getDate() + i);
      return { label: `${d} ${monthNames[dt.getMonth()]} ${dt.getDate()}`, dateStr: dt.toISOString().split('T')[0] };
    });
    dailyPnlWeekDates = weekDates;
    dailyPnlActiveMode = 'custom';
    const labels = weekDates.map(d => d.label);
    const data   = weekDates.map(d => {
      return getDashboardTrades().filter(t => t.date === d.dateStr).reduce((s,t) => s + t.pnl, 0);
    });
    // Reset week buttons
    $('pnl-this-week').style.background = 'transparent'; $('pnl-this-week').style.color = 'var(--text2)';
    $('pnl-prev-week').style.background = 'transparent'; $('pnl-prev-week').style.color = 'var(--text2)';
    if (dailyPnlChartInstance) {
      const isLightMode = document.documentElement.classList.contains('light');
      dailyPnlChartInstance.data.labels = labels;
      dailyPnlChartInstance.data.datasets[0].data = data;
      dailyPnlChartInstance.data.datasets[0].backgroundColor = data.map(v => v >= 0 ? (isLightMode?'rgba(26,158,98,.75)':'rgba(46,204,138,.55)') : (isLightMode?'rgba(214,60,55,.75)':'rgba(232,80,74,.55)'));
      dailyPnlChartInstance.data.datasets[0].borderColor     = data.map(v => v >= 0 ? (isLightMode?'#1a9e62':'#2ecc8a') : (isLightMode?'#d63c37':'#e8504a'));
      dailyPnlChartInstance.data.datasets[0].borderRadius    = data.map(v => v >= 0 ? {topLeft:0,bottomLeft:0,topRight:5,bottomRight:5} : {topLeft:5,bottomLeft:5,topRight:0,bottomRight:0});
      const acctSz = getAccountSize() || 25000;
      const isAll  = selectedAcct === -1;
      const step   = isAll ? 500 : acctSz * 0.01;
      dailyPnlChartInstance.options.scales.x.min = isAll ? -2000 : -(step*2);
      dailyPnlChartInstance.options.scales.x.max = isAll ?  3000 :  (step*3);
      dailyPnlChartInstance.options.scales.x.ticks.stepSize = step;
      const fmtD = v => { if(v===0) return '$0'; const abs=Math.abs(v); const s=abs>=1000?(abs/1000).toFixed(abs%1000===0?0:1)+'k':abs.toFixed(0); return (v>0?'+':'-')+'$'+s; };
      dailyPnlChartInstance.options.scales.x.ticks.callback = isAll ? fmtD : v => { const p=(v/acctSz*100); return p===0?'0%':(p>0?'+':'')+p.toFixed(0)+'%'; };
      dailyPnlChartInstance.update();
    }
  } catch(e) { console.warn('filterDailyPnlCustomDate error:', e); }
}

// Daily P&L Date Filter Function
function filterDailyPnl(mode) {
  try {
    dailyPnlActiveMode = mode; // Save current mode for theme switch restore
    const light = document.documentElement.classList.contains('light');
    let startDate, endDate;
    const now = new Date();
    
    if (mode === 'this-week') {
      // Get current week (Mon-Fri)
      const day = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      startDate = monday;
      endDate = new Date(monday);
      endDate.setDate(monday.getDate() + 4); // Friday
      
      // Update button states
      $('pnl-this-week').classList.add('active');
      $('pnl-this-week').style.background = 'var(--purple)';
      $('pnl-this-week').style.color = '#fff';
      $('pnl-prev-week').classList.remove('active');
      $('pnl-prev-week').style.background = 'transparent';
      $('pnl-prev-week').style.color = 'var(--text2)';
      
    } else if (mode === 'prev-week') {
      // Get previous week (Mon-Fri)
      const day = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - 7); // Previous Monday
      startDate = monday;
      endDate = new Date(monday);
      endDate.setDate(monday.getDate() + 4); // Friday
      
      // Update button states
      $('pnl-prev-week').classList.add('active');
      $('pnl-prev-week').style.background = 'var(--purple)';
      $('pnl-prev-week').style.color = '#fff';
      $('pnl-this-week').classList.remove('active');
      $('pnl-this-week').style.background = 'transparent';
      $('pnl-this-week').style.color = 'var(--text2)';
      
    } else if (mode === 'custom') {
      // Get custom week from picker
      const weekInput = $('pnl-week-picker').value;
      if (!weekInput) return;
      
      // Parse week format: YYYY-Www (e.g., 2024-W12)
      const [year, week] = weekInput.split('-W');
      const simple = new Date(year, 0, 1 + (week - 1) * 7);
      const dow = simple.getDay();
      const ISOweekStart = simple;
      if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
      else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
      
      startDate = ISOweekStart;
      endDate = new Date(ISOweekStart);
      endDate.setDate(ISOweekStart.getDate() + 4); // Friday
      
      // Update button states
      $('pnl-this-week').classList.remove('active');
      $('pnl-this-week').style.background = 'transparent';
      $('pnl-this-week').style.color = 'var(--text2)';
      $('pnl-prev-week').classList.remove('active');
      $('pnl-prev-week').style.background = 'transparent';
      $('pnl-prev-week').style.color = 'var(--text2)';
    }
    
    // Generate labels and data for the selected week
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const weekDates = dayNames.map((d, i) => {
      const dt = new Date(startDate);
      dt.setDate(startDate.getDate() + i);
      return { label: `${d} ${monthNames[dt.getMonth()]} ${dt.getDate()}`, dateStr: dt.toISOString().split('T')[0] };
    });
    
    // Store week dates globally for click handling
    dailyPnlWeekDates = weekDates;
    
    const labels = weekDates.map(d => d.label);
    const data = weekDates.map(d => {
      const dayTrades = getDashboardTrades().filter(t => t.date === d.dateStr);
      return dayTrades.reduce((sum, t) => sum + t.pnl, 0);
    });
    
    // Update chart
    if (dailyPnlChartInstance) {
      dailyPnlChartInstance.data.labels = labels;
      dailyPnlChartInstance.data.datasets[0].data = data;
      const isLightMode = document.documentElement.classList.contains('light');
      const isMedMode = document.documentElement.classList.contains('medium');
      dailyPnlChartInstance.data.datasets[0].backgroundColor = data.map(v => v >= 0
        ? (isLightMode?'rgba(26,158,98,.75)':(isMedMode?'rgba(46,204,138,.65)':'rgba(46,204,138,.55)'))
        : (isLightMode?'rgba(214,60,55,.75)':(isMedMode?'rgba(232,80,74,.65)':'rgba(232,80,74,.55)')));
      dailyPnlChartInstance.data.datasets[0].borderColor = data.map(v => v >= 0
        ? (isLightMode?'#1a9e62':'#2ecc8a')
        : (isLightMode?'#d63c37':'#e8504a'));
      dailyPnlChartInstance.data.datasets[0].borderWidth = 1.5;
      dailyPnlChartInstance.data.datasets[0].borderRadius = data.map(v => v >= 0 ? {topLeft:0,bottomLeft:0,topRight:5,bottomRight:5} : {topLeft:5,bottomLeft:5,topRight:0,bottomRight:0});
      // Update axis scale — auto-switch $ vs % based on account selection
      const acctSz = getAccountSize() || 25000;
      const isAll = selectedAcct === -1;
      const step = isAll ? 500 : acctSz * 0.01;
      dailyPnlChartInstance.options.scales.x.min = isAll ? -2000 : -(step * 2);
      dailyPnlChartInstance.options.scales.x.max = isAll ?  3000 :  (step * 3);
      dailyPnlChartInstance.options.scales.x.ticks.stepSize = step;
      const fmtD = v => { if(v===0) return '$0'; const abs=Math.abs(v); const s=abs>=1000?(abs/1000).toFixed(abs%1000===0?0:1)+'k':abs.toFixed(0); return (v>0?'+':'-')+'$'+s; };
      dailyPnlChartInstance.options.scales.x.ticks.callback = isAll
        ? fmtD
        : v => { const p=(v/acctSz*100); return p===0?'0%':(p>0?'+':'')+p.toFixed(0)+'%'; };
      dailyPnlChartInstance.options.plugins.tooltip.callbacks.label = isAll
        ? ctx => `${ctx.raw>=0?'+':''}$${parseFloat(ctx.raw).toFixed(2)}`
        : ctx => `${ctx.raw>=0?'+':''}$${parseFloat(ctx.raw).toFixed(2)} (${(ctx.raw/acctSz*100).toFixed(2)}%)`;
      dailyPnlChartInstance.update();
    }
  } catch (error) {
    console.error('filterDailyPnl error:', error);
  }
}


let currentChartPeriod = 'all';
let currentChartCustomFrom = null;
let currentChartCustomTo = null;

function switchChartPeriod(el, period) {
  $$('.pan-btn[onclick*="switchChartPeriod"]').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  // Reset custom button label if switching away
  if(period !== 'custom') {
    const customBtn = $('equity-custom-btn');
    if(customBtn) customBtn.innerHTML = '⊞ Custom';
  }
  const bar = $('custom-range-bar');
  if(period === 'custom') {
    bar.style.display = 'block';
    const fromVal = $('custom-from').value;
    const toVal = $('custom-to').value;
    // Only pre-fill if no range has been set yet
    if(!fromVal && !toVal) {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 10);
      $('custom-to').value = to.toISOString().split('T')[0];
      $('custom-from').value = from.toISOString().split('T')[0];
      $('custom-range-label').textContent = 'Last 10 days pre-filled';
      $('custom-range-label').style.color = 'var(--text3)';
    }
    // Don't re-render yet — wait for Apply
  } else {
    bar.style.display = 'none';
    currentChartPeriod = period.toLowerCase();
    currentChartCustomFrom = null;
    currentChartCustomTo = null;
    initEquityChart();
  }
}

function closeCustomRange() {
  $('custom-range-bar').style.display = 'none';
}

function clearCustomRange() {
  $('custom-from').value = '';
  $('custom-to').value = '';
  $('custom-range-label').textContent = '';
  $('custom-range-label').style.color = 'var(--text3)';
  const customBtn = $('equity-custom-btn');
  if(customBtn) customBtn.innerHTML = '⊞ Custom';
  $$('.pan-btn[onclick*="switchChartPeriod"]').forEach(b => b.classList.remove('active'));
  const btn7d = document.querySelector('.pan-btn[onclick*="7d"]');
  if(btn7d) btn7d.classList.add('active');
  $('custom-range-bar').style.display = 'none';
  currentChartPeriod = '7d';
  currentChartCustomFrom = null;
  currentChartCustomTo = null;
  initEquityChart();
}

function applyCustomRange() {
  const from = $('custom-from').value;
  const to = $('custom-to').value;
  if(!from || !to) return;
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if(fromDate > toDate) {
    $('custom-range-label').textContent = 'From must be before To';
    $('custom-range-label').style.color = 'var(--red)';
    return;
  }
  const days = Math.round((toDate - fromDate) / (1000*60*60*24)) + 1;
  $('custom-range-label').textContent = `Showing ${days} day${days!==1?'s':''} · ${from} → ${to}`;
  $('custom-range-label').style.color = 'var(--purple)';
  $('custom-range-bar').style.display = 'none';
  // Update the custom button label to show the range
  const fromFmt = from.slice(5).replace('-','/');
  const toFmt = to.slice(5).replace('-','/');
  const customBtn = $('equity-custom-btn');
  if(customBtn) customBtn.innerHTML = `${days}D`;
  // Apply to chart
  currentChartPeriod = 'custom';
  currentChartCustomFrom = from;
  currentChartCustomTo = to;
  initEquityChart();
}

// ── ANALYTICS CHARTS ──
// already defined at top of file
// let analyticsInitialized = false;
// let anCurrentAccount = '__all__';

function getAnTrades() {
  if (typeof ACCOUNTS === 'undefined' || !ACCOUNTS || ACCOUNTS.length === 0) {
    return TRADES || [];
  }
  // '__all__' or empty → return all trades
  if (!anCurrentAccount || anCurrentAccount === '__all__') {
    return TRADES || [];
  }
  return (TRADES || []).filter(t => (t.account || '') === anCurrentAccount);
}

// Per-card "This week" period filter
if (!window._anCardPeriod) window._anCardPeriod = {};

function getAnTradesForCard(cardId) {
  const base = getAnTrades();
  if (window._anCardPeriod[cardId] !== 'week') return base;
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  return base.filter(t => new Date(t.date) >= monday);
}

function toggleCardMenu(cardId, e) {
  if (e) e.stopPropagation();
  const dd = $(cardId + '-menu-dd');
  if (!dd) return;
  const isOpen = dd.style.display === 'block';
  // Close all card menus first
  ['day','setup','session'].forEach(id => {
    const d = $(id + '-menu-dd');
    if (d) d.style.display = 'none';
  });
  if (!isOpen) {
    dd.style.display = 'block';
    setTimeout(() => document.addEventListener('click', function h(ev) {
      if (!dd.contains(ev.target) && !$(cardId + '-menu-btn').contains(ev.target)) {
        dd.style.display = 'none';
        document.removeEventListener('click', h);
      }
    }), 0);
  }
}

function cardPeriodSet(cardId, period, btn) {
  window._anCardPeriod[cardId] = period;
  if (cardId === 'day')     rebuildDayCard();
  if (cardId === 'setup')   rebuildSetupCard();
  if (cardId === 'session') rebuildSessionCard();
}

function rebuildDayCard() {
  const trades = getAnTradesForCard('day');
  const dayMap = {Mon:{pnl:0,trades:0},Tue:{pnl:0,trades:0},Wed:{pnl:0,trades:0},Thu:{pnl:0,trades:0},Fri:{pnl:0,trades:0},Sat:{pnl:0,trades:0},Sun:{pnl:0,trades:0}};
  trades.forEach(t => {
    const d = new Date(t.date); const name = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
    if (dayMap[name]) { dayMap[name].pnl += t.pnl; dayMap[name].trades++; }
  });
  window._dayMapData = dayMap;
  renderDayHeatmap();
}

function rebuildSetupCard() {
  const trades = getAnTradesForCard('setup');
  const pbNames = new Set((typeof getPbList === 'function' ? getPbList() : PB_DEFAULTS).map(p => p.name));
  const setupMap = {};
  trades.forEach(t => {
    let s = t.model || t.setup || 'Other';
    // Migrate on-the-fly if model not in current playbook list
    if (!pbNames.has(s) && MODEL_MIGRATION_MAP[s]) s = MODEL_MIGRATION_MAP[s];
    // Only count if it matches a playbook; otherwise skip (or mark Other)
    if (!pbNames.has(s)) s = 'Other';
    setupMap[s] = (setupMap[s] || 0) + 1;
  });
  // Remove 'Other' bucket from display if all trades matched
  if (setupMap['Other'] === 0) delete setupMap['Other'];
  window._setupMapCache = setupMap;
  const setupArr = Object.entries(setupMap).sort((a, b) => b[1] - a[1]);
  window._allSetupModels = setupArr.map(([name]) => name);
  if (!window._setupFilter) window._setupFilter = new Set(window._allSetupModels);
  // Rebuild checkboxes
  const setupChecks = $('setup-filter-checks');
  if (setupChecks) setupChecks.innerHTML = window._allSetupModels.map(name => `
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:2px 0">
      <input type="checkbox" data-model="${name}" ${window._setupFilter.has(name) ? 'checked' : ''} onchange="setupFilterChange()" style="accent-color:var(--purple);width:12px;height:12px;cursor:pointer">
      <span style="font-family:var(--font-mono);font-size:10px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px">${name}</span>
    </label>`).join('');
  renderSetupDistrib(setupArr);
}

function rebuildSessionCard() {
  const trades = getAnTradesForCard('session');
  const sessionMap = {};
  trades.forEach(t => {
    const s = t.session || 'Unknown';
    if (!sessionMap[s]) sessionMap[s] = { pnl: 0, wins: 0, losses: 0, trades: 0 };
    sessionMap[s].pnl += t.pnl; sessionMap[s].trades++;
    if (t.pnl > 0) sessionMap[s].wins++; else sessionMap[s].losses++;
  });
  const sessionArr = Object.entries(sessionMap).sort((a, b) => b[1].pnl - a[1].pnl);
  window._allSessionNames = sessionArr.map(([name]) => name);
  window._sessionMapCache = sessionMap;
  if (!window._sessionFilter) window._sessionFilter = new Set(window._allSessionNames);
  const sessionChecks = $('session-filter-checks');
  if (sessionChecks) sessionChecks.innerHTML = window._allSessionNames.map(name => `
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:2px 0">
      <input type="checkbox" data-session="${name}" ${window._sessionFilter.has(name) ? 'checked' : ''} onchange="sessionFilterChange()" style="accent-color:var(--purple);width:12px;height:12px;cursor:pointer">
      <span style="font-family:var(--font-mono);font-size:10px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px">${name}</span>
    </label>`).join('');
  renderSessionDistrib(sessionArr);
}

function anSetAccount(acct) {
  anCurrentAccount = acct;
  ecCurrentAccount = acct === '__all__' ? null : acct;

  const equityPanel = document.querySelector('#advan-grid .panel');
  if (equityPanel) {
    equityPanel.style.display = ''; // always show — all-accounts shows combined equity
  }

  const k = acct;
  window._dayFilter     = window._acctFilters?.[k]?._dayFilter     || null;
  window._setupFilter   = window._acctFilters?.[k]?._setupFilter   || null;
  window._sessionFilter = window._acctFilters?.[k]?._sessionFilter || null;
  rmSymFilter = getRmSymFilter();
  analyticsInitialized = false;
  const activeView = document.querySelector('.view.active');
  if (activeView?.id === 'view-analytics') { initAnalyticsCharts(); updateAnalyticsCards(); }
  if (activeView?.id === 'view-advanalytics') { refreshAdvAnalytics(); }
}

function buildAnAccountBar() {
  const allActive = !anCurrentAccount || anCurrentAccount === '__all__';
  const options = [
    `<div onclick="anSetAccount('__all__');$$('.an-acct-dd').forEach(d=>{d.style.display='none'});$$('.an-acct-trigger').forEach(t=>{t.dataset.open='false'});$$('.an-acct-chevron').forEach(c=>{c.style.transform=''})"
      style="display:flex;align-items:center;gap:8px;padding:7px 12px;font-size:11px;font-family:var(--font-mono);cursor:pointer;color:${allActive?'var(--purple)':'var(--text2)'};background:${allActive?'var(--ac-10)':'transparent'};transition:background .1s;white-space:nowrap"
      onmouseenter="this.style.background='var(--ac-08)';this.style.color='var(--text)'"
      onmouseleave="this.style.background='${allActive?'var(--ac-10)':'transparent'}';this.style.color='${allActive?'var(--purple)':'var(--text2)'}'">
      <span style="width:7px;height:7px;border-radius:50%;background:${allActive?'var(--purple)':'var(--text3)'};flex-shrink:0"></span>
      <span style="flex:1">All Accounts</span>
      ${allActive ? '<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M1.5 6l3 3 6-6" stroke="var(--purple)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
    </div>`,
    ...ACCOUNTS.map(a => {
      const name = a.key || a.phase;
      const active = anCurrentAccount === name;
      return `<div onclick="anSetAccount('${name.replace(/'/g,"\\'")}');$$('.an-acct-dd').forEach(d=>{d.style.display='none'});$$('.an-acct-trigger').forEach(t=>{t.dataset.open='false'});$$('.an-acct-chevron').forEach(c=>{c.style.transform=''})"
        style="display:flex;align-items:center;gap:8px;padding:7px 12px;font-size:11px;font-family:var(--font-mono);cursor:pointer;color:${active?'var(--purple)':'var(--text2)'};background:${active?'var(--ac-10)':'transparent'};transition:background .1s;white-space:nowrap"
        onmouseenter="this.style.background='var(--ac-08)';this.style.color='var(--text)'"
        onmouseleave="this.style.background='${active?'var(--ac-10)':'transparent'}';this.style.color='${active?'var(--purple)':'var(--text2)'}'">
        <span style="width:7px;height:7px;border-radius:50%;background:${active?'var(--purple)':'var(--text3)'};flex-shrink:0"></span>
        <span style="flex:1">${name}</span>
        ${active ? '<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M1.5 6l3 3 6-6" stroke="var(--purple)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
      </div>`;
    })
  ].join('');

  const displayLabel = allActive ? 'All Accounts' : (anCurrentAccount || 'Select account');

  return `
    <div class="an-acct-trigger" data-open="false"
      onclick="(function(btn){
        const dd = btn.nextElementSibling;
        const chev = btn.querySelector('.an-acct-chevron');
        const open = btn.dataset.open === 'true';
        if(open){ dd.style.display='none'; btn.dataset.open='false'; chev.style.transform=''; }
        else {
          dd.style.display='block'; btn.dataset.open='true'; chev.style.transform='rotate(180deg)';
          setTimeout(()=>document.addEventListener('click',function h(e){
            if(!dd.contains(e.target)&&!btn.contains(e.target)){
              dd.style.display='none'; btn.dataset.open='false'; chev.style.transform='';
              document.removeEventListener('click',h);
            }
          }),0);
        }
      })(this)"
      style="display:flex;align-items:center;gap:8px;background:var(--bg3);border:1px solid var(--ac-25);border-radius:8px;padding:6px 12px;cursor:pointer;font-size:11px;font-family:var(--font-mono);color:var(--text);user-select:none;min-width:200px;justify-content:space-between;transition:border-color .15s"
      onmouseenter="this.style.borderColor='var(--ac-50)'"
      onmouseleave="if(this.dataset.open!=='true')this.style.borderColor='var(--ac-25)'">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="width:7px;height:7px;border-radius:50%;background:var(--purple);flex-shrink:0"></span>
        <span>${displayLabel}</span>
      </div>
      <svg class="an-acct-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none" style="transition:transform .2s;flex-shrink:0;opacity:.6"><path d="M2 3.5l3 3 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div class="an-acct-dd" style="display:none;position:absolute;top:calc(100% + 6px);left:0;background:var(--bg2);border:1px solid var(--ac-20);border-radius:10px;min-width:220px;overflow:hidden;z-index:9999;box-shadow:0 12px 36px rgba(0,0,0,.6)">
      ${options}
    </div>`;
}
let monthlyChartInstance = null; // kept for compatibility
let hourChartInstance = null;
function toggleModelDropdown() {
  const dd = $('f-model-dd');
  const chevron = $('f-model-chevron');
  const trigger = $('f-model-trigger');
  const isOpen = dd.style.display === 'block';
  dd.style.display = isOpen ? 'none' : 'block';
  chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
  trigger.style.borderColor = isOpen ? 'var(--border)' : 'var(--ac-60)';
  if (!isOpen) {
    syncModelDropdownFromPlaybooks();
    setTimeout(() => document.addEventListener('click', function h(e) {
      if (!dd.contains(e.target) && e.target.id !== 'f-model-trigger') {
        dd.style.display = 'none';
        chevron.style.transform = '';
        trigger.style.borderColor = 'var(--border)';
        document.removeEventListener('click', h);
      }
    }), 0);
  }
}

function selectModel(val) {
  $('f-model').value = val;
  const lbl = $('f-model-label');
  lbl.textContent = val;
  lbl.style.color = 'var(--text)';
  $$('#f-model-list .mdl-opt').forEach(o => {
    const label = o.querySelector('.mdl-opt-label');
    o.classList.toggle('selected', (label ? label.textContent : o.textContent.trim()) === val);
  });
  $('f-model-dd').style.display = 'none';
  $('f-model-chevron').style.display = '';
  $('f-model-clear').style.display = 'block';
  $('f-model-trigger').style.borderColor = 'var(--border)';
}
function deleteModelOpt(e, btn) { e.stopPropagation(); btn.closest('.mdl-opt-deletable').remove(); }

function showAddModelInput() {
  $('f-model-add-btn').style.display = 'none';
  const row = $('f-model-add-input-row');
  row.style.display = 'flex';
  setTimeout(() => $('f-model-custom-input').focus(), 50);
}

function confirmAddModel() {
  const inp = $('f-model-custom-input');
  const val = inp.value.trim();
  if (!val) return;
  const list = $('f-model-list');
  const opt = document.createElement('div');
  opt.className = 'mdl-opt mdl-opt-deletable';
  opt.innerHTML = `<span class="mdl-opt-label">${val}</span><button class="mdl-del-btn" onclick="deleteModelOpt(event,this)"><svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></button>`;
  opt.onclick = (e) => { if(!e.target.classList.contains('mdl-del-btn')) selectModel(val); };
  list.appendChild(opt);
  selectModel(val);
  inp.value = '';
  $('f-model-add-input-row').style.display = 'none';
  $('f-model-add-btn').style.display = 'flex';
}

function addModelKey(e) {
  if (e.key === 'Enter') { e.preventDefault(); confirmAddModel(); }
  if (e.key === 'Escape') {
    $('f-model-add-input-row') && ($('f-model-add-input-row').style.display = 'none');
    $('f-model-add-btn') && ($('f-model-add-btn').style.display = 'flex');
  }
}

// ── Sync model dropdown from user's playbooks ──
function syncModelDropdownFromPlaybooks() {
  const list = $('f-model-list');
  if (!list) return;
  const plays = (typeof getPbList === 'function') ? getPbList() : [];
  const currentVal = $('f-model') ? $('f-model').value : '';
  if (!plays.length) {
    list.innerHTML = `<div style="padding:12px 14px;font-family:var(--font-mono);font-size:10.5px;color:var(--text3);text-align:center;line-height:1.5">No entry models yet.<br>Click <span style="color:#a97de8">Add entry model</span> below.</div>`;
    return;
  }
  list.innerHTML = plays.map(p => {
    const name = p.name || '';
    const esc = name.replace(/'/g, "\\'");
    const isSelected = name === currentVal;
    return `<div class="mdl-opt${isSelected ? ' selected' : ''}" onclick="selectModel('${esc}')" style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px 7px 12px;cursor:pointer;transition:background .12s" onmouseenter="this.style.background='var(--ac-10)'" onmouseleave="this.style.background='${isSelected ? 'var(--ac-14)' : 'transparent'}'">
      <div style="display:flex;align-items:center;gap:7px">
        <span style="font-size:13px">${p.emoji || '📋'}</span>
        <span class="mdl-opt-label" style="font-family:var(--font-mono);font-size:11px;color:var(--text)">${name}</span>
      </div>
      ${p.avgR ? `<span style="font-family:var(--font-mono);font-size:9px;color:var(--green);opacity:.75">${p.avgR}</span>` : ''}
    </div>`;
  }).join('');
}

// ── Navigate to Playbook page from trade modal ──
function goToPlaybookFromModal() {
  // Close the model dropdown
  const dd = $('f-model-dd');
  const chevron = $('f-model-chevron');
  const trigger = $('f-model-trigger');
  if (dd) dd.style.display = 'none';
  if (chevron) { chevron.style.transform = ''; }
  if (trigger) trigger.style.borderColor = 'var(--border)';

  // Animate modal out, then navigate
  const overlay = $('modal-overlay');
  if (overlay) {
    overlay.style.transition = 'opacity .25s ease';
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.classList.remove('open');
      overlay.style.opacity = '';
      overlay.style.transition = '';
      // Navigate to playbook view
      const navItem = document.querySelector('.nav-item[data-view="playbook"]');
      if (navItem && typeof switchView === 'function') {
        switchView(navItem);
      }
      // Show toast after a brief pause
      setTimeout(() => {
        if (typeof showToast === 'function') {
          showToast('Click "+ Add Playbook" to create an entry model', 'info', '📋', 4000);
        }
      }, 300);
    }, 220);
  } else {
    // Fallback: just navigate
    const navItem = document.querySelector('.nav-item[data-view="playbook"]');
    if (navItem && typeof switchView === 'function') switchView(navItem);
    if (typeof showToast === 'function') {
      showToast('Click "+ Add Playbook" to create an entry model', 'info', '📋', 4000);
    }
  }
}


function animateCounter(el, targetVal, prefix='', suffix='', duration=600) {
  const start = performance.now();
  const startVal = 0;
  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    const cur = startVal + (targetVal - startVal) * ease;
    el.textContent = prefix + Math.abs(cur).toFixed(2) + suffix;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function anNavigateBestWorst(which) {
  const card = $('an-' + which + '-card');
  const id = card && card.dataset.tradeId;
  if (!id) return;
  const trade = TRADES.find(t => String(t.id) === id);
  if (!trade) return;
  // Navigate to trade log filtered to this single trade, then open detail panel
  window._streakIdFilter = [id];
  window._symbolQuickFilter = null;
  const nav = document.querySelector('.nav-item[data-view="tradelog"]');
  if (nav) switchView(nav);
  setTimeout(() => {
    applyFilters();
    setTimeout(() => {
      const row = document.querySelector('.trade-table tbody tr[data-id="' + id + '"]');
      if (trade && typeof showDetail === 'function') showDetail(trade, row || document.createElement('tr'));
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.classList.add('selected-row');
      }
    }, 120);
  }, 60);
  showToast((which === 'best' ? '🏆 Best' : '⚠️ Worst') + ' trade — ' + trade.symbol, 'info', '', 2000);
}

function updateAnalyticsCards() {
  const trades = getAnTrades();
  const wins   = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);
  const avgWin  = wins.length   ? wins.reduce((s,t)=>s+t.pnl,0)/wins.length    : 0;
  const avgLoss = losses.length ? losses.reduce((s,t)=>s+t.pnl,0)/losses.length : 0;
  const best    = trades.length ? trades.reduce((b,t)=>t.pnl>b.pnl?t:b, trades[0]) : null;
  const worst   = trades.length ? trades.reduce((w,t)=>t.pnl<w.pnl?t:w, trades[0]) : null;
  const rr      = (avgWin && avgLoss) ? (avgWin / Math.abs(avgLoss)) : null;

  const aw = $('an-avg-win');
  const al = $('an-avg-loss');
  const ab = $('an-best');
  const aw2 = $('an-worst');
  const arr = $('an-rr');

  if (wins.length && aw)  animateCounter(aw,  avgWin,  '+$', '');
  else if (aw) aw.textContent = '—';

  if (losses.length && al) animateCounter(al, Math.abs(avgLoss), '-$', '');
  else if (al) al.textContent = '—';

  if (best && ab)  animateCounter(ab,  best.pnl,             '+$', '');
  else if (ab) ab.textContent = '—';

  if (worst && aw2) animateCounter(aw2, Math.abs(worst.pnl), '-$', '');
  else if (aw2) aw2.textContent = '—';

  if (rr && arr) {
    const start = performance.now();
    function tickRR(now) {
      const t = Math.min((now-start)/600,1);
      const ease = 1-Math.pow(1-t,3);
      arr.textContent = (rr*ease).toFixed(2)+'R';
      if(t<1) requestAnimationFrame(tickRR);
    }
    requestAnimationFrame(tickRR);
  } else if (arr) arr.textContent = '—';

  const bsub  = $('an-best-sub');
  const wsub  = $('an-worst-sub');
  const awsub = $('an-avg-win-sub');
  const alsub = $('an-avg-loss-sub');
  const rsub  = $('an-rr-sub');

  if (bsub)  bsub.textContent  = best  ? best.symbol  : '—';
  if (wsub)  wsub.textContent  = worst ? worst.symbol : '—';
  // Store IDs on cards for click navigation
  const bestCard  = $('an-best-card');
  const worstCard = $('an-worst-card');
  if (bestCard)  bestCard.dataset.tradeId  = best  ? String(best.id)  : '';
  if (worstCard) worstCard.dataset.tradeId = worst ? String(worst.id) : '';
  if (awsub) awsub.textContent = wins.length   + ' winning trade' + (wins.length!==1?'s':'');
  if (alsub) alsub.textContent = losses.length + ' losing trade'  + (losses.length!==1?'s':'');
  if (rsub)  rsub.textContent  = rr ? 'avg win ÷ avg loss' : 'not enough data';

  // ── Percentage labels ──
  const acctSz = getAccountSize() || 25000;
  const awPct  = $('an-avg-win-pct');
  const alPct  = $('an-avg-loss-pct');
  const bPct   = $('an-best-pct');
  const wPct   = $('an-worst-pct');
  if (awPct) awPct.textContent = wins.length && avgWin
    ? '+' + ((avgWin / acctSz) * 100).toFixed(2) + '% of account' : '';
  if (alPct) alPct.textContent = losses.length && avgLoss
    ? ((avgLoss / acctSz) * 100).toFixed(2) + '% of account' : '';
  if (bPct)  bPct.textContent  = best && best.pnl
    ? (best.pnl >= 0 ? '+' : '') + ((best.pnl / acctSz) * 100).toFixed(2) + '% of account' : '';
  if (wPct)  wPct.textContent  = worst && worst.pnl
    ? ((worst.pnl / acctSz) * 100).toFixed(2) + '% of account' : '';
}

function renderDayHeatmap() {
  const ALL_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const active = window._dayFilter || new Set(ALL_DAYS);
  const dayMap = window._dayMapData || {};
  const filtered = ALL_DAYS.filter(d => active.has(d));
  const dh = $('day-heatmap');
  if(!dh) return;

  const cols = filtered.length <= 3 ? filtered.length : 3;
  const remainder = filtered.length % cols;

  // For small counts, use flex centering instead of grid
  if (filtered.length <= 3) {
    dh.style.display = 'flex';
    dh.style.flexDirection = 'row';
    dh.style.alignItems = 'center';
    dh.style.justifyContent = 'center';
    dh.style.gap = '6px';
    dh.style.gridTemplateColumns = '';
    dh.style.alignContent = '';

    // Scale card sizing based on count: 1=large, 2=medium, 3=normal
    const cardW      = filtered.length === 1 ? 'calc((100% - 48px) / 1.5)' : filtered.length === 2 ? 'calc((100% - 48px) / 2.1)' : 'calc((100% - 48px) / 3)';
    const valSize    = filtered.length === 1 ? '28px' : filtered.length === 2 ? '22px' : '13px';
    const padding    = filtered.length === 1 ? '18px 12px' : filtered.length === 2 ? '14px 10px' : '10px 6px';
    const nameSize   = filtered.length === 1 ? '11px' : filtered.length === 2 ? '10px' : '9px';
    const subSize    = filtered.length === 1 ? '11px' : filtered.length === 2 ? '10px' : '9px';

    dh.innerHTML = filtered.map(name => {
      const d = dayMap[name] || {pnl:0,trades:0};
      return `<div class="hday ${d.pnl>0?'hday-pos':d.pnl<0?'hday-neg':'hday-neu'}" style="width:${cardW};min-width:0;flex-shrink:0;padding:${padding};cursor:${d.trades>0?'pointer':'default'};transition:transform .15s" ${d.trades>0?`onclick="navigateToLog({type:'day',value:'${name}'})" title="View ${d.trades} ${name} trade${d.trades!==1?'s':''}" onmouseenter="this.style.transform='scale(1.04)'" onmouseleave="this.style.transform=''"`:''}>
        <div class="hday-name" style="font-size:${nameSize};margin-bottom:${filtered.length===1?'10px':'7px'}">${name}</div>
        <div class="hday-val" style="color:${d.pnl>0?'var(--green)':d.pnl<0?'var(--red)':'var(--text3)'};font-size:${valSize}">${d.trades>0?(d.pnl>0?'+':'')+'\$'+Math.abs(d.pnl).toFixed(2):'—'}</div>
        <div class="hday-trades" style="font-size:${subSize};margin-top:${filtered.length===1?'8px':'5px'}">${d.trades||0} trade${d.trades!==1?'s':''}</div>
      </div>`;
    }).join('');
  } else {
    dh.style.display = 'grid';
    dh.style.gridTemplateColumns = `repeat(${cols},1fr)`;
    dh.style.alignContent = 'start';
    dh.style.justifyContent = '';

    const cellW = `calc((100% - ${(cols-1) * 6}px) / ${cols})`;
    const cards = filtered.map(name => {
      const d = dayMap[name] || {pnl:0,trades:0};
      return `<div class="hday ${d.pnl>0?'hday-pos':d.pnl<0?'hday-neg':'hday-neu'}" style="cursor:${d.trades>0?'pointer':'default'};transition:transform .15s" ${d.trades>0?`onclick="navigateToLog({type:'day',value:'${name}'})" title="View ${d.trades} ${name} trade${d.trades!==1?'s':''}" onmouseenter="this.style.transform='scale(1.04)'" onmouseleave="this.style.transform=''"`:''}>
        <div class="hday-name">${name}</div>
        <div class="hday-val" style="color:${d.pnl>0?'var(--green)':d.pnl<0?'var(--red)':'var(--text3)'}">${d.trades>0?(d.pnl>0?'+':'')+'\$'+Math.abs(d.pnl).toFixed(2):'—'}</div>
        <div class="hday-trades">${d.trades||0} trade${d.trades!==1?'s':''}</div>
      </div>`;
    });

    if (remainder > 0) {
      const orphanCards = filtered.slice(-remainder).map(name => {
        const d = dayMap[name] || {pnl:0,trades:0};
        return `<div class="hday ${d.pnl>0?'hday-pos':d.pnl<0?'hday-neg':'hday-neu'}" style="width:${cellW};flex-shrink:0;cursor:${d.trades>0?'pointer':'default'};transition:transform .15s" ${d.trades>0?`onclick="navigateToLog({type:'day',value:'${name}'})" title="View ${d.trades} ${name} trade${d.trades!==1?'s':''}" onmouseenter="this.style.transform='scale(1.04)'" onmouseleave="this.style.transform=''"`:''}>
          <div class="hday-name">${name}</div>
          <div class="hday-val" style="color:${d.pnl>0?'var(--green)':d.pnl<0?'var(--red)':'var(--text3)'}">${d.trades>0?(d.pnl>0?'+':'')+'\$'+Math.abs(d.pnl).toFixed(2):'—'}</div>
          <div class="hday-trades">${d.trades||0} trade${d.trades!==1?'s':''}</div>
        </div>`;
      });
      cards.splice(cards.length - remainder);
      cards.push(`<div style="grid-column:1/-1;display:flex;justify-content:center;gap:6px">${orphanCards.join('')}</div>`);
    }
    dh.innerHTML = cards.join('');
  }

  const meta = $('ph-meta-day');
  if(meta) meta.textContent = filtered.length + ' day' + (filtered.length!==1?'s':'');
}

function toggleDayFilterDropdown(e) {
  e.stopPropagation();
  const dd = $('day-filter-dd');
  const isOpen = dd.style.display === 'block';
  dd.style.display = isOpen ? 'none' : 'block';
  if(!isOpen) {
    const handler = function(ev) {
      if (ev.type === 'keydown' && ev.key === 'Enter') {
        dd.style.display = 'none';
        document.removeEventListener('click', handler);
        document.removeEventListener('keydown', handler);
      } else if (ev.type === 'click' && !dd.contains(ev.target)) {
        dd.style.display = 'none';
        document.removeEventListener('click', handler);
        document.removeEventListener('keydown', handler);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', handler);
      document.addEventListener('keydown', handler);
    }, 0);
  }
}

function saveAcctFilters() {
  if (!window._acctFilters) window._acctFilters = {};
  const k = anCurrentAccount || '__all__';
  window._acctFilters[k] = {
    _dayFilter:     window._dayFilter     ? new Set(window._dayFilter)     : null,
    _setupFilter:   window._setupFilter   ? new Set(window._setupFilter)   : null,
    _sessionFilter: window._sessionFilter ? new Set(window._sessionFilter) : null,
  };
}

function dayFilterChange() {
  const checks = $$('#day-filter-checks input[type=checkbox]');
  window._dayFilter = new Set([...checks].filter(c=>c.checked).map(c=>c.dataset.day));
  saveAcctFilters();
  renderDayHeatmap();
}

function dayFilterClear() {
  $$('#day-filter-checks input').forEach(c=>c.checked=false);
  dayFilterChange();
}

function dayFilterWeekdays() {
  const weekdays = new Set(['Mon','Tue','Wed','Thu','Fri']);
  $$('#day-filter-checks input').forEach(c=>{ c.checked=weekdays.has(c.dataset.day); });
  dayFilterChange();
}

function renderSetupDistrib(setupArr) {
  const filtered = setupArr.filter(([name])=> !window._setupFilter || window._setupFilter.has(name));
  const total = filtered.reduce((s,[,c])=>s+c,0);
  const m = $('ph-meta-setup');
  if(m) m.textContent = filtered.length + ' model' + (filtered.length!==1?'s':'');

  // Build setup → trade IDs map for click navigation
  const acctName = (typeof anCurrentAccount !== 'undefined' && anCurrentAccount && anCurrentAccount !== '__all__')
    ? anCurrentAccount
    : (typeof selectedAcct !== 'undefined' && selectedAcct >= 0 && ACCOUNTS[selectedAcct]
        ? (ACCOUNTS[selectedAcct].key || ACCOUNTS[selectedAcct].phase)
        : '');
  const sourceTrades = acctName ? TRADES.filter(t => (t.account||'') === acctName) : TRADES;
  const pbNamesDistrib = new Set((typeof getPbList === 'function' ? getPbList() : PB_DEFAULTS).map(p => p.name));
  const setupIdMap = {};
  sourceTrades.forEach(t => {
    let key = t.model || t.setup || 'Other';
    if (!pbNamesDistrib.has(key) && MODEL_MIGRATION_MAP[key]) key = MODEL_MIGRATION_MAP[key];
    if (!pbNamesDistrib.has(key)) key = 'Other';
    if (!setupIdMap[key]) setupIdMap[key] = [];
    setupIdMap[key].push(String(t.id));
  });

  $('setup-distrib').innerHTML = filtered.length === 0
    ? `<div style="padding:20px;text-align:center;font-family:var(--font-mono);font-size:10px;color:var(--text3)">No models selected</div>`
    : filtered.map(([name,count],i) => {
        const ids = setupIdMap[name] || [];
        const pct = total > 0 ? (count/total*100).toFixed(0) : 0;
        const safeIds = ids.join(',');
        return `<div class="distrib-item" style="cursor:pointer;border-radius:6px;padding:3px 4px;margin:-3px -4px;transition:background .15s"
          data-ids="${safeIds}"
          onclick="navigateToLog({type:'ids',value:this.dataset.ids?this.dataset.ids.split(','):[]})"
          title="View ${count} ${name} trade${count!==1?'s':''} in Trade Log"
          onmouseenter="this.style.background='var(--ac-08)'"
          onmouseleave="this.style.background=''">
          <div class="distrib-label">${name}</div>
          <div class="distrib-bar-bg">
            <div class="distrib-bar-fill" style="width:${pct}%;background:var(--purple)">
              ${pct >= 15 ? `<span class="distrib-bar-count">${count}</span>` : ''}
            </div>
            ${pct < 15 ? `<span style="position:absolute;left:calc(${pct}% + 4px);font-size:9px;font-family:var(--font-mono);font-weight:700;color:var(--text2);line-height:1;white-space:nowrap">${count}</span>` : ''}
          </div>
          <div class="distrib-count">${pct}%</div>
        </div>`;
      }).join('');
}

function toggleSetupFilterDropdown(e) {
  e.stopPropagation();
  const dd = $('setup-filter-dd');
  const isOpen = dd.style.display === 'block';
  dd.style.display = isOpen ? 'none' : 'block';
  if(!isOpen) {
    const handler = function(ev) {
      if(ev.type==='keydown' && ev.key==='Enter') {
        dd.style.display='none';
        document.removeEventListener('click', handler);
        document.removeEventListener('keydown', handler);
      } else if(ev.type==='click' && !dd.contains(ev.target) && ev.target.id!=='setup-filter-btn') {
        dd.style.display='none';
        document.removeEventListener('click', handler);
        document.removeEventListener('keydown', handler);
      }
    };
    setTimeout(()=>{ document.addEventListener('click', handler); document.addEventListener('keydown', handler); }, 0);
  }
}

function setupFilterChange() {
  const checks = $$('#setup-filter-checks input[type=checkbox]');
  window._setupFilter = new Set([...checks].filter(c=>c.checked).map(c=>c.dataset.model));
  saveAcctFilters();
  const all = window._allSetupModels || [];
  renderSetupDistrib(all.map(name=>[name, (window._setupMapCache||{})[name]||0]));
}

function setupFilterSelectAll() {
  $$('#setup-filter-checks input').forEach(c=>c.checked=true);
  setupFilterChange();
}

function setupFilterClear() {
  $$('#setup-filter-checks input').forEach(c=>c.checked=false);
  setupFilterChange();
}

function renderSessionDistrib(sessionArr) {
  const filtered = sessionArr.filter(([name])=> !window._sessionFilter || window._sessionFilter.has(name));
  const maxAbsSession = Math.max(...filtered.map(([,v])=>Math.abs(v.pnl)),1);
  const ms = $('ph-meta-session');
  if(ms) ms.textContent = filtered.length + ' session' + (filtered.length!==1?'s':'');
  $('session-distrib').innerHTML = filtered.length === 0
    ? `<div style="padding:20px;text-align:center;font-family:var(--font-mono);font-size:10px;color:var(--text3)">No sessions selected</div>`
    : filtered.map(([name,v])=>{
      const wr = v.trades ? ((v.wins/v.trades)*100).toFixed(0) : 0;
      const barW = (Math.abs(v.pnl)/maxAbsSession*100).toFixed(1);
      const col  = v.pnl>=0?'var(--green)':'var(--red)';
      return `<div style="display:flex;flex-direction:column;gap:5px;cursor:pointer;border-radius:6px;padding:4px 6px;margin:-4px -6px;transition:background .15s" onclick="navigateToLog({type:'session',value:'${name}'})" title="View ${v.trades} ${name} trade${v.trades!==1?'s':''}" onmouseenter="this.style.background='var(--ac-08)'" onmouseleave="this.style.background=''">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <span style="font-size:11px;font-family:var(--font-mono);color:var(--text);letter-spacing:.04em">${name}</span>
            <span style="font-size:9px;color:var(--text3);font-family:var(--font-mono);margin-left:8px">${v.trades}T · ${wr}%WR</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-family:var(--font-display);font-weight:700;font-size:13px;color:${col}">${v.pnl>=0?'+':'-'}\$${Math.abs(v.pnl).toFixed(2)}</span>
            <span style="font-size:8px;font-family:var(--font-mono);color:var(--purple);opacity:.6">→</span>
          </div>
        </div>
        <div style="height:4px;background:var(--bg5);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${barW}%;background:${col};border-radius:2px;box-shadow:0 0 6px ${v.pnl>=0?'rgba(46,204,138,.25)':'rgba(232,80,74,.25)'};transition:width .6s cubic-bezier(.4,0,.2,1)"></div>
        </div>
      </div>`;
    }).join('');
}

function toggleSessionFilterDropdown(e) {
  e.stopPropagation();
  const dd = $('session-filter-dd');
  const isOpen = dd.style.display === 'block';
  dd.style.display = isOpen ? 'none' : 'block';
  if(!isOpen) {
    const handler = function(ev) {
      if(ev.type==='keydown' && ev.key==='Enter') {
        dd.style.display='none';
        document.removeEventListener('click', handler);
        document.removeEventListener('keydown', handler);
      } else if(ev.type==='click' && !dd.contains(ev.target) && ev.target.id!=='session-filter-btn') {
        dd.style.display='none';
        document.removeEventListener('click', handler);
        document.removeEventListener('keydown', handler);
      }
    };
    setTimeout(()=>{ document.addEventListener('click', handler); document.addEventListener('keydown', handler); }, 0);
  }
}

function sessionFilterChange() {
  const checks = $$('#session-filter-checks input[type=checkbox]');
  window._sessionFilter = new Set([...checks].filter(c=>c.checked).map(c=>c.dataset.session));
  saveAcctFilters();
  const all = window._allSessionNames || [];
  renderSessionDistrib(all.map(name=>[name, (window._sessionMapCache||{})[name]||{pnl:0,wins:0,losses:0,trades:0}]));
}

function sessionFilterSelectAll() {
  $$('#session-filter-checks input').forEach(c=>c.checked=true);
  sessionFilterChange();
}

function sessionFilterClear() {
  $$('#session-filter-checks input').forEach(c=>c.checked=false);
  sessionFilterChange();
}

function initAnalyticsCharts() {
  analyticsInitialized = true;

  // Populate account selector bars
  const html = buildAnAccountBar();
  const barP3 = $('an-acct-bar-p3');
  const barP4 = $('an-acct-bar-p4');
  if (barP3) barP3.innerHTML = html;
  if (barP4) barP4.innerHTML = html;

  updateAnalyticsCards();

  const trades = getAnTrades();

  // ── Chart defaults ──
  const FONT = 'JetBrains Mono';
  const TICK = { color:'var(--text3)', font:{ family:FONT, size:10 } };
  const GRID = { color:'rgba(255,255,255,.035)' };
  const TOOLTIP = { backgroundColor:'#111318', borderColor:'var(--ac-30)', borderWidth:1,
    titleFont:{family:FONT,size:10}, bodyFont:{family:FONT,size:10}, padding:10,
    callbacks:{ label: ctx => (ctx.raw>=0?'+':'')+'\$'+Math.abs(ctx.raw).toFixed(2) } };

  // ── Day of week heatmap (live) ──
  const ALL_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  // Preserve existing filter — only set default on first load
  if (!window._dayFilter) window._dayFilter = new Set(['Mon','Tue','Wed','Thu','Fri']);
  window._dayMapData = {};

  const dayTrades = getAnTradesForCard('day');
  const dayMap = {Mon:{pnl:0,trades:0},Tue:{pnl:0,trades:0},Wed:{pnl:0,trades:0},Thu:{pnl:0,trades:0},Fri:{pnl:0,trades:0},Sat:{pnl:0,trades:0},Sun:{pnl:0,trades:0}};
  dayTrades.forEach(t => {
    const d = new Date(t.date); const name = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
    if(dayMap[name]){ dayMap[name].pnl+=t.pnl; dayMap[name].trades++; }
  });
  window._dayMapData = dayMap;

  // Build checkboxes
  const checks = $('day-filter-checks');
  if(checks) checks.innerHTML = ALL_DAYS.map(d=>`
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:2px 0">
      <input type="checkbox" data-day="${d}" ${d!=='Sat'&&d!=='Sun'?'checked':''} onchange="dayFilterChange()" style="accent-color:var(--purple);width:12px;height:12px;cursor:pointer">
      <span style="font-family:var(--font-mono);font-size:10px;color:var(--text2)">${d}</span>
    </label>`).join('');

  renderDayHeatmap();

  // ── Setup distribution (live) — sourced from Entry Model ──
  const pbNamesInit = new Set((typeof getPbList === 'function' ? getPbList() : PB_DEFAULTS).map(p => p.name));
  const setupMap = {};
  getAnTradesForCard('setup').forEach(t => {
    let s = t.model || t.setup || 'Other';
    if (!pbNamesInit.has(s) && MODEL_MIGRATION_MAP[s]) s = MODEL_MIGRATION_MAP[s];
    if (!pbNamesInit.has(s)) s = 'Other';
    setupMap[s] = (setupMap[s] || 0) + 1;
  });
  if (setupMap['Other'] === 0) delete setupMap['Other'];
  window._setupMapCache = setupMap;
  const setupArr = Object.entries(setupMap).sort((a,b)=>b[1]-a[1]);
  window._allSetupModels = setupArr.map(([name])=>name);
  // Preserve existing filter — only default to all on first load
  if (!window._setupFilter) window._setupFilter = new Set(window._allSetupModels);
  // Build filter checkboxes
  const setupChecks = $('setup-filter-checks');
  if(setupChecks) setupChecks.innerHTML = window._allSetupModels.map(name=>`
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:2px 0">
      <input type="checkbox" data-model="${name}" ${window._setupFilter.has(name)?'checked':''} onchange="setupFilterChange()" style="accent-color:var(--purple);width:12px;height:12px;cursor:pointer">
      <span style="font-family:var(--font-mono);font-size:10px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px">${name}</span>
    </label>`).join('');
  renderSetupDistrib(setupArr);

  // ── Session breakdown (live) ──
  const sessionMap = {};
  getAnTradesForCard('session').forEach(t => {
    const s = t.session||'Unknown';
    if(!sessionMap[s]) sessionMap[s]={pnl:0,wins:0,losses:0,trades:0};
    sessionMap[s].pnl+=t.pnl; sessionMap[s].trades++;
    if(t.pnl>0) sessionMap[s].wins++; else sessionMap[s].losses++;
  });
  const sessionArr = Object.entries(sessionMap).sort((a,b)=>b[1].pnl-a[1].pnl);
  window._allSessionNames = sessionArr.map(([name])=>name);
  window._sessionMapCache = sessionMap;
  // Preserve existing filter — only default to all on first load
  if (!window._sessionFilter) window._sessionFilter = new Set(window._allSessionNames);
  // Build filter checkboxes
  const sessionChecks = $('session-filter-checks');
  if(sessionChecks) sessionChecks.innerHTML = window._allSessionNames.map(name=>`
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:2px 0">
      <input type="checkbox" data-session="${name}" ${window._sessionFilter.has(name)?'checked':''} onchange="sessionFilterChange()" style="accent-color:var(--purple);width:12px;height:12px;cursor:pointer">
      <span style="font-family:var(--font-mono);font-size:10px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px">${name}</span>
    </label>`).join('');
  renderSessionDistrib(sessionArr);

  // ── Instrument breakdown (live) ──
  const instrMap = {};
  const isAllAccts = !anCurrentAccount || anCurrentAccount === '__all__';
  const shortAcctName = n => (n || '')
    .replace('FTM Prop Firm - ', '')
    .replace('Apex Trader - ', 'Apex ')
    .replace('GOAT - ', 'GOAT ');

  trades.forEach(t => {
    const s = t.symbol;
    if (!instrMap[s]) instrMap[s] = { trades:0, wins:0, pnl:0, winPnl:0, lossPnl:0, accounts: new Set() };
    instrMap[s].trades++;
    instrMap[s].pnl += t.pnl;
    instrMap[s].accounts.add(t.account || 'Unknown');
    if (t.pnl > 0) { instrMap[s].wins++; instrMap[s].winPnl += t.pnl; }
    else { instrMap[s].lossPnl += t.pnl; }
  });
  const instrArr = Object.entries(instrMap).sort((a,b) => b[1].pnl - a[1].pnl);
  const mi = $('ph-meta-instr');
  if (mi) mi.textContent = instrArr.length + ' instrument' + (instrArr.length!==1?'s':'');
  $('instrument-tbody').innerHTML = instrArr.map(([sym, v]) => {
    const wr   = ((v.wins/v.trades)*100).toFixed(0);
    const avgW = v.wins ? (v.winPnl/v.wins).toFixed(2) : 0;
    const avgL = (v.trades-v.wins) ? (v.lossPnl/(v.trades-v.wins)).toFixed(2) : 0;
    const pf   = v.lossPnl !== 0 ? Math.abs(v.winPnl/v.lossPnl).toFixed(2) : '∞';
    // Build account tags shown only in All Accounts mode
    const acctTags = isAllAccts && v.accounts.size > 0
      ? '<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:3px">'
        + [...v.accounts].map(a =>
            '<span style="font-size:8px;font-family:var(--font-mono);padding:1px 5px;border-radius:3px;'
          + 'background:var(--purple2);color:var(--purple);border:1px solid var(--ac-20);white-space:nowrap">'
          + shortAcctName(a) + '</span>'
          ).join('')
        + '</div>'
      : '';
    return `<tr style="cursor:pointer;transition:background .12s" onclick="navigateToLog({type:'symbol',value:'${sym}'})" title="View ${v.trades} ${sym} trade${v.trades!==1?'s':''}" onmouseenter="this.style.background='var(--ac-07)'" onmouseleave="this.style.background=''">
      <td>
        <div class="sym-cell"><div class="sym-icon">${sym.slice(0,2)}</div>
          <div>
            <div class="sym-name">${sym}</div>
            ${acctTags}
          </div>
        </div>
      </td>
      <td style="font-family:var(--font-mono)">${v.trades}</td>
      <td style="font-family:var(--font-mono);color:${wr>=50?'var(--amber)':'var(--red)'}">${wr}%</td>
      <td><span class="${v.pnl>=0?'pnl-pos':'pnl-neg'}">${v.pnl>=0?'+':'-'}\$${Math.abs(v.pnl).toFixed(2)}</span></td>
      <td class="pnl-pos">${v.wins?'+\$'+avgW:'—'}</td>
      <td class="pnl-neg">${(v.trades-v.wins)?'-\$'+Math.abs(avgL):'—'}</td>
      <td style="font-family:var(--font-mono);color:var(--blue)">${pf}</td>
      <td style="font-family:var(--font-mono);font-size:10px;color:var(--purple);opacity:.5">→</td>
    </tr>`;
  }).join('');

  // ── Theme-aware axis colors ──
  const isLightMode = document.documentElement.classList.contains('light');
  const axisTickColor = isLightMode ? 'rgba(10,11,16,.6)' : 'rgba(221,225,239,.4)';
  const gridColor = isLightMode ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.03)';

  // ── Best trading hours (premium bar chart) ──
  const hourMap = {};
  trades.forEach(t => {
    const h = parseInt(t.time.split(':')[0]);
    const label = h < 12 ? h+'am' : h===12?'12pm':(h-12)+'pm';
    if(!hourMap[label]) hourMap[label]=0;
    hourMap[label]+=t.pnl;
  });
  const hourLabels = Object.keys(hourMap);
  const hourData   = Object.values(hourMap);
  const mh = $('ph-meta-hours');
  if(mh) mh.textContent = hourLabels.length + ' active hour' + (hourLabels.length!==1?'s':'');
  const hCtx = $('hourChart').getContext('2d');
  if (hourChartInstance) { hourChartInstance.destroy(); hourChartInstance = null; }
  hourChartInstance = new Chart(hCtx, {
    type: 'bar',
    data: { labels: hourLabels, datasets: [{
      data: hourData,
      backgroundColor: hourData.map(v => v >= 0 ? 'rgba(46,204,138,.7)' : 'rgba(232,80,74,.7)'),
      hoverBackgroundColor: hourData.map(v => v >= 0 ? (isLightMode?'rgba(26,158,98,.8)':'rgba(46,204,138,.6)') : (isLightMode?'rgba(214,60,55,.8)':'rgba(232,80,74,.6)')),
      borderColor: hourData.map(v => v >= 0 ? '#2ecc8a' : '#e8504a'),
      borderWidth: 1.5,
      borderRadius: { topLeft: 5, topRight: 5, bottomLeft: 0, bottomRight: 0 },
      borderSkipped: false,
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isLightMode ? '#ffffff' : '#13141a',
          borderColor: isLightMode ? 'rgba(0,0,0,.12)' : 'var(--ac-40)',
          borderWidth: 1,
          padding: 10,
          titleFont: { family: 'JetBrains Mono', size: 10 },
          bodyFont:  { family: 'JetBrains Mono', size: 11 },
          titleColor: isLightMode ? 'rgba(10,11,16,.5)' : 'rgba(221,225,239,.5)',
          bodyColor:  isLightMode ? '#1a1d2e' : '#dde1ef',
          callbacks: { label: ctx => (ctx.raw >= 0 ? '+' : '-') + '\$' + Math.abs(ctx.raw).toFixed(2) }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: axisTickColor, font: { family: 'JetBrains Mono', size: 9 } },
          border: { display: false }
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: axisTickColor, font: { family: 'JetBrains Mono', size: 9 }, callback: v => (v >= 0 ? '+' : '') + '\$' + v },
          border: { display: false }
        }
      },
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const idx = elements[0].index;
        const label = hourLabels[idx];
        if (label) navigateToLog({ type: 'hour', value: label });
      },
      onHover: (evt, elements) => {
        evt.native.target.style.cursor = elements.length ? 'pointer' : 'default';
      }
    }
  });
}

// ── SCORING ENGINE ──

// Kill zone definitions (EST, 24h format as minutes from midnight)
const KILL_ZONES = [
  { name: 'London Open', start: 2*60,  end: 5*60  },
  { name: 'NY Open',     start: 8*60,  end: 10*60 },
  { name: 'London Close',start: 10*60, end: 12*60 },
  { name: 'Asia',        start: 19*60, end: 23*60 },
];

// Full ICT/SMC kill zone → native instrument mapping
// Normalised: strip all non-alpha chars when matching
const SESSION_INSTRUMENTS = {
  'London Open': [
    // European pairs — most active at London open
    'EURUSD','GBPUSD','EURGBP','EURCHF','GBPCHF','EURCAD','GBPCAD',
    'EURAUD','GBPAUD','EURNZD','GBPNZD',
    // Metals — strong London open moves
    'XAUUSD','XAGUSD','GOLD','SILVER',
  ],
  'NY Open': [
    // EUR/GBP still active during overlap
    'EURUSD','GBPUSD',
    // USD pairs come alive at NY open
    'USDJPY','USDCAD','USDCHF',
    // Commodity currencies with USD correlation
    'AUDUSD','NZDUSD','CADJPY','AUDJPY','NZDJPY',
    // Metals — huge NY open moves
    'XAUUSD','XAGUSD','GOLD','SILVER',
  ],
  'London Close': [
    // European pairs closing out positions
    'EURUSD','GBPUSD','EURGBP','EURCAD','GBPCAD',
    // EUR/GBP cross settles here
    'EURCHF','GBPCHF',
    // Metals can reverse at London close
    'XAUUSD','XAGUSD','GOLD','SILVER',
  ],
  'Asia': [
    // Asia-Pacific pairs — native session
    'USDJPY','AUDUSD','NZDUSD','AUDJPY','NZDJPY','CADJPY',
    'AUDNZD','AUDCAD','NZDCAD',
    // Metals trade 24h, Asia gives clean setups
    'XAUUSD','XAGUSD','GOLD','SILVER',
    // EUR/GBP are intentionally excluded — dead in Asia
  ],
};

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function getKillZone(timeStr) {
  const mins = timeToMinutes(timeStr);
  return KILL_ZONES.find(kz => mins >= kz.start && mins < kz.end) || null;
}

function normaliseSymbol(sym) {
  return (sym || '').toUpperCase().replace(/[^A-Z]/g, '');
}

function isPreferredInstrument(symbol, kzName) {
  if (!kzName) return false;
  const allowed = SESSION_INSTRUMENTS[kzName] || [];
  const sym = normaliseSymbol(symbol);
  return allowed.some(a => normaliseSymbol(a) === sym);
}

function calcRiskPct(t) {
  // risk% = |entry - SL| * size / accountBalance * 100
  // We work in % terms only — use a normalised unit value
  // For futures-style: risk in points * size, normalised to account as %
  // Since we don't know tick value, we use pnl-based proxy:
  // risk$ = |entry - SL| * size  (raw points * contracts)
  // We express as % of account using relative scale: cap at 1% = full score
  if (!t.sl || !t.entry || !t.size) return 0;
  const riskPoints = Math.abs(t.entry - t.sl) * t.size;
  // Proxy: treat account as 100x the dollar risk of a "1% risk" trade
  // Since we don't have tick value, we compare riskPoints to pnl magnitude
  // Better proxy: if SL is set, use R-based risk: risk = |entry-SL|/entry * 100 * size
  const riskPct = (Math.abs(t.entry - t.sl) / t.entry) * 100 * t.size;
  // Saturate at 1%: score = min(riskPct/1, 1) * 25
  return Math.min(riskPct / 1.0, 1) * 25;
}

function scoreTrade(t, streakCount) {
  const result = t.pnl > 0 ? 'W' : t.pnl < 0 ? 'L' : 'BE';

  // 1. Win score (max 30)
  const winScore = result === 'W' ? 30 : 0;

  // 2. Risk % score (max 25)
  const riskScore = calcRiskPct(t);

  // 3. Kill zone score (max 20)
  const kz = getKillZone(t.time || '00:00');
  const kzScore = kz ? 20 : 0;

  // 4. Instrument + KZ match score (max 15)
  const instrScore = isPreferredInstrument(t.symbol, kz ? kz.name : null) ? 15 : 0;

  // Base score (max 90 before streak)
  const base = winScore + riskScore + kzScore + instrScore;

  // 5. Streak multiplier: wins 1-2 = ×1.0, win 3+ = ×(1.0 + (N-2)×0.2)
  const multiplier = (result === 'W' && streakCount >= 3)
    ? 1.0 + (streakCount - 2) * 0.2
    : 1.0;

  const finalScore = Math.round(base * multiplier);

  return {
    ...t,
    result,
    kzName: kz ? kz.name : null,
    inKZ: !!kz,
    instrMatch: instrScore > 0,
    riskPct: t.sl ? ((Math.abs(t.entry - t.sl) / t.entry) * 100 * t.size) : 0,
    streakCount,
    multiplier,
    scoreBreakdown: { winScore, riskScore: Math.round(riskScore), kzScore, instrScore },
    score: finalScore,
  };
}

function computeScoredTrades() {
  // Use getDashboardTrades() so scorecard respects selected account filter
  const tradeSrc = (typeof getDashboardTrades === 'function') ? getDashboardTrades() : TRADES;
  // Sort by date+time ascending to compute streaks in order
  const sorted = [...tradeSrc].sort((a, b) => {
    const da = a.date + 'T' + (a.time || '00:00');
    const db = b.date + 'T' + (b.time || '00:00');
    return da.localeCompare(db);
  });

  let streak = 0;
  return sorted.map(t => {
    const result = t.pnl > 0 ? 'W' : t.pnl < 0 ? 'L' : 'BE';
    if (result === 'W') streak++;
    else streak = 0;
    return scoreTrade(t, streak);
  });
}

// ── PLAYBOOK ──
function initScorecard() {
  const scored = computeScoredTrades().sort((a, b) => b.score - a.score);

  $('scorecard-tbody').innerHTML = scored.map((t, i) => {
    const scoreColor = t.score >= 70 ? 'var(--green)' : t.score >= 40 ? 'var(--amber)' : 'var(--red)';
    const resultColor = t.result === 'W' ? 'var(--green)' : t.result === 'L' ? 'var(--red)' : 'var(--text3)';

    // Build tooltip breakdown
    const bd = t.scoreBreakdown;
    const streakLabel = t.multiplier > 1 ? ` ×${t.multiplier.toFixed(1)}` : '';
    const tooltip = `Win:${bd.winScore} | Risk:${bd.riskScore} | KZ:${bd.kzScore}${t.kzName?' ('+t.kzName+')':''} | Instr:${bd.instrScore}${streakLabel}`;

    return `<tr style="border-bottom:1px solid var(--border);transition:background .12s;cursor:default" title="${tooltip}" onmouseenter="this.style.background='var(--bg4)'" onmouseleave="this.style.background='transparent'">
      <td style="padding:9px 10px;text-align:center;font-size:11px;color:var(--text3);font-family:var(--font-mono)">${i + 1}</td>
      <td style="padding:9px 10px;text-align:center">
        <div style="font-family:var(--font-display);font-weight:700;font-size:12.5px">${t.symbol}</div>
        <div style="font-size:9.5px;color:var(--text3);font-family:var(--font-mono)">${t.date}</div>
      </td>
      <td style="padding:9px 10px;text-align:center;font-family:var(--font-mono);font-size:11px;font-weight:700;color:${resultColor}">${t.result}</td>
      <td style="padding:9px 10px;text-align:right;font-family:var(--font-mono);font-size:12px;font-weight:600;color:${t.pnl>=0?'var(--green)':'var(--red)'}">${t.pnl>=0?'+':'-'}$${Math.abs(t.pnl).toFixed(2)}</td>
      <td style="padding:9px 20px 9px 10px;text-align:center">
        <div style="display:inline-flex;align-items:center;justify-content:center;min-width:32px">
          <span style="font-family:var(--font-mono);font-size:13px;font-weight:700;color:${scoreColor}">${t.score}</span>
          <span style="font-size:11px;margin-left:4px;min-width:14px">${t.multiplier > 1 ? '<svg width=10 height=10 viewBox="0 0 16 16" fill=none><path d="M8 1c0 0-4 3-4 7a4 4 0 0 0 8 0c0-2-1-3.5-2-4.5 0 1.5-1 2.5-2 2.5C7 4.5 8 2.5 8 1z" stroke=currentColor stroke-width=1.3 stroke-linejoin=round fill=none/></svg>' : ''}</span>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function initPlaybook() {
  const plays = getPlaybookListWithSample(); // Include sample + user playbooks
  // Compute stats from TRADES for each play
  const grid = $('playbook-grid');
  if (!grid) return;
  grid.innerHTML = plays.map((p,i) => {
    const name = p.name;
    const matched = (TRADES||[]).filter(t => (t.model||'').toLowerCase() === name.toLowerCase());
    const total   = matched.length;
    const wins    = matched.filter(t => t.pnl > 0).length;
    const wr      = total ? Math.round((wins/total)*100) : null;
    const netPnl  = matched.reduce((s,t)=>s+(t.pnl||0),0);
    const wrDisplay = wr !== null ? wr+'%' : '—';
    const wrColor   = wr === null ? 'var(--text3)' : wr >= 50 ? 'var(--green)' : 'var(--amber)';
    const hasImgs   = p.images && p.images.length > 0;
    // thumbnail strip — wrapper div stops propagation; label shown below if set
    const thumbs = hasImgs ? p.images.slice(0,3).map((img,ii)=>{
      const lbl = (p.imageLabels && p.imageLabels[ii]) || '';
      return `
      <div style="display:flex;flex-direction:column;gap:3px" onclick="event.stopPropagation();pbLightbox(${i},${ii})">
        <div style="border-radius:5px;overflow:hidden;border:1px solid var(--ac-15);cursor:zoom-in;transition:opacity .15s" onmouseenter="this.style.opacity='.8'" onmouseleave="this.style.opacity='1'">
          <img src="${img}" style="width:100%;height:52px;object-fit:cover;display:block;pointer-events:none"/>
        </div>
        ${lbl ? `<div style="font-size:9px;color:var(--text3);font-family:var(--font-mono);text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px" title="${lbl}">${lbl}</div>` : ''}
      </div>`;
    }).join('') : '';
    return `
    <div onclick="openPlaybookModal(${i})" style="background:linear-gradient(135deg,var(--bg3) 0%,var(--ac-07) 60%,var(--ac-18) 100%);border:1px solid var(--ac-20);border-radius:12px;padding:18px;transition:border-color .15s,transform .15s,box-shadow .15s;box-shadow:inset 0 0 40px var(--ac-09);display:flex;flex-direction:column;gap:0;cursor:pointer" onmouseenter="this.style.borderColor='var(--ac-45)';this.style.transform='translateY(-2px)';this.style.boxShadow='inset 0 0 60px var(--ac-14),0 8px 24px rgba(0,0,0,.3)'" onmouseleave="this.style.borderColor='var(--ac-20)';this.style.transform='translateY(0)';this.style.boxShadow='inset 0 0 40px var(--ac-09)'">
      <!-- Top row: emoji + name + avgR badge -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:9px">
          <div style="width:36px;height:36px;border-radius:9px;background:var(--ac-18);border:1px solid var(--ac-30);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${p.emoji||'📋'}</div>
          <div style="font-family:var(--font-display);font-weight:600;font-size:13.5px;line-height:1.2">${p.name}</div>
        </div>
        <span class="badge badge-green" style="white-space:nowrap">${p.avgR ? 'RR: '+p.avgR : '—'}</span>
      </div>
      <!-- Description -->
      <div style="font-size:11.5px;color:var(--text2);line-height:1.55;margin-bottom:10px;flex:1">${p.desc||''}</div>
      <!-- Image thumbnails -->
      ${hasImgs?`<div style="display:grid;grid-template-columns:repeat(${Math.min(p.images.length,3)},1fr);gap:5px;margin-bottom:10px">${thumbs}</div>`:''}
      <!-- Stats row -->
      <div style="display:flex;gap:16px;padding-top:10px;border-top:1px solid var(--ac-15);align-items:flex-end">
        <div>
          <div style="font-size:9px;color:var(--text3);font-family:var(--font-mono);letter-spacing:.1em;text-transform:uppercase;margin-bottom:2px">Trades</div>
          <div style="font-family:var(--font-display);font-weight:700;font-size:17px">${total}</div>
        </div>
        <div>
          <div style="font-size:9px;color:var(--text3);font-family:var(--font-mono);letter-spacing:.1em;text-transform:uppercase;margin-bottom:2px">Win Rate</div>
          <div style="font-family:var(--font-display);font-weight:700;font-size:17px;color:${wrColor}">${wrDisplay}</div>
        </div>
        <div>
          <div style="font-size:9px;color:var(--text3);font-family:var(--font-mono);letter-spacing:.1em;text-transform:uppercase;margin-bottom:2px">Net P&L</div>
          <div style="font-family:var(--font-mono);font-weight:700;font-size:12px;color:${netPnl>=0?'var(--green)':'var(--red)'}">${total?((netPnl>=0?'+':'')+' $'+Math.abs(netPnl).toFixed(0)):'—'}</div>
        </div>
        <div style="margin-left:auto;display:flex;gap:6px;align-self:flex-end">
          <button onclick="event.stopPropagation();openPlaybookModal(${i})" title="Edit" style="background:var(--ac-14);border:1px solid var(--ac-25);color:var(--text2);padding:5px 9px;border-radius:6px;font-size:11px;cursor:pointer;font-family:var(--font-body);transition:all .15s" onmouseenter="this.style.background='var(--ac-22)'" onmouseleave="this.style.background='var(--ac-14)'">Edit</button>
          <button onclick="event.stopPropagation();deletePlaybook(${i})" title="Delete" style="background:var(--red2);border:1px solid var(--red3);color:var(--red);padding:5px 9px;border-radius:6px;font-size:11px;cursor:pointer;font-family:var(--font-body);transition:all .15s" onmouseenter="this.style.background='var(--red3)'" onmouseleave="this.style.background='var(--red2)'">✕</button>
        </div>
      </div>
    </div>`;
  }).join('');
  if (!plays.length) grid.innerHTML = `<div style="grid-column:span 3;padding:60px;text-align:center;color:var(--text3);font-family:var(--font-mono);font-size:12px">No playbooks yet — click <strong>Add Playbook</strong> to create your first strategy.</div>`;
}

// ── PLAYBOOK DEFAULTS ──
// ── One sample playbook (reference only, not for editing) ──
const PB_DEFAULTS = []; // No hardcoded playbooks — loads from Supabase
const SAMPLE_PLAYBOOK = {
  id: 'sample_pb_001',
  name: 'NY Open Breakout (Sample)',
  emoji: '🚀',
  avgR: '+2.1R',
  desc: 'Trade the first 15-min high/low break after the 9:30 open. Look for volume confirmation. This is a sample entry model to show you how they work.',
  images: [],
  imageLabels: [],
  isSample: true  // Mark as sample so it cannot be edited/deleted
};

function getPbList() {
  // IMPORTANT: Clear any old hardcoded playbook data on first load
  const migrationKey = 'playbooks_v4_full_clean'; // Changed key to force new cleanup
  if (!localStorage.getItem(migrationKey)) {
    // First time after cleanup - aggressive wipe of all old demo playbooks
    const stored = localStorage.getItem('eq_playbooks');
    if (stored) {
      try {
        const playbooks = JSON.parse(stored);
        if (Array.isArray(playbooks) && playbooks.length > 0) {
          // If any of the old demo playbook names exist, wipe the cache completely
          const oldPbNames = [
            'NY Open Breakout',          // without (Sample) suffix
            'VWAP Reclaim',
            'Trend Continuation',
            'Opening Gap Fill',
            'Reversal at Structure',
            'News Play'
          ];
          
          // Check if any playbook matches old names (exact or partial)
          const hasOldData = playbooks.some(p => 
            oldPbNames.some(oldName => 
              p.name === oldName || 
              p.name === oldName + ' (Sample)' ||
              p.name.includes(oldName)
            )
          );
          
          if (hasOldData) {
            console.warn('🗑️ Old demo playbooks detected - clearing ALL playbooks cache...');
            localStorage.removeItem('eq_playbooks');
            localStorage.setItem(migrationKey, '1');
            return [];
          }
        }
      } catch(e) {
        console.error('Error during playbook cleanup:', e);
      }
    }
    localStorage.setItem(migrationKey, '1');
  }

  const raw = localStorage.getItem('eq_playbooks');
  const pbs = raw ? JSON.parse(raw) : [];
  // Filter out any remaining old sample playbooks
  return pbs.filter(p => !p.name?.includes('(Sample)') || p.isSample);
}

function getPlaybookListWithSample() {
  // Return sample + user playbooks for the playbook view page
  const userPbs = getPbList();
  return [SAMPLE_PLAYBOOK, ...userPbs];
}

function setPbList(arr) {
  localStorage.setItem('eq_playbooks', JSON.stringify(arr));
  // Sync to Supabase if signed in
  if (window.SB) {
    window.SB.getUser().then(user => {
      if (user) window.SB.savePlaybooks(arr).catch(e => console.warn('SB sync playbooks:', e));
    });
  }
}

// ── EMOJI PICKER ──
const PB_EMOJIS = ['📈','📉','🚀','💹','🎯','🔥','⚡','💡','🕯️','📊','📋','📌','📍','🔄','🔃','💰','💵','💲','🏆','🥇','⚔️','🛡️','🎲','🎰','🌊','🌀','⚠️','🔔','🔮','🧲','🧠','👁️','🕳️','📰','📄','🗂️','✅','❌','⭕','🔴','🟢','🟡','🔵','🟣','⚫','⚪','📝','✏️'];
function showEmojiPicker() {
  const picker = $('pb-emoji-picker');
  if (!picker) return;
  const grid = $('pb-emoji-grid');
  if (grid && !grid.children.length) {
    grid.innerHTML = PB_EMOJIS.map(e=>`<button onclick="pbPickEmoji('${e}')" style="font-size:18px;background:none;border:none;cursor:pointer;border-radius:6px;padding:4px;transition:background .1s;aspect-ratio:1" onmouseenter="this.style.background='var(--ac-20)'" onmouseleave="this.style.background='none'">${e}</button>`).join('');
  }
  // Position picker below the emoji box
  const box = $('pb-emoji-box');
  if (box) {
    picker.style.top  = (box.offsetTop + box.offsetHeight + 6) + 'px';
    picker.style.left = box.offsetLeft + 'px';
  }
  picker.style.display = 'block';
  setTimeout(()=>{ document.addEventListener('mousedown', pbClosePicker, {once:true}); },50);
}
function pbClosePicker(e) {
  const picker = $('pb-emoji-picker');
  if (picker && !picker.contains(e.target) && e.target.id !== 'pb-emoji-box') picker.style.display='none';
}
function pbPickEmoji(e) {
  $('pb-emoji').value = e;
  const box = $('pb-emoji-box');
  if (box) box.textContent = e;
  if ($('pb-emoji-picker')) $('pb-emoji-picker').style.display='none';
  if ($('pb-emoji-custom')) $('pb-emoji-custom').value='';
}
function pbCustomEmoji(v) {
  const trimmed = v ? v.trim() : '';
  if (!trimmed) return;
  $('pb-emoji').value = trimmed;
  const box = $('pb-emoji-box');
  if (box) box.textContent = trimmed;
}
function updateEmojiPreview(v) {}

// ── MODAL STATE ──
let _pbEditIdx = -1; // -1 = new, >= 0 = editing
let _pbModalImages = []; // [{dataUrl}] for current edit session

function openPlaybookModal(idx) {
  _pbModalImages = [];
  const title = $('pb-modal-title');
  const saveBtn = $('pb-save-btn');
  // Adjust index for user playbooks (skip the sample at index 0)
  _pbEditIdx = (idx !== undefined && idx > 0) ? (idx - 1) : -1;
  // Pre-fill if editing — must happen before setting title so we have the name
  if (_pbEditIdx >= 0) {
    const p = getPbList()[_pbEditIdx];
    if (p) {
      $('pb-name').value  = p.name  || '';
      $('pb-emoji').value = p.emoji || '📋';
      $('pb-desc').value  = p.desc  || '';
      _pbModalImages      = (p.images||[]).map((d,i)=>({dataUrl:d, label:(p.imageLabels&&p.imageLabels[i])||''}));
      // Restore RR dropdown selection
      const savedRR = p.avgR || '';
      if ($('pb-avgr')) $('pb-avgr').value = savedRR;
      const lbl = $('pb-avgr-label');
      if (lbl) { lbl.textContent = savedRR || 'Select range...'; lbl.style.color = savedRR ? 'var(--text)' : 'var(--text3)'; }
      // Set title to the playbook name
      if (title) title.innerHTML = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 3C8 3 5 2 2 3v9c3-1 6 0 6 0V3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/><path d="M8 3c0 0 3-1 6 0v9c-3-1-6 0-6 0V3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/></svg> ${p.name || 'Edit Playbook'}`;
      if (saveBtn) saveBtn.textContent = 'Save Changes';
    }
  } else {
    if (title) title.innerHTML = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 3C8 3 5 2 2 3v9c3-1 6 0 6 0V3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/><path d="M8 3c0 0 3-1 6 0v9c-3-1-6 0-6 0V3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/></svg> Add New Playbook`;
    if (saveBtn) saveBtn.textContent = 'Save Playbook';
    $('pb-name').value=''; $('pb-emoji').value='📋'; $('pb-desc').value='';
    // Reset RR dropdown
    if ($('pb-avgr')) $('pb-avgr').value = '';
    const lbl = $('pb-avgr-label');
    if (lbl) { lbl.textContent = 'Select range...'; lbl.style.color = 'var(--text3)'; }
    $$('.pb-rr-opt').forEach(o => { o.style.background=''; o.style.color='var(--text)'; o.style.fontWeight=''; });
  }
  // Sync emoji box display
  const box = $('pb-emoji-box');
  if (box) box.textContent = $('pb-emoji').value || '📋';
  if ($('pb-emoji-custom')) $('pb-emoji-custom').value='';

  pbRenderModalImages();
  $('pb-modal-overlay').style.display='flex';
  // Wire paste for images
  if (!window._pbPasteWired) {
    window._pbPasteWired = true;
    document.addEventListener('paste', _pbHandlePaste);
  }
  setTimeout(()=>$('pb-name').focus(),60);
}
function _pbHandlePaste(e) {
  if (!$('pb-modal-overlay') || $('pb-modal-overlay').style.display === 'none') return;
  // Don't intercept paste inside the emoji custom input
  if (document.activeElement && document.activeElement.id === 'pb-emoji-custom') return;
  const items = Array.from(e.clipboardData?.items || []);
  const imgItems = items.filter(it => it.type.startsWith('image/'));
  if (!imgItems.length) return;
  e.preventDefault();
  imgItems.forEach(it => { const f = it.getAsFile(); if (f) { const r = new FileReader(); r.onload = ev => { _pbModalImages.push({dataUrl:ev.target.result, label:''}); pbRenderModalImages(); }; r.readAsDataURL(f); } });
}
function closePlaybookModal() {
  $('pb-modal-overlay').style.display='none';
  const picker = $('pb-emoji-picker');
  if (picker) picker.style.display='none';
  _pbModalImages=[];
}
// ── Avg R input helpers ──
// ── Avg Expected RR dropdown ──
window._pbRROpen = false;

function togglePbRRDropdown() {
  const dd = $('pb-avgr-dd');
  const chevron = $('pb-avgr-chevron');
  const trigger = $('pb-avgr-trigger');
  if (!dd) return;
  window._pbRROpen = !window._pbRROpen;
  dd.style.display = window._pbRROpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = window._pbRROpen ? 'rotate(180deg)' : '';
  if (trigger) trigger.style.borderColor = window._pbRROpen ? 'var(--ac-50)' : 'var(--border2)';
  if (window._pbRROpen) {
    setTimeout(() => document.addEventListener('click', _pbRROutside), 10);
  }
}

function _pbRROutside(e) {
  const dd = $('pb-avgr-dd');
  const trigger = $('pb-avgr-trigger');
  if ((dd && dd.contains(e.target)) || (trigger && trigger.contains(e.target))) return;
  window._pbRROpen = false;
  if (dd) dd.style.display = 'none';
  const chevron = $('pb-avgr-chevron');
  if (chevron) chevron.style.transform = '';
  if (trigger) trigger.style.borderColor = 'var(--border2)';
  document.removeEventListener('click', _pbRROutside);
}

function selectPbRR(val) {
  if ($('pb-avgr')) $('pb-avgr').value = val;
  const lbl = $('pb-avgr-label');
  if (lbl) { lbl.textContent = val; lbl.style.color = 'var(--text)'; }
  // Highlight selected option
  $$('.pb-rr-opt').forEach(o => {
    const isSelected = o.textContent.replace(/\s/g,'') === val.replace(/\s/g,'');
    o.style.background = isSelected ? 'var(--ac-15)' : '';
    o.style.color = isSelected ? 'var(--purple)' : 'var(--text)';
    o.style.fontWeight = isSelected ? '600' : '';
  });
  // Close dropdown
  window._pbRROpen = false;
  const dd = $('pb-avgr-dd');
  if (dd) dd.style.display = 'none';
  const chevron = $('pb-avgr-chevron');
  if (chevron) chevron.style.transform = '';
  const trigger = $('pb-avgr-trigger');
  if (trigger) trigger.style.borderColor = 'var(--border2)';
  document.removeEventListener('click', _pbRROutside);
}

function pbAvgRInput(el) {} // kept for compatibility
function pbAvgRBlur(el) {}  // kept for compatibility

function savePlaybook() {
  const name  = ($('pb-name').value||'').trim();
  const emoji = ($('pb-emoji').value||'📋').trim();
  const desc  = ($('pb-desc').value||'').trim();
  const avgR  = ($('pb-avgr').value||'').trim();
  if (!name) { $('pb-name').focus(); showToast('Name is required','error','',1400); return; }
  const list = getPbList();
  const entry = { name, emoji, avgR, desc, images: _pbModalImages.map(x=>x.dataUrl), imageLabels: _pbModalImages.map(x=>x.label||'') };
  if (_pbEditIdx >= 0) list[_pbEditIdx] = entry;
  else list.push(entry);
  setPbList(list);
  closePlaybookModal();
  initPlaybook();
  if (typeof syncModelDropdownFromPlaybooks === 'function') syncModelDropdownFromPlaybooks();
  showToast(_pbEditIdx>=0?'Playbook updated':'Playbook added','success','',1800);
}
function deletePlaybook(idx) {
  // Adjust index for user playbooks (skip the sample at index 0)
  const actualIdx = idx > 0 ? (idx - 1) : idx;
  const list = getPbList();
  if (actualIdx >= 0 && actualIdx < list.length) {
    list.splice(actualIdx, 1);
    setPbList(list);
    initPlaybook();
    if (typeof syncModelDropdownFromPlaybooks === 'function') syncModelDropdownFromPlaybooks();
    showToast('Playbook removed', 'info', '', 1400);
  }
}

// ── MODAL IMAGE HANDLING ──
function pbAddImages(files) {
  if (!files||!files.length) return;
  Array.from(files).forEach(f=>{
    const r = new FileReader();
    r.onload = e => {
      _pbModalImages.push({dataUrl: e.target.result, label: ''});
      pbRenderModalImages();
    };
    r.readAsDataURL(f);
  });
  $('pb-img-input').value='';
}
function pbRenderModalImages() {
  const grid = $('pb-img-grid');
  if (!grid) return;
  grid.innerHTML = _pbModalImages.map((img,i)=>`
    <div style="display:flex;flex-direction:column;gap:4px">
      <div class="trade-img-thumb" onclick="pbLbDirect(${i})" style="position:relative">
        <img src="${img.dataUrl}" style="width:100%;height:100%;object-fit:cover;display:block"/>
        <button class="img-del-btn" onclick="event.stopPropagation();pbRemoveModalImg(${i})">
          <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        </button>
      </div>
      <input
        type="text"
        placeholder="Add label..."
        value="${(img.label||'').replace(/"/g,'&quot;')}"
        oninput="pbSetImgLabel(${i},this.value)"
        onclick="event.stopPropagation()"
        style="width:100%;background:var(--bg4);border:1px solid var(--border2);border-radius:6px;padding:4px 7px;font-size:10px;color:var(--text2);font-family:var(--font-body);outline:none;box-sizing:border-box;transition:border-color .15s"
        onfocus="this.style.borderColor='var(--ac-50)'"
        onblur="this.style.borderColor='var(--border2)'"
      />
    </div>
  `).join('');
}
function pbSetImgLabel(i, val) {
  if (_pbModalImages[i]) _pbModalImages[i].label = val;
}
function pbRemoveModalImg(i) { _pbModalImages.splice(i,1); pbRenderModalImages(); }
function pbLbDirect(i) {
  const img = _pbModalImages[i];
  if (!img) return;
  $('pb-lb-img').src = img.dataUrl;
  const lbl = $('pb-lb-label');
  if (lbl) lbl.textContent = img.label || '';
  $('pb-lb').style.display='flex';
}
function pbLightbox(playIdx, imgIdx) {
  const p = getPbList()[parseInt(playIdx, 10)];
  const ii = parseInt(imgIdx, 10);
  const src = p && p.images && p.images[ii];
  if (!src) return;
  $('pb-lb-img').src = src;
  const lbl = $('pb-lb-label');
  if (lbl) lbl.textContent = (p.imageLabels && p.imageLabels[ii]) || '';
  $('pb-lb').style.display = 'flex';
}
document.addEventListener('keydown', e=>{
  if (e.key==='Escape' && $('pb-lb') && $('pb-lb').style.display!=='none') $('pb-lb').style.display='none';
  if (e.key==='Escape' && $('pb-modal-overlay') && $('pb-modal-overlay').style.display!=='none') closePlaybookModal();
});
// Close pb modal / lightbox on overlay click — stopPropagation prevents bubbling to card
document.addEventListener('click', e=>{
  if (e.target && e.target.id==='pb-modal-overlay') closePlaybookModal();
  if (e.target && e.target.id==='pb-lb') { e.stopPropagation(); $('pb-lb').style.display='none'; }
});
// legacy alias
function openAddPlaybookModal() { openPlaybookModal(); }
function closeAddPlaybookModal() { closePlaybookModal(); }



// ── MODAL ──
// editTradeId already defined at top
function openAddTradeModal() { openModal(); }

function openModal() {
  editTradeId = null;
  $('modal-overlay').classList.add('open');
  document.querySelector('#modal-overlay .modal-title').innerHTML = '<span style="display:flex;align-items:center;gap:7px"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Add New Trade</span>';
  $('f-symbol').value = '';
  $('f-entry').value = '';
  $('f-exit').value = '';
  $('f-size').value = '';
  $('f-sl').value = '';
  $('f-tp').value = '';
  $('f-comm').value = '';
  $('f-setup').value = '';
  $('f-model').value = '';
  $('f-model-label').textContent = 'Select...';
  $('f-model-label').style.color = 'var(--text3)';
  syncModelDropdownFromPlaybooks();
  $$('.mdl-opt').forEach(o=>o.classList.remove('selected'));
  $('f-notes').value = '';
  $('f-account').value = '';
  // Reset custom dropdowns
  ['setup','session','account'].forEach(n=>{
    const lbl=$('f-'+n+'-label');if(lbl){lbl.textContent='Select...';lbl.style.color='var(--text3)';}
    const clr=$('f-'+n+'-clear');if(clr)clr.style.display='none';
    const ch=$('f-'+n+'-chevron');if(ch){ch.style.display='';ch.style.transform='';}
    const dd=$('f-'+n+'-dd');if(dd)dd.style.display='none';
  });
  const now = new Date();
  if(window._fpDate) window._fpDate.setDate(now,true);
  else $('f-date').value = now.toISOString().split('T')[0];
  $('f-date-clear').style.display='block';
  // Set time in 12-hour format display with 24-hour format stored in data attribute
  const timeStr = now.toTimeString().slice(0,5);
  const timeInput = $('f-time');
  timeInput.dataset.time24h = timeStr;
  timeInput.value = format24to12Hour(timeStr);
  $('f-time-clear').style.display='block';
  setDir('long');
  setRating(0);
  // Show screenshot section (hidden when editing)
  const _mis = document.getElementById('modal-img-section');
  if (_mis) _mis.style.display = '';
  $$('[data-active]').forEach(el => { el.dataset.active='0'; el.style.background='transparent'; el.style.color='var(--text2)'; el.style.borderColor='var(--border)'; });
  const pnlDisplay = $('f-pnl-display');
  if (pnlDisplay) { pnlDisplay.textContent = '—'; pnlDisplay.style.color = 'var(--text3)'; }
  $('calc-pnl').textContent = '';
  // Reset staged screenshots
  if (typeof resetModalImgs === 'function') resetModalImgs();
}

function openEditTradeModal() {
  if (!currentDetailTrade) return;
  closeDetail();
  const t = currentDetailTrade;
  editTradeId = t.id;
  $('modal-overlay').classList.add('open');
  document.querySelector('#modal-overlay .modal-title').innerHTML = '<span style="display:flex;align-items:center;gap:7px"><svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg> Edit Trade</span>';
  // Show screenshot upload section when editing trades
  const modalImgSec = document.getElementById('modal-img-section');
  if (modalImgSec) modalImgSec.style.display = 'block';
  $('f-symbol').value = t.symbol;
  $('f-date').value = t.date;
  // Store 24-hour format as data attribute and display 12-hour format
  const timeInput = $('f-time');
  timeInput.dataset.time24h = t.time;
  timeInput.value = format24to12Hour(t.time);
  $('f-entry').value = formatPrice(t.symbol, t.entry);
  $('f-exit').value  = formatPrice(t.symbol, t.exit);
  $('f-size').value  = t.size > 0 ? t.size : '';
  $('f-sl').value    = t.sl ? formatPrice(t.symbol, t.sl) : '';
  $('f-tp').value    = t.tp ? formatPrice(t.symbol, t.tp) : '';
  $('f-comm').value = t.comm;
  $('f-setup').value = t.setup || '';
  $('f-model').value = t.model || '';
  const ml = $('f-model-label');
  if(ml){ ml.textContent = t.model || 'Select model...'; ml.style.color = t.model ? 'var(--text)' : 'var(--text3)'; }
  syncModelDropdownFromPlaybooks();
  $$('.mdl-opt').forEach(o=>o.classList.toggle('selected', o.textContent===t.model));
  $('f-notes').value = t.notes || '';
  $('f-account').value = t.account || '';
  setDir(t.dir);
  setRating(t.rating || 0);
  // Reset emotions then re-activate matching ones
  $$('[data-active]').forEach(el => { el.dataset.active='0'; el.style.background='transparent'; el.style.color='var(--text2)'; el.style.borderColor='var(--border)'; });
  if (t.emotions) {
    $$('[data-active]').forEach(el => {
      if (t.emotions.includes(el.textContent.trim())) {
        el.dataset.active='1'; el.style.background='var(--bg5)'; el.style.color='var(--text)'; el.style.borderColor='var(--border2)';
      }
    });
  }
  // Load existing images from the trade when editing
  if (typeof loadTradeImages === 'function' && typeof renderModalImgThumbs === 'function') {
    const existingImgs = loadTradeImages(t.id);
    _modalImgQueue = (existingImgs || []).map(img => ({ dataUrl: img.data, label: img.label || '' }));
    renderModalImgThumbs();
  }
  calcPnl();
}

function closeModal() {
  $('modal-overlay').classList.remove('open');
  // Discard any staged screenshots if modal was cancelled
  if (typeof resetModalImgs === 'function') resetModalImgs();
}

function closeModalOutside(e) {
  if(e.target === $('modal-overlay')) closeModal();
}

function setDir(d) {
  currentDir = d;
  $('dir-long').className = `dir-opt ${d==='long'?'long-active':''}`;
  $('dir-short').className = `dir-opt ${d==='short'?'short-active':''}`;
  calcPnl();
}

function setRating(n) {
  selectedRating = n;
  $$('.star').forEach((s,i)=>s.classList.toggle('lit',i<n));
}

function toggleEmo(el) {
  const on = el.style.background !== 'transparent' && el.dataset.active === '1';
  if(el.dataset.active === '1') {
    el.dataset.active = '0';
    el.style.background = 'transparent';
    el.style.color = 'var(--text2)';
    el.style.borderColor = 'var(--border)';
  } else {
    el.dataset.active = '1';
    el.style.background = 'var(--bg5)';
    el.style.color = 'var(--text)';
    el.style.borderColor = 'var(--border2)';
  }
}

/* ── INSTRUMENT P&L ENGINE ── */
function getInstrumentInfo(symbol) {
  const s = (symbol || '').toUpperCase().replace('/', '').replace('-', '').replace('_', '');

  // JPY pairs — pip = 0.01, std lot pip value = $9.xx (approx $10 for simplicity)
  if (/[A-Z]{3}JPY/.test(s) || s.endsWith('JPY')) {
    return { type: 'FOREX', pipSize: 0.01, pipValue: 10, label: 'Forex (JPY pair)' };
  }
  // Gold XAU/USD — retail standard: pipSize=0.01, pipValue=$1/pip per lot
  // 1 lot, 9.50 point move = 950 pips × $1 = $950
  if (s.includes('XAU') || s.includes('GOLD')) {
    return { type: 'METAL', pipSize: 0.01, pipValue: 1, label: 'Gold (XAU/USD)' };
  }
  // Silver XAG/USD — pipSize=0.001, pipValue=$0.50/pip per lot
  if (s.includes('XAG') || s.includes('SILVER')) {
    return { type: 'METAL', pipSize: 0.001, pipValue: 0.5, label: 'Silver (XAG/USD)' };
  }
  // Oil (WTI/BRENT) — pipSize=0.01, pipValue=$1/pip per lot
  if (s.includes('WTI') || s.includes('OIL') || s.includes('BRENT') || s.includes('USOIL')) {
    return { type: 'COMMODITY', pipSize: 0.01, pipValue: 1, label: 'Oil' };
  }
  // Major crypto — price in USD, P&L = diff × size (no pip conversion needed)
  if (/BTC|ETH|SOL|BNB|XRP|ADA|DOGE|AVAX|MATIC|DOT/.test(s)) {
    return { type: 'CRYPTO', pipSize: null, pipValue: null, label: 'Crypto' };
  }
  // Indices / US stocks (no slash in symbol, not a known forex pair)
  if (!s.match(/^[A-Z]{6}$/)) {
    return { type: 'STOCK', pipSize: null, pipValue: null, label: 'Stock / Index' };
  }
  // Standard forex pair (6 chars like EURUSD, GBPUSD, AUDUSD etc.)
  return { type: 'FOREX', pipSize: 0.0001, pipValue: 10, label: 'Forex (standard)' };
}

function getAccountLeverage(accountName, instrumentType) {
  if (!accountName || !ACCOUNTS) return 1;
  
  const account = ACCOUNTS.find(a => (a.key || a.phase) === accountName);
  if (!account || !account.leverage) return 1;
  
  // Map instrument type to leverage field
  const leverageMap = {
    'FOREX': 'forex',
    'COMMODITY': 'metals',
    'METAL': 'metals',
    'CRYPTO': 'crypto',
    'STOCK': 'indices',
    'FUTURES': 'futures',
    'EQUITY': 'indices',
    'INDEX': 'indices'
  };
  
  const leverageKey = leverageMap[instrumentType] || 'forex';
  const leverage = account.leverage[leverageKey];
  
  return leverage && leverage > 0 ? leverage : 1;
}

function calcGross(entry, exit, size, dir, symbol, accountName) {
  const info = getInstrumentInfo(symbol);
  const priceDiff = dir === 'long' ? (exit - entry) : (entry - exit);
  
  // Get leverage for this account and instrument
  const leverage = getAccountLeverage(accountName, info.type);
  
  let gross;
  if (info.type === 'FOREX' || info.type === 'METAL' || info.type === 'COMMODITY') {
    // pips = priceDiff / pipSize, then × pipValue × lots
    const pips = priceDiff / info.pipSize;
    gross = pips * info.pipValue * size;
  } else {
    // CRYPTO / STOCK / FUTURES / EQUITY: straightforward price diff × size
    gross = priceDiff * size;
  }
  
  return gross;
}

function calcPnl() {
  const sym    = ($('f-symbol') ? $('f-symbol').value : '') || '';
  const entry  = parseFloat($('f-entry').value) || 0;
  const exit   = parseFloat($('f-exit').value)  || 0;
  const size   = parseFloat($('f-size').value);
  const comm   = parseFloat($('f-comm').value)  || 0;
  const el     = $('calc-pnl');
  const display = $('f-pnl-display');
  const accountName = $('f-account').value || '';

  if (!entry || !exit || !size || size <= 0) {
    if (display) { display.textContent = '—'; display.style.color = 'var(--text3)'; }
    if (el) el.textContent = '';
    return;
  }

  const gross = calcGross(entry, exit, size, currentDir, sym, accountName);
  const net   = gross - comm;
  const info  = getInstrumentInfo(sym);
  const leverage = getAccountLeverage(accountName, info.type);
  const leverageStr = leverage > 1 ? ` · ${leverage}:1 leverage` : ' · no leverage';

  if (display) {
    display.textContent = (net >= 0 ? '+$' : '-$') + Math.abs(net).toFixed(2);
    display.style.color = net >= 0 ? 'var(--green)' : 'var(--red)';
  }
  if (el) {
    el.textContent = info.label + leverageStr;
    el.style.color = net >= 0 ? 'var(--green)' : 'var(--red)';
  }
}

['f-entry','f-exit','f-comm','f-symbol','f-size'].forEach(id => {
  const el = $(id);
  if(el) el.addEventListener('input', () => { calcPnl(); });
});



// Guard flags to prevent multiple simultaneous/rapid saveTrade calls
let _saveTradeInProgress = false;
let _lastSaveAttemptTime = 0;
const _SAVE_DEBOUNCE_MS = 500; // Prevent rapid successive calls

function saveTrade() {
  // Prevent re-entrancy — reject if already saving
  if (_saveTradeInProgress) {
    console.warn('saveTrade already in progress, ignoring duplicate call');
    return;
  }
  
  // Debounce rapid successive calls (e.g., pressing Enter multiple times)
  const now = Date.now();
  if (now - _lastSaveAttemptTime < _SAVE_DEBOUNCE_MS) {
    console.warn('saveTrade called too rapidly, ignoring');
    return;
  }
  _lastSaveAttemptTime = now;
  
  _saveTradeInProgress = true;
  
  // Always reset flag after short delay to prevent stuck state
  const resetFlagTimeout = setTimeout(() => {
    _saveTradeInProgress = false;
  }, 5000);
  
  try {
    // ── FORM VALIDATION ──
    const sym = $('f-symbol').value.trim();
    const entry = parseFloat($('f-entry').value)||0;
    const exit  = parseFloat($('f-exit').value)||0;
    const size  = Math.abs(parseFloat($('f-size').value))||0;
    const dateVal = $('f-date').value;
    // Get time value - prefer 24-hour format from data attribute if available
    const timeInput = $('f-time');
    const timeVal = (timeInput.dataset && timeInput.dataset.time24h) ? timeInput.dataset.time24h : timeInput.value;
  
    // Symbol/price sanity check — warn but don't block
    const _symUpper = sym.toUpperCase();
    const _isForex = _symUpper.includes('/') || ['EURUSD','GBPUSD','USDJPY','AUDUSD','USDCAD','USDCHF','NZDUSD','XAUUSD','XAGUSD'].some(s => _symUpper === s || _symUpper === s.replace('/',''));
    const _isFutures = ['NQ','ES','YM','MNQ','MES','MYM','RTY','CL','GC','SI','ZB','ZN','6E','6J'].some(s => _symUpper === s || _symUpper.startsWith(s));
    if (_isForex && entry > 500) {
      try {
        if (typeof showToast === 'function') {
          showToast('Heads up: entry price looks high for a forex pair — double-check your decimal', 'info', '⚠️', 4000);
        }
      } catch(e) {
        console.warn('Error showing forex sanity check:', e);
      }
    }
    if (_isFutures && entry < 10 && entry > 0) {
      try {
        if (typeof showToast === 'function') {
          showToast('Heads up: entry price looks low for a futures contract — double-check your value', 'info', '⚠️', 4000);
        }
      } catch(e) {
        console.warn('Error showing futures sanity check:', e);
      }
    }

    // Validation checks — STRICT: must have essential fields
    const acctVal = $('f-account').value || '';  // Capture account BEFORE validation
    const errors = [];
    if (!sym) errors.push('Symbol (Pair) is required');
    if (entry <= 0) errors.push('Entry price must be greater than 0');
    if (exit <= 0) errors.push('Exit price must be greater than 0');
    if (size <= 0) errors.push('Position size (Lot) is required');
    if (!acctVal) errors.push('Account is required');
    if (entry === exit) errors.push('Entry and exit prices cannot be the same');
    
    // ABORT IMMEDIATELY if validation fails — do NOT proceed with save
    if (errors.length > 0) {
      clearTimeout(resetFlagTimeout);
      _saveTradeInProgress = false;
      
      // Show all validation errors without complex async logic
      const fieldMap = {
        'Symbol (Pair) is required':                'f-symbol',
        'Entry price must be greater than 0':       'f-entry',
        'Exit price must be greater than 0':        'f-exit',
        'Position size (Lot) is required':          'f-size',
        'Account is required':                      'f-account',
        'Entry and exit prices cannot be the same': 'f-entry',
      };
      
      // Highlight all invalid fields
      Object.entries(fieldMap).forEach(([err, fid]) => {
        if (errors.includes(err)) {
          try {
            const el = $(fid);
            if (el && el.style) {
              el.style.borderColor = 'var(--red)';
              el.style.boxShadow = '0 0 0 2px rgba(232,80,74,.25)';
            }
          } catch(e) {}
        }
      });
      
      // Display error toasts directly without setTimeout
      errors.slice(0, 5).forEach((err) => {
        try {
          if (typeof showToast === 'function') {
            showToast(err, 'error', '⚡', 3000);
          }
        } catch(e) {
          console.warn('Error showing toast:', e);
        }
      });
      
      // CRITICAL: Return immediately without touching TRADES, rendering, or localStorage
      return;
    }
    
    clearTimeout(resetFlagTimeout);

    // ── BREACHED ACCOUNT WARNING (new trades only) ──
    if (editTradeId === null) {
      const _warnAcct = ACCOUNTS.find(a => (a.key || a.phase) === acctVal || (a.firm + ' - ' + (a.key || a.phase)) === acctVal);
      if (_warnAcct) {
        const _warnTrades = TRADES.filter(t => (t.account || '') === acctVal);
        const _warnNetPnl = _warnTrades.reduce((s, t) => s + (t.pnl || 0), 0);
        const _warnMl = (_warnAcct.startBal || 0) * ((_warnAcct.maxDrawdown || 8) / 100);
        const _warnDl = (_warnAcct.startBal || 0) * ((_warnAcct.dailyLoss || 4) / 100);
        const _warnPt = (_warnAcct.startBal || 0) * ((_warnAcct.profitTarget || 0) / 100);
        const _warnDayMap = {};
        _warnTrades.forEach(t => { _warnDayMap[t.date] = (_warnDayMap[t.date] || 0) + t.pnl; });
        const _warnWorstDay = Math.min(0, ...Object.values(_warnDayMap).concat([0]));
        const _isBreached = _warnNetPnl <= -_warnMl || Math.abs(_warnWorstDay) >= _warnDl;
        const _isPassed = _warnAcct.profitTarget > 0 && _warnNetPnl >= _warnPt;
        
        if (_isBreached) {
          _saveTradeInProgress = false;
          showConfirmModal(
            '⚠️ Account Already Breached',
            `<strong>${_warnAcct.firm}</strong> has already breached its risk rules.<br><br>Adding trades to a breached account won't change its status. Do you still want to save this trade?`,
            'Save Anyway',
            'Cancel',
            'danger',
            function() {
              // User confirmed — proceed with save
              _proceedSaveTrade(acctVal);
            }
          );
          return;
        } else if (_isPassed) {
          _saveTradeInProgress = false;
          showToast('✓ Challenge already passed — this account has reached its profit target', 'info', '✓', 3000);
          setTimeout(() => {
            _proceedSaveTrade(acctVal);
          }, 100);
          return;
        }
      }
    }
    _proceedSaveTrade(acctVal);
    return; // _proceedSaveTrade handles the rest
  } catch(e) {
    clearTimeout(resetFlagTimeout);
    _saveTradeInProgress = false;
    console.error('saveTrade error:', e);
    try { showToast('Error saving trade: ' + (e.message || 'Check console'), 'error', '⚠️', 3500); } catch(te) {}
  }
}

function _proceedSaveTrade(acctVal) {
  // Re-read all form values (modal still open)
  const sym = $('f-symbol').value.trim();
  const entry = parseFloat($('f-entry').value)||0;
  const exit  = parseFloat($('f-exit').value)||0;
  const size  = Math.abs(parseFloat($('f-size').value))||0;
  const timeInput = $('f-time');

    const comm  = parseFloat($('f-comm').value)||0;
    const accountName = acctVal;  // Use the already-validated account value
    
    const gross = calcGross(entry, exit, size, currentDir, sym, accountName);
    const pnlVal = gross - comm;
    const emotions = [...$$('[data-active="1"]')].map(el => el.textContent.trim());
    
    // Get proper time value for storage (24-hour format)
    const storedTime = (timeInput.dataset && timeInput.dataset.time24h) ? timeInput.dataset.time24h : timeVal;

    if (editTradeId !== null) {
      // Edit existing trade
      const idx = TRADES.findIndex(t => t.id === editTradeId);
      if (idx !== -1) {
        TRADES[idx] = { ...TRADES[idx],
          date: $('f-date').value,
          time: storedTime,
          symbol: sym.toUpperCase(),
          dir: currentDir,
          entry, exit, size,
          sl: parseFloat($('f-sl').value)||null,
          tp: parseFloat($('f-tp').value)||null,
          comm,
          setup: $('f-setup').value || 'Custom',
          model: $('f-model').value || '',
          session: $('f-session').value || TRADES[idx].session,
          account: $('f-account').value || TRADES[idx].account || '',
          rating: selectedRating,
          notes: $('f-notes').value,
          emotions,
          pnl: pnlVal
        };
        // Save any modal images for the edited trade
        if (_modalImgQueue && _modalImgQueue.length > 0) {
          const imgs = _modalImgQueue.map(item => ({
            id: Date.now() + Math.random(),
            label: item.label || '',
            data: item.dataUrl
          }));
          if (typeof saveTradeImages === 'function') {
            saveTradeImages(editTradeId, imgs);
          }
          _modalImgQueue = [];
          renderModalImgThumbs();
        }
        currentDetailTrade = TRADES[idx];
        showDetail(TRADES[idx], document.querySelector('.selected-row') || document.createElement('tr'));
      }
      editTradeId = null;
    } else {
      // Add new trade - use max ID + 1 to avoid conflicts
      const maxId = TRADES.length > 0 ? Math.max(...TRADES.map(t => t.id)) : 0;
      const newTrade = {
        id: maxId + 1,
        date: $('f-date').value,
        time: storedTime,
        symbol: sym.toUpperCase(),
        type: 'Futures',
        dir: currentDir,
        entry, exit, size,
        sl: parseFloat($('f-sl').value)||null,
        tp: parseFloat($('f-tp').value)||null,
        comm,
        setup: $('f-setup').value || 'Custom',
        model: $('f-model').value || '',
        session: $('f-session').value,
        account: $('f-account').value || '',
        rating: selectedRating,
        notes: $('f-notes').value,
        emotions,
        pnl: pnlVal
      };
      TRADES.unshift(newTrade);
      // Attach any staged modal screenshots to the new trade
      if (_modalImgQueue && _modalImgQueue.length > 0) {
        const imgs = _modalImgQueue.map(item => ({
          id: Date.now() + Math.random(),
          label: item.label || '',
          data: item.dataUrl
        }));
        saveTradeImages(newTrade.id, imgs);
        _modalImgQueue = [];
        renderModalImgThumbs();
      }
    }
    
    // Save to localStorage
    saveTradesToStorage();
    
    // Check if account profit target reached and auto-create next phase
    checkAndCreateNextPhase(accountName);
    
    filteredTrades = [...TRADES];
    renderTrades(filteredTrades);
    populateDashboard();
    refreshAdvAnalytics();
    
    // Refresh Daily P&L chart
    if (dailyPnlChartInstance) {
      initDailyPnlChart();
    }
    
    closeModal();
    // Flash feedback
    const btn = document.querySelector('.add-trade-btn');
    if (btn) {
      btn.textContent = 'Saved!';
      btn.style.background = 'var(--green)';
      setTimeout(()=>{ 
        if (btn) {
          btn.innerHTML = '＋ Add Trade'; 
          btn.style.background = 'var(--purple)';
        }
      }, 1800);
    }
    
    _saveTradeInProgress = false; // Reset flag after successful save
}

let sortCol = null;
let sortState = 0; // 0=none, 1=asc, 2=desc

function sortTable(th) {
  const col = th.dataset.col;
  const allTh = $$('#trade-table thead th');

  if (sortCol === col) {
    sortState = (sortState + 1) % 3;
  } else {
    sortCol = col;
    sortState = 1;
  }

  // Reset all headers
  allTh.forEach(h => {
    h.classList.remove('sort-asc', 'sort-desc');
    h.querySelector('.sort-arrow').textContent = '↕';
  });

  if (sortState === 0) {
    sortCol = null;
    applyFilters();
    return;
  }

  th.classList.add(sortState === 1 ? 'sort-asc' : 'sort-desc');
  th.querySelector('.sort-arrow').textContent = sortState === 1 ? '↑' : '↓';

  const asc = sortState === 1;
  const sorted = [...filteredTrades].sort((a, b) => {
    let av, bv;
    if (col === 'pnl')    { av = a.pnl;   bv = b.pnl; }
    else if (col === 'entry') { av = a.entry; bv = b.entry; }
    else if (col === 'exit')  { av = a.exit;  bv = b.exit; }
    else if (col === 'size')  { av = a.size;  bv = b.size; }
    else if (col === 'rmult') { av = a.pnl / (Math.abs(a.entry - a.sl) * a.size || 1); bv = b.pnl / (Math.abs(b.entry - b.sl) * b.size || 1); }
    else if (col === 'date')  { return asc ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date); }
    else if (col === 'symbol'){ return asc ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol); }
    else if (col === 'dir')   { return asc ? a.dir.localeCompare(b.dir) : b.dir.localeCompare(a.dir); }
    else if (col === 'result'){ av = a.pnl >= 0 ? 1 : 0; bv = b.pnl >= 0 ? 1 : 0; }
    else return 0;
    return asc ? av - bv : bv - av;
  });
  currentPage = 1;
  renderTrades(sorted);
}

// ── ACCOUNT DROPDOWN ──
// ── Hardcoded accounts have been REMOVED ──
// Application now loads all accounts from Supabase backend only
const DEFAULT_ACCOUNTS = []; // No hardcoded accounts — loads from Supabase

function loadAccounts() {
  // IMPORTANT: Clear any old hardcoded account data on first load
  const migrationKey = 'accounts_v3_cleaned';
  if (!localStorage.getItem(migrationKey)) {
    // First time after cleanup - clear old demo accounts
    const stored = localStorage.getItem('equityTraceAccounts');
    if (stored) {
      try {
        const accounts = JSON.parse(stored);
        // If any of the old demo accounts exist, wipe the cache
        const oldAccountNames = ['FTM Prop Firm - Phase 2', 'FTM Prop Firm - Phase 1', 'Apex Trader - Eval', 'GOAT'];
        if (accounts.some(a => oldAccountNames.includes(a.key) || oldAccountNames.includes(a.phase))) {
          console.warn('Old demo accounts detected - clearing cache...');
          localStorage.removeItem('equityTraceAccounts');
          localStorage.removeItem(migrationKey);
          return [];
        }
      } catch(e) {}
    }
    localStorage.setItem(migrationKey, '1');
  }

  try {
    const stored = localStorage.getItem('equityTraceAccounts');
    if (stored) {
      let loaded = JSON.parse(stored);
      if (loaded && Array.isArray(loaded) && loaded.length > 0) {
        // Normalize old account names
        loaded = loaded.map(a => {
          if (!a.key && !a.phase) return a;
          // Normalize old account names to new standard
          const normalize = (str) => {
            if (!str) return str;
            return str
              .replace(/Goat Funded Trader/i, 'GOAT')  // Normalize old name to GOAT
              .replace(/Goat Funded Trader.*Goat Funded Trader/i, 'GOAT');  // Remove duplicates first
          };
          a.key = normalize(a.key);
          a.phase = normalize(a.phase);
          
          // Clean up Funded accounts - remove "Phase X" or "- Funded" suffix and normalize
          if (a.challengeType === 'Funded' || a.phase.includes('Funded')) {
            // Strip Phase X suffix
            a.phase = a.phase.replace(/\s*-\s*Phase\s*\d+\s*$/i, '').trim();
            a.firm = a.firm.replace(/\s*-\s*Phase\s*\d+\s*$/i, '').trim();
            // Remove '- Funded' suffix if present, just keep firm name
            a.phase = a.phase.replace(/\s*-\s*Funded\s*$/i, '').trim();
            a.key = a.phase;
            if (!a.challengeType) a.challengeType = 'Funded';
          }
          
          return a;
        });
        return loaded;
      }
    }
  } catch(e) {
    console.warn('Error loading accounts:', e);
  }
  // Fallback to defaults
  return DEFAULT_ACCOUNTS.map(a => ({...a}));
}

function saveAccounts() {
  try { localStorage.setItem('equityTraceAccounts', JSON.stringify(ACCOUNTS)); } catch(e) {}
  // Sync to Supabase if signed in
  if (window.SB) {
    window.SB.getUser().then(user => {
      if (user) window.SB.saveAllAccounts(ACCOUNTS).catch(e => console.warn('SB sync accounts:', e));
    });
  }
}

const ACCOUNTS = loadAccounts();
saveAccounts();  // Ensure any loaded/cleaned data is saved back
let acctOpen = false;
// selectedAcct already defined at top of file
function getDashboardTrades() {
  if (selectedAcct === -1) return TRADES;
  const a = ACCOUNTS[selectedAcct];
  if (!a) return TRADES;
  const acctName = a.key || a.phase;
  return TRADES.filter(t => (t.account || '') === acctName);
}

// ══════════════════════════════════════════════
//  PROP FIRM LOGO UTILITY
// ══════════════════════════════════════════════
const PROP_FIRM_DOMAINS = {
  // FTM / Funded Trader Markets
  'ftm':                    'fundedtradermarkets.com',
  'funded trader markets':  'fundedtradermarkets.com',
  'ftm prop firm':          'fundedtradermarkets.com',
  // Apex
  'apex':                   'apextraderfunding.com',
  'apex trader':            'apextraderfunding.com',
  'apex trader funding':    'apextraderfunding.com',
  // FTMO
  'ftmo':                   'ftmo.com',
  // The Funded Trader
  'the funded trader':      'thefundedtraderprogram.com',
  'funded trader':          'thefundedtraderprogram.com',
  // MyFundedFutures
  'myfundedfutures':        'myfundedfutures.com',
  'my funded futures':      'myfundedfutures.com',
  // Topstep
  'topstep':                'topstep.com',
  // GOAT
  'goat':                   'goatfunded.com',
  'goat funded':            'goatfunded.com',
  // MyForexFunds
  'myforexfunds':           'myforexfunds.com',
  'my forex funds':         'myforexfunds.com',
  // The 5%ers
  '5%ers':                  'the5ers.com',
  'the 5ers':               'the5ers.com',
  'the 5%ers':              'the5ers.com',
  // Funder Trading
  'funder trading':         'fundertrading.com',
  // E8 Funding
  'e8':                     'e8funding.com',
  'e8 funding':             'e8funding.com',
  // Prop Firm Match
  'prop firm match':        'propfirmmatch.com',
  // Lux Trading
  'lux trading':            'luxtradingfirm.com',
  'lux':                    'luxtradingfirm.com',
  // FundedNext
  'fundednext':             'fundednext.com',
  'funded next':            'fundednext.com',
  // TraderSync / SurgeTrader
  'surgetrader':            'surgetrader.com',
  // BluEdge
  'bluedge':                'bluedgepro.com',
  // Alpha Capital
  'alpha capital':          'alphacapitalgroup.uk',
  // Finotive Funding
  'finotive':               'finotivefunding.com',
  'finotive funding':       'finotivefunding.com',
  // Nordic Funder
  'nordic funder':          'nordicfunder.com',
  // True Forex Funds
  'true forex funds':       'trueforexfunds.com',
  'tff':                    'trueforexfunds.com',
  // City Traders Imperium
  'city traders imperium':  'citytraders.com',
  'cti':                    'citytraders.com',
  // Audacity Capital
  'audacity capital':       'audacitycapital.co.uk',
  // Ment Funding
  'ment funding':           'mentfunding.com',
  // Crypto Fund Trader
  'crypto fund trader':     'cryptofundtrader.com',
  // WF Funded
  'wf funded':              'wffunded.com',
  // Instant Funding
  'instant funding':        'instantfunding.io',
};

const _firmLogoCache = {};

function getFirmLogo(firmName) {
  if (!firmName) return null;
  const key = firmName.toLowerCase().trim();
  if (_firmLogoCache[key] !== undefined) return _firmLogoCache[key];
  // Exact match first
  if (PROP_FIRM_DOMAINS[key]) {
    const url = `https://www.google.com/s2/favicons?domain=${PROP_FIRM_DOMAINS[key]}&sz=64`;
    _firmLogoCache[key] = url;
    return url;
  }
  // Partial match — check if any known key is contained in firmName
  for (const [k, domain] of Object.entries(PROP_FIRM_DOMAINS)) {
    if (key.includes(k) || k.includes(key)) {
      const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
      _firmLogoCache[key] = url;
      return url;
    }
  }
  // No match — try to guess domain from firm name: "Blue Sky Funding" → "blueskyfunding.com"
  const guessed = key.replace(/[^a-z0-9]+/g, '').replace(/funding$|funded$|trader$|trading$|capital$|markets$|futures$|forex$|prop$/, '') + '.com';
  if (guessed.length > 4) {
    const url = `https://www.google.com/s2/favicons?domain=${guessed}&sz=64`;
    _firmLogoCache[key] = url;
    return url;
  }
  _firmLogoCache[key] = null;
  return null;
}

// Global handler — called from img onerror, no inline template literals needed
window._firmLogoFallback = function(img) {
  var p = img.parentElement;
  if (!p) return;
  var g = p.getAttribute('data-grad') || '#6b1fd4,#4d8ef0';
  var s = parseInt(p.getAttribute('data-size') || '36', 10);
  var r = parseInt(p.getAttribute('data-radius') || '9', 10);
  var l = p.getAttribute('data-letter') || '?';
  var fs = Math.round(s * 0.45);
  var el = document.createElement('div');
  el.style.cssText = 'width:' + s + 'px;height:' + s + 'px;border-radius:' + r + 'px;'
    + 'background:linear-gradient(135deg,' + g + ');display:flex;align-items:center;'
    + 'justify-content:center;font-size:' + fs + 'px;font-weight:700;color:#fff;'
    + 'font-family:var(--font-display);flex-shrink:0';
  el.textContent = l;
  if (p.parentElement) p.parentElement.replaceChild(el, p);
};

function firmLogoHTML(firmName, size, radius) {
  size   = size   === undefined ? 36 : size;
  radius = radius === undefined ? 9  : radius;
  const logoUrl = getFirmLogo(firmName);
  const letter  = (firmName || '?').charAt(0).toUpperCase();
  const gradients = [
    '#6b1fd4,#4d8ef0', '#e8504a,#f5a623', '#2ecc8a,#4d8ef0',
    '#f5a623,#e8504a', '#4d8ef0,#2ecc8a',
  ];
  const grad     = gradients[letter.charCodeAt(0) % gradients.length];
  const fontSize = Math.round(size * 0.45);
  const baseStyle = 'width:' + size + 'px;height:' + size + 'px;border-radius:' + radius + 'px;';
  if (!logoUrl) {
    return '<div style="' + baseStyle
      + 'background:linear-gradient(135deg,' + grad + ');display:flex;align-items:center;'
      + 'justify-content:center;font-size:' + fontSize + 'px;font-weight:700;color:#fff;'
      + 'font-family:var(--font-display);flex-shrink:0">' + letter + '</div>';
  }
  // onerror calls a named global function — zero nesting issues
  return '<div style="' + baseStyle
    + 'background:var(--bg4);border:1px solid var(--border);overflow:hidden;flex-shrink:0;'
    + 'display:flex;align-items:center;justify-content:center"'
    + ' data-grad="' + grad + '" data-size="' + size + '" data-radius="' + radius + '" data-letter="' + letter + '">'
    + '<img src="' + logoUrl + '" alt="' + letter + '"'
    + ' style="width:100%;height:100%;object-fit:contain;padding:3px"'
    + ' onerror="_firmLogoFallback(this)">'
    + '</div>';
}


function renderAllAccountsSection() {
  const wrap = $('all-accounts-cards');
  if (!wrap) return;

  const fmt = v => '$' + Math.abs(v).toFixed(2);
  const fmtK = v => {
    const abs = Math.abs(v);
    return '$' + abs.toFixed(2);
  };

  const statusMeta = {
    active:   { label:'Active',   icon:'<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--green)"></span>', color:'var(--green)',  bg:'rgba(46,204,138,.08)',  border:'rgba(46,204,138,.25)' },
    passed:   { label:'Passed',   icon:'✓', color:'var(--blue)',   bg:'rgba(77,142,240,.08)',   border:'rgba(77,142,240,.25)'  },
    breached: { label:'Breached', icon:'<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--red)"></span>', color:'var(--red)',    bg:'rgba(232,80,74,.08)',    border:'rgba(232,80,74,.25)'   },
  };

  wrap.innerHTML = ACCOUNTS.map(a => {
    const acctName = a.key || a.phase;
    const acctTrades = TRADES.filter(t => (t.account || '') === acctName);
    const netPnl = acctTrades.reduce((s,t) => s+t.pnl, 0);
    const equity = a.startBal + netPnl;
    const pnlPct = ((netPnl / a.startBal) * 100).toFixed(2);
    const wins = acctTrades.filter(t => t.pnl > 0).length;
    const wr = acctTrades.length ? ((wins/acctTrades.length)*100).toFixed(0) : 0;

    // ── Rule calculations ──
    const maxLossLimit  = a.startBal * (a.maxDrawdown / 100);
    const dailyLossLimit = a.startBal * (a.dailyLoss / 100);
    const profitLimit   = a.startBal * (a.profitTarget / 100);

    // Max drawdown: largest drop from starting balance
    const lostSoFar = Math.max(0, -(netPnl));
    const maxLossPct = Math.min(100, (lostSoFar / maxLossLimit) * 100).toFixed(0);

    // Daily loss: worst single day's P&L
    const dayMap = {};
    acctTrades.forEach(t => { dayMap[t.date] = (dayMap[t.date] || 0) + t.pnl; });
    const worstDay = Math.min(0, ...Object.values(dayMap).concat([0]));
    const dailyLostPct = Math.min(100, (Math.abs(worstDay) / dailyLossLimit) * 100).toFixed(0);

    const profitPct = Math.min(100, (Math.max(0, netPnl) / profitLimit) * 100).toFixed(0);

    // ── Compute status dynamically ──
    let computedStatus = 'active';
    let breachReason = '';
    if (netPnl <= -maxLossLimit) {
      computedStatus = 'breached'; breachReason = 'Max drawdown hit';
    } else if (Math.abs(worstDay) >= dailyLossLimit) {
      computedStatus = 'breached'; breachReason = 'Daily loss limit hit';
    } else if (a.profitTarget > 0 && netPnl >= profitLimit) {
      computedStatus = 'passed';
    }

    const sm = statusMeta[computedStatus];
    const pnlColor = netPnl >= 0 ? 'var(--green)' : 'var(--red)';
    const pnlSign = netPnl >= 0 ? '+' : '-';
    const statusLabel = breachReason ? `BREACHED` : sm.label.toUpperCase();
    const statusTitle = breachReason || sm.label;

    return `
    <div class="acct-status-card status-${computedStatus}" style="position:relative">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
        <!-- Three-dot menu -->
        <div style="position:absolute;top:12px;right:4px;z-index:10">
          <button onclick="toggleAcctCardMenu(event,${a.id},'acct-card-menu-${a.id}')" style="background:transparent;border:none;cursor:pointer;color:var(--text2);width:24px;height:24px;border-radius:5px;display:flex;align-items:center;justify-content:center;transition:all .15s" onmouseenter="this.style.background='var(--bg4)';this.style.color='var(--text)'" onmouseleave="this.style.background='transparent';this.style.color='var(--text2)'">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="2" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="8" cy="14" r="1.5"/></svg>
          </button>
          <div id="acct-card-menu-${a.id}" style="display:none;position:absolute;top:28px;right:0;background:var(--bg2);border:1px solid var(--border2);border-radius:10px;padding:5px;min-width:150px;z-index:500;box-shadow:0 8px 32px rgba(0,0,0,.5)">
            <button onclick="openEditAccountModal(${a.id})" style="width:100%;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:7px;background:transparent;border:none;color:var(--text);font-size:12.5px;font-family:var(--font-body);cursor:pointer;transition:background .12s;text-align:left" onmouseenter="this.style.background='var(--bg4)'" onmouseleave="this.style.background='transparent'">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>
              Edit Account
            </button>
            <div style="height:1px;background:var(--border);margin:3px 5px"></div>
            <button onclick="confirmDeleteAccount(${a.id})" style="width:100%;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:7px;background:transparent;border:none;color:var(--red);font-size:12.5px;font-family:var(--font-body);cursor:pointer;transition:background .12s;text-align:left" onmouseenter="this.style.background='rgba(232,80,74,.08)'" onmouseleave="this.style.background='transparent'">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
              Delete Account
            </button>
          </div>
        </div>
        <!-- Left: identity -->
        <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0">
          <div style="flex-shrink:0">${firmLogoHTML(a.firm, 42, 10)}</div>
          <div style="min-width:0">
            <div style="font-family:var(--font-display);font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.firm}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:3px">
              <span style="background:var(--ac-12);color:#a97de8;border:1px solid var(--ac-30);padding:1px 6px;border-radius:4px;font-size:9px;font-family:var(--font-mono);font-weight:500">${a.phase}</span>
              <span title="${statusTitle}" style="background:${sm.bg};color:${sm.color};border:1px solid ${sm.border};padding:1px 6px;border-radius:4px;font-size:9px;font-family:var(--font-mono);font-weight:600;cursor:default">${statusLabel}</span>
            </div>
          </div>
        </div>
        <!-- Right: P&L -->
        <div style="text-align:right;flex-shrink:0">
          <div style="font-family:var(--font-display);font-weight:700;font-size:22px;color:${pnlColor};line-height:1">${pnlSign}${fmt(Math.abs(netPnl))}</div>
          <div style="font-family:var(--font-mono);font-size:10px;color:${pnlColor};margin-top:2px;opacity:.8">${pnlSign}${Math.abs(pnlPct)}%</div>
        </div>
      </div>

      <!-- Stats row -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
        <div>
          <div style="font-size:9px;color:var(--text3);font-family:var(--font-mono);letter-spacing:.06em;text-transform:uppercase;margin-bottom:3px">Equity</div>
          <div class="sec-title">${fmtK(equity)}</div>
        </div>
        <div>
          <div style="font-size:9px;color:var(--text3);font-family:var(--font-mono);letter-spacing:.06em;text-transform:uppercase;margin-bottom:3px">Trades</div>
          <div class="sec-title">${acctTrades.length}</div>
        </div>
        <div>
          <div style="font-size:9px;color:var(--text3);font-family:var(--font-mono);letter-spacing:.06em;text-transform:uppercase;margin-bottom:3px">Win Rate</div>
          <div style="font-family:var(--font-display);font-weight:700;font-size:13px;color:${wr>=55?'var(--green)':wr>=50?'var(--amber)':'var(--red)'}">${wr}%</div>
        </div>
        <div>
          <div style="font-size:9px;color:var(--text3);font-family:var(--font-mono);letter-spacing:.06em;text-transform:uppercase;margin-bottom:3px">Size</div>
          <div class="sec-title">${fmtK(a.startBal)}</div>
        </div>
      </div>

      <!-- Rule bars -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-size:9px;color:var(--text3);font-family:var(--font-mono);letter-spacing:.05em;text-transform:uppercase">Max Drawdown</span>
            <span style="font-size:9px;color:var(--red);font-family:var(--font-mono)">${maxLossPct}% used</span>
          </div>
          <div class="acct-rule-bar">
            <div class="acct-rule-fill" style="width:${maxLossPct}%;background:${maxLossPct>80?'var(--red)':maxLossPct>50?'var(--amber)':'rgba(232,80,74,.5)'}"></div>
          </div>
          <div style="font-size:9px;color:var(--text3);font-family:var(--font-mono);margin-top:3px">Limit: ${fmtK(maxLossLimit)} (${a.maxDrawdown}%)</div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-size:9px;color:var(--text3);font-family:var(--font-mono);letter-spacing:.05em;text-transform:uppercase">Profit Target</span>
            <span style="font-size:9px;color:var(--green);font-family:var(--font-mono)">${profitPct}% reached</span>
          </div>
          <div class="acct-rule-bar">
            <div class="acct-rule-fill" style="width:${profitPct}%;background:${profitPct>=100?'var(--blue)':'var(--green)'}"></div>
          </div>
          <div style="font-size:9px;color:var(--text3);font-family:var(--font-mono);margin-top:3px">Target: ${fmtK(profitLimit)} (${a.profitTarget}%)</div>
        </div>
      </div>
    </div>`;
  }).join('');

  // Update count label
  const countEl = $('port-acct-count');
  if (countEl) countEl.textContent = ACCOUNTS.length + ' account' + (ACCOUNTS.length !== 1 ? 's' : '');
  const fundedCap    = ACCOUNTS.filter(a => /funded/i.test(a.phase)).reduce((s,a) => s+a.startBal, 0);
  const challengeCap  = ACCOUNTS.filter(a => !/funded/i.test(a.phase)).reduce((s,a) => s+a.startBal, 0);
  // Store on window so switchCapView can access
  window._portFundedCap    = fundedCap;
  window._portChallengeCap = challengeCap;
  // Default to funded view
  const totalCap = fundedCap;
  const combinedPnl = TRADES.reduce((s,t) => s+t.pnl, 0);

  // Recompute statuses for health summary
  let active = 0, passed = 0, breached = 0;
  ACCOUNTS.forEach(a => {
    const an = a.key || a.phase;
    const at = TRADES.filter(t => (t.account||'') === an);
    const pnl = at.reduce((s,t)=>s+t.pnl,0);
    const maxLoss = a.startBal*(a.maxDrawdown/100);
    const dailyLoss = a.startBal*(a.dailyLoss/100);
    const profit = a.startBal*(a.profitTarget/100);
    const dayMap2 = {};
    at.forEach(t => { dayMap2[t.date] = (dayMap2[t.date]||0)+t.pnl; });
    const worst = Math.min(0,...Object.values(dayMap2).concat([0]));
    if (pnl <= -maxLoss || Math.abs(worst) >= dailyLoss) breached++;
    else if (a.profitTarget > 0 && pnl >= profit) passed++;
    else active++;
  });
  const pnlColor = combinedPnl >= 0 ? 'var(--green)' : 'var(--red)';
  const pnlSign  = combinedPnl >= 0 ? '+' : '-';

  const capEl = $('port-total-cap');
  const pnlEl = $('port-combined-pnl');
  const hlthEl = $('port-health');
  if (capEl)  { capEl.textContent = '$' + totalCap.toFixed(2); capEl.style.color = 'var(--text)'; }
  // Reset toggle to funded view on re-render
  window._capView = window._capView || 'funded';
  switchCapView(window._capView);
  if (pnlEl)  { pnlEl.textContent = pnlSign + '$' + Math.abs(combinedPnl).toFixed(2); pnlEl.style.color = pnlColor; }
  if (hlthEl) { hlthEl.textContent = `${active} · ${passed} · ${breached}`; hlthEl.style.color = 'var(--text)'; }
}

function switchCapView(view) {
  window._capView = view;
  const capEl    = document.getElementById('port-total-cap');
  const subEl    = document.getElementById('port-total-cap-sub');
  const labelEl  = document.getElementById('port-cap-label');
  const btnF     = document.getElementById('port-cap-btn-funded');
  const btnC     = document.getElementById('port-cap-btn-challenge');
  if (!capEl) return;
  const val = view === 'funded' ? (window._portFundedCap || 0) : (window._portChallengeCap || 0);
  capEl.textContent = '$' + val.toFixed(2);
  if (subEl)   subEl.textContent   = view === 'funded' ? 'across funded accounts' : 'across challenge accounts';
  if (labelEl) labelEl.textContent = view === 'funded' ? 'Funded Capital' : 'Challenge Capital';
  if (btnF) { btnF.style.background = view === 'funded' ? 'var(--green)' : 'transparent'; btnF.style.color = view === 'funded' ? '#000' : 'var(--text3)'; }
  if (btnC) { btnC.style.background = view === 'challenge' ? 'var(--ac-40)' : 'transparent'; btnC.style.color = view === 'challenge' ? 'var(--text)' : 'var(--text3)'; }
}

function renderAcctList() {
  const allRow = `
    <div onclick="selectAcct(-1)" style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;transition:background .12s;background:${selectedAcct===-1?'var(--ac-10)':'transparent'};border-left:2px solid ${selectedAcct===-1?'var(--purple)':'transparent'}" onmouseenter="this.style.background='var(--ac-07)'" onmouseleave="this.style.background='${selectedAcct===-1?'var(--ac-10)':'transparent'}'">
      <div style="width:28px;height:28px;border-radius:7px;background:var(--ac-18);border:1px solid var(--ac-30);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;font-family:var(--font-mono);color:var(--purple);flex-shrink:0">∑</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:${selectedAcct===-1?'var(--text)':'var(--text2)'}">All Accounts</div>
        <div style="font-size:9.5px;color:var(--text3);font-family:var(--font-mono);margin-top:1px">Combined view</div>
      </div>
      ${selectedAcct===-1?'<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2.5 8.5l4 4 7-8" stroke="var(--purple)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>':''}
    </div>`;

  // compute status for each account
  const acctStatuses = ACCOUNTS.map((a, i) => {
    const an = a.key || a.phase;
    const at = TRADES.filter(t => (t.account||'') === an);
    const pnl = at.reduce((s,t)=>s+t.pnl,0);
    const ml = a.startBal*(a.maxDrawdown/100);
    const dl = a.startBal*(a.dailyLoss/100);
    const pt = a.startBal*(a.profitTarget/100);
    const dm = {}; at.forEach(t=>{ dm[t.date]=(dm[t.date]||0)+t.pnl; });
    const wd = Math.min(0,...Object.values(dm).concat([0]));
    let status = 'active';
    if (pnl <= -ml || Math.abs(wd) >= dl) status = 'breached';
    else if (a.profitTarget > 0 && pnl >= pt) status = 'passed';
    return { a, i, status, pnl };
  });

  const activeAccts   = acctStatuses.filter(x => x.status === 'active');
  const inactiveAccts = acctStatuses.filter(x => x.status !== 'active');

  function buildRow({ a, i, status, pnl }) {
    const isSelected = i === selectedAcct;
    const dotColor = status === 'breached' ? 'var(--red)' : status === 'passed' ? 'var(--blue)' : 'var(--green)';
    const dotTitle = status === 'breached' ? 'Breached' : status === 'passed' ? 'Passed' : 'Active';
    const pnlColor = pnl >= 0 ? 'var(--green)' : 'var(--red)';
    const pnlSign  = pnl >= 0 ? '+' : '-';
    const pnlStr   = pnlSign + '$' + Math.abs(pnl).toFixed(2);
    return `
    <div style="display:flex;align-items:center;position:relative;background:${isSelected?'var(--ac-10)':'transparent'};border-left:2px solid ${isSelected?'var(--purple)':'transparent'};${status!=='active'?'opacity:.7':''}transition:background .12s;" onmouseenter="this.style.background='var(--ac-07)'" onmouseleave="this.style.background='${isSelected?'var(--ac-10)':'transparent'}'">
      <div onclick="selectAcct(${i})" style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;flex:1;min-width:0">
        <div style="position:relative;flex-shrink:0">
          ${firmLogoHTML(a.firm, 28, 7)}
          <span title="${dotTitle}" style="position:absolute;bottom:-2px;right:-2px;width:7px;height:7px;border-radius:50%;background:${dotColor};border:1.5px solid var(--bg2)"></span>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:${isSelected?'var(--text)':'var(--text2)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.firm}</div>
          <div style="font-size:9.5px;color:var(--text3);font-family:var(--font-mono);margin-top:2px">${a.phase}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0;margin-left:8px">
          <span style="font-size:11px;font-weight:700;font-family:var(--font-mono);color:var(--text)">$${(a.startBal||0).toLocaleString()}</span>
          ${isSelected?'<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2.5 8.5l4 4 7-8" stroke="var(--purple)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>':'<span style="height:12px"></span>'}
        </div>
      </div>
    </div>`;
  }

  const sectionLabel = (label, count) =>
    `<div style="padding:6px 14px 4px;font-size:8.5px;letter-spacing:.12em;color:var(--text3);font-family:var(--font-mono);text-transform:uppercase;display:flex;align-items:center;gap:6px">
      <span>${label}</span>
      <span style="background:var(--bg5);color:var(--text3);border-radius:10px;padding:1px 6px;font-size:8px">${count}</span>
      <span style="flex:1;height:1px;background:var(--border)"></span>
    </div>`;

  let html = allRow;

  if (activeAccts.length) {
    html += sectionLabel('Active', activeAccts.length);
    html += activeAccts.map(buildRow).join('');
  }
  if (inactiveAccts.length) {
    html += sectionLabel('Inactive', inactiveAccts.length);
    html += inactiveAccts.map(buildRow).join('');
  }

  const acctList = $('acct-list');
  if (acctList) acctList.innerHTML = html;
  // Also update Dashboard dropdown if it exists
  const dashboardList = $('acct-list-dashboard');
  if (dashboardList) dashboardList.innerHTML = html;
}

function selectAcct(i) {
  selectedAcct = i;
  if (i === -1) {
    const acctLabel = $('acct-selected-label');
    if (acctLabel) acctLabel.textContent = 'All Accounts';
    const bannerTitle = $('banner-title-text');
    if (bannerTitle) {
      // Keep the arrow, just update the firm name and phase
      const arrow = bannerTitle.querySelector('svg');
      const span = bannerTitle.querySelector('span');
      bannerTitle.innerHTML = '';
      const nameSpan = document.createElement('span');
      nameSpan.style.cssText = 'display:flex;align-items:center;gap:8px';
      nameSpan.innerHTML = 'All Accounts<span class="acct-tag" style="background:var(--ac-15);color:#a97de8;border:1px solid var(--ac-30);padding:2px 8px;border-radius:5px;font-size:10px;font-family:JetBrains Mono,monospace;font-weight:500">ALL</span>';
      bannerTitle.appendChild(nameSpan);
      if (arrow) bannerTitle.appendChild(arrow);
    }
    const tag = $('acct-phase-tag') || document.querySelector('#acct-selector-btn .acct-tag');
    if (tag) { tag.textContent = 'ALL'; tag.style.cssText = 'background:var(--ac-15);color:#a97de8;border:1px solid var(--ac-30);padding:2px 8px;border-radius:5px;font-size:10px;font-family:JetBrains Mono,monospace;font-weight:500'; }
    const bannerPhaseTag = $('banner-phase-tag');
    if (bannerPhaseTag) bannerPhaseTag.textContent = 'ALL';
  } else {
    const a = ACCOUNTS[i];
    const acctLabel = $('acct-selected-label');
    if (acctLabel) acctLabel.textContent = a.firm;
    const bannerTitle = $('banner-title-text');
    if (bannerTitle) {
      // Keep the arrow, just update the firm name and phase
      const arrow = bannerTitle.querySelector('svg');
      bannerTitle.innerHTML = '';
      const nameSpan = document.createElement('span');
      nameSpan.style.cssText = 'display:flex;align-items:center;gap:8px';
      nameSpan.innerHTML = a.firm + '<span class="acct-tag" style="background:var(--ac-15);color:#a97de8;border:1px solid var(--ac-30);padding:2px 8px;border-radius:5px;font-size:10px;font-family:JetBrains Mono,monospace;font-weight:500" id="banner-phase-tag">' + a.phase + '</span>';
      bannerTitle.appendChild(nameSpan);
      if (arrow) bannerTitle.appendChild(arrow);
    }
    const tag = $('acct-phase-tag') || document.querySelector('#acct-selector-btn .acct-tag');
    if (tag) { tag.textContent = a.phase; tag.style.cssText = 'background:var(--ac-15);color:#a97de8;border:1px solid var(--ac-30);padding:2px 8px;border-radius:5px;font-size:10px;font-family:JetBrains Mono,monospace;font-weight:500'; }
    const bannerPhaseTag = $('banner-phase-tag');
    if (bannerPhaseTag) bannerPhaseTag.textContent = a.phase;
  }
  renderAcctList();
  closeAcctDropdown();
  populateDashboard();
  initDailyPnlChart();
  initScorecard(); // Refresh scorecard to match selected account
  if (typeof updateTopbarAcctLabel === 'function') updateTopbarAcctLabel();
  if (typeof applyFilters === 'function') applyFilters();
}

function toggleAcctDropdown() {
  acctOpen = !acctOpen;
  const dd = $('acct-dropdown');
  const ddDashboard = $('acct-dropdown-dashboard');
  const arrow = $('acct-arrow');
  const bannerArrow = $('banner-dropdown-arrow');
  
  if (dd) dd.style.display = acctOpen ? 'block' : 'none';
  if (ddDashboard) ddDashboard.style.display = acctOpen ? 'block' : 'none';
  if (arrow) arrow.style.transform = acctOpen ? 'rotate(180deg)' : 'rotate(0)';
  if (bannerArrow) {
    bannerArrow.style.transform = acctOpen ? 'rotate(180deg)' : 'rotate(0)';
    bannerArrow.style.opacity = acctOpen ? '1' : '.5';
  }
  
  if(acctOpen) renderAcctList();
}

function closeAcctDropdown() {
  acctOpen = false;
  const dd = $('acct-dropdown');
  const ddDashboard = $('acct-dropdown-dashboard');
  const arrow = $('acct-arrow');
  const bannerArrow = $('banner-dropdown-arrow');
  
  if (dd) dd.style.display = 'none';
  if (ddDashboard) ddDashboard.style.display = 'none';
  if (arrow) arrow.style.transform = 'rotate(0)';
  if (bannerArrow) {
    bannerArrow.style.transform = 'rotate(0)';
    bannerArrow.style.opacity = '.5';
  }
}

document.addEventListener('click', e => {
  const acctWrap = $('acct-dropdown-wrap');
  const bannerText = document.querySelector('.banner-text');
  if(acctWrap && !acctWrap.contains(e.target) && bannerText && !bannerText.contains(e.target)) {
    closeAcctDropdown();
  }
  // Close topbar dropdown on outside click
  const topbarWrap = $('topbar-acct-wrap');
  if (topbarWrap && !topbarWrap.contains(e.target)) {
    closeTopbarAcctDropdown();
  }
});

// ── TOPBAR ACCOUNT SWITCHER ──
let topbarAcctOpen = false;

function toggleTopbarAcctDropdown() {
  topbarAcctOpen = !topbarAcctOpen;
  const dd = $('topbar-acct-dropdown');
  const chevron = $('topbar-acct-chevron');
  if (dd) dd.style.display = topbarAcctOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = topbarAcctOpen ? 'rotate(180deg)' : 'rotate(0)';
  if (topbarAcctOpen) renderTopbarAcctList();
}

function closeTopbarAcctDropdown() {
  topbarAcctOpen = false;
  const dd = $('topbar-acct-dropdown');
  const chevron = $('topbar-acct-chevron');
  if (dd) dd.style.display = 'none';
  if (chevron) chevron.style.transform = 'rotate(0)';
}

function renderTopbarAcctList() {
  const list = $('topbar-acct-list');
  const countEl = $('topbar-acct-count');
  if (!list) return;

  const acctStatuses = ACCOUNTS.map((a, i) => {
    const an = a.key || a.phase;
    const at = TRADES.filter(t => (t.account||'') === an);
    const pnl = at.reduce((s,t)=>s+t.pnl,0);
    const ml = a.startBal*(a.maxDrawdown/100);
    const dl = a.startBal*(a.dailyLoss/100);
    const pt = a.startBal*(a.profitTarget/100);
    const dm = {}; at.forEach(t=>{ dm[t.date]=(dm[t.date]||0)+t.pnl; });
    const wd = Math.min(0,...Object.values(dm).concat([0]));
    let status = 'active';
    if (pnl <= -ml || Math.abs(wd) >= dl) status = 'breached';
    else if (a.profitTarget > 0 && pnl >= pt) status = 'passed';
    return { a, i, status, pnl };
  });

  if (countEl) countEl.textContent = ACCOUNTS.length + ' accounts';

  const allRowHtml = `
    <div onclick="selectAcctFromTopbar(-1)" style="display:flex;align-items:center;gap:10px;padding:9px 10px;cursor:pointer;transition:background .12s;border-radius:8px;background:${selectedAcct===-1?'var(--ac-12)':'transparent'};" onmouseenter="this.style.background='var(--ac-08)'" onmouseleave="this.style.background='${selectedAcct===-1?'var(--ac-12)':'transparent'}'">
      <div style="width:30px;height:30px;border-radius:8px;background:var(--ac-18);border:1px solid var(--ac-30);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;font-family:var(--font-mono);color:var(--purple);flex-shrink:0">∑</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:var(--text)">All Accounts</div>
        <div style="font-size:9.5px;color:var(--text3);font-family:var(--font-mono);margin-top:1px">Combined portfolio view</div>
      </div>
      ${selectedAcct===-1?'<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2.5 8.5l4 4 7-8" stroke="var(--purple)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>':''}
    </div>`;

  const rowsHtml = acctStatuses.map(({ a, i, status, pnl }) => {
    const isSelected = i === selectedAcct;
    const dotColor = status === 'breached' ? 'var(--red)' : status === 'passed' ? 'var(--blue)' : 'var(--green)';
    const menuId = 'acct-card-menu-tb-' + a.id;
    return `
    <div style="display:flex;align-items:center;border-radius:8px;background:${isSelected?'var(--ac-12)':'transparent'};transition:background .12s;position:relative" onmouseenter="this.style.background='var(--ac-08)'" onmouseleave="this.style.background='${isSelected?'var(--ac-12)':'transparent'}'">
      <div onclick="selectAcctFromTopbar(${i})" style="display:flex;align-items:center;gap:10px;padding:9px 10px;cursor:pointer;flex:1;min-width:0">
        <div style="position:relative;flex-shrink:0">
          ${firmLogoHTML(a.firm, 30, 8)}
          <span style="position:absolute;bottom:-2px;right:-2px;width:7px;height:7px;border-radius:50%;background:${dotColor};border:1.5px solid var(--bg2)"></span>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:${isSelected?'var(--text)':'var(--text2)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.firm}</div>
          <div style="font-size:9.5px;color:var(--text3);font-family:var(--font-mono);margin-top:1px">${a.phase} · ${a.balance}</div>
        </div>
        <div style="flex-shrink:0">
          ${isSelected?'<svg width="10" height="10" viewBox="0 0 16 16" fill="none" style="margin-top:2px"><path d="M2.5 8.5l4 4 7-8" stroke="var(--purple)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>':''}
        </div>
      </div>
    </div>`;
  }).join('');

  list.innerHTML = allRowHtml + rowsHtml;
}

function selectAcctFromTopbar(i) {
  selectAcct(i);
  closeTopbarAcctDropdown();
  updateTopbarAcctLabel();
  const fpAcct = $('fp-account');
  if (fpAcct) {
    if (i === -1) { fpAcct.value = ''; }
    else { const a = ACCOUNTS[i]; if (a) fpAcct.value = a.key || a.phase; }
  }
  try {
    const saved = JSON.parse(localStorage.getItem('et-filter-state') || '{}');
    saved.acctFilter2 = fpAcct ? fpAcct.value : '';
    localStorage.setItem('et-filter-state', JSON.stringify(saved));
  } catch(e) {}
  if (typeof applyFilters === 'function') applyFilters();
}

function updateTopbarAcctLabel() {
  const nameEl = $('topbar-acct-name');
  const subEl  = $('topbar-acct-sub');
  const logoWrap = $('topbar-acct-logo');
  if (selectedAcct === -1) {
    if (nameEl) nameEl.textContent = 'All Accounts';
    if (logoWrap) logoWrap.innerHTML = '<div style="width:22px;height:22px;border-radius:6px;background:var(--ac-18);border:1px solid var(--ac-30);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--purple);font-weight:700">∑</div>';
    if (subEl) { subEl.textContent = ACCOUNTS.length + ' accounts'; subEl.style.color = 'var(--purple)'; }
  } else {
    const a = ACCOUNTS[selectedAcct];
    if (nameEl) nameEl.textContent = a.firm;
    if (subEl) { subEl.textContent = a.phase + ' · ' + a.balance; subEl.style.color = 'var(--purple)'; }
    if (logoWrap) {
      const lu = getFirmLogo(a.firm);
      if (lu) {
        logoWrap.innerHTML = `<img src="${lu}" alt="" style="width:22px;height:22px;object-fit:contain;border-radius:6px;padding:1px" onerror="this.remove()">`;
      } else {
        const letter = (a.firm||'?').charAt(0).toUpperCase();
        logoWrap.innerHTML = `<div style="width:22px;height:22px;border-radius:6px;background:linear-gradient(135deg,#6b1fd4,#4d8ef0);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff">${letter}</div>`;
      }
    }
  }
}

// ── BANNER P&L SWITCHER ──
const BANNER_PNL = [
  { label: 'DAILY P&L',   offset: 0 },
  { label: 'WEEKLY P&L',  offset: 1 },
  { label: 'MONTHLY P&L', offset: 2 },
];
let bannerPnlIdx = 1;
let bannerPnlTouchY = 0;

function bannerPnlRender(idx, dir) {
  const ticker = $('banner-pnl-ticker');
  if (!ticker) return;
  ticker.style.transition = 'none';
  ticker.style.transform = `translateY(${dir * -30}px)`;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    ticker.style.transition = 'transform .28s cubic-bezier(.4,0,.2,1)';
    ticker.style.transform = `translateY(${-idx * 30}px)`;
  }));
  const label = $('banner-pnl-label');
  if (label) label.textContent = BANNER_PNL[idx].label;
  $$('.bpnl-dot').forEach((d, i) => {
    d.style.background = i === idx ? 'var(--red)' : 'var(--bg5)';
  });
}

function bannerPnlShift(dir) {
  bannerPnlIdx = (bannerPnlIdx + dir + BANNER_PNL.length) % BANNER_PNL.length;
  bannerPnlRender(bannerPnlIdx, dir);
}

function bannerPnlGoto(i) {
  const dir = i > bannerPnlIdx ? 1 : -1;
  bannerPnlIdx = i;
  bannerPnlRender(i, dir);
}

function bannerPnlWheel(e) { e.preventDefault(); bannerPnlShift(e.deltaY > 0 ? 1 : -1); }
function bannerPnlTouchStart(e) { bannerPnlTouchY = e.touches[0].clientY; }
function bannerPnlTouchEnd(e) {
  const dy = bannerPnlTouchY - e.changedTouches[0].clientY;
  if(Math.abs(dy) > 15) bannerPnlShift(dy > 0 ? 1 : -1);
}

// ── NET P&L SWITCHER ──
const PNL_PERIODS = [
  { label: 'DAILY',   val: '+$47.2',   change: '↑ $47.2',   sub: 'today',      barW: '20%' },
  { label: 'WEEKLY',  val: '+$468.0',  change: '↑ $468.0',  sub: 'this week',  barW: '54%' },
  { label: 'MONTHLY', val: '+$220.0',  change: '↑ $220.0',  sub: 'this month', barW: '68%' },
  { label: 'OVERALL', val: '+$1,842.5',change: '↑ $1,842.5',sub: 'all time',   barW: '85%' },
];
let pnlIndex = 0;
let pnlTouchY = 0;

function pnlRender(idx, dir) {
  const p = PNL_PERIODS[idx];
  const ticker = $('pnl-ticker');
  ticker.style.transition = 'none';
  ticker.style.transform = `translateY(${dir * -36}px)`;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    ticker.style.transition = 'transform .28s cubic-bezier(.4,0,.2,1)';
    ticker.style.transform = `translateY(${-idx * 36}px)`;
  }));
  const periodSub = $('pnl-period-sub');
  if (periodSub) periodSub.textContent = p.sub;
  [0,1,2,3].forEach(i => {
    const el = $('pnl-val-' + i);
    el.textContent = PNL_PERIODS[i].val;
    const digits = PNL_PERIODS[i].val.replace(/[^0-9]/g, '').length;
    const fs = digits <= 3 ? 38 : digits <= 4 ? 30 : digits <= 5 ? 24 : digits <= 6 ? 19 : 15;
    el.style.fontSize = fs + 'px';
  });
  $$('.pnl-dot').forEach((d, i) => {
    d.style.background = i === idx ? 'var(--purple)' : 'var(--bg5)';
  });
}

function pnlShift(dir) {
  pnlIndex = (pnlIndex + dir + PNL_PERIODS.length) % PNL_PERIODS.length;
  pnlRender(pnlIndex, dir);
}

function pnlGoto(i) {
  const dir = i > pnlIndex ? 1 : -1;
  pnlIndex = i;
  pnlRender(i, dir);
}

function pnlWheel(e) {
  e.preventDefault();
  pnlShift(e.deltaY > 0 ? 1 : -1);
}

function pnlTouchStart(e) { pnlTouchY = e.touches[0].clientY; }
function pnlTouchEnd(e) {
  const dy = pnlTouchY - e.changedTouches[0].clientY;
  if(Math.abs(dy) > 20) pnlShift(dy > 0 ? 1 : -1);
}

// ── TOTAL TRADES SWITCHER ──
const TT_PERIODS = [
  { label: 'TODAY',      sub: 'TODAY' },
  { label: 'THIS WEEK',  sub: 'THIS WEEK' },
  { label: 'THIS MONTH', sub: 'THIS MONTH' },
  { label: 'OVERALL',    sub: 'ALL TIME' },
];
let ttIndex = 0;
let ttTouchY = 0;

function ttRender(idx, dir) {
  const ticker = $('tt-ticker');
  ticker.style.transition = 'none';
  ticker.style.transform = `translateY(${dir * -36}px)`;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    ticker.style.transition = 'transform .28s cubic-bezier(.4,0,.2,1)';
    ticker.style.transform = `translateY(${-idx * 36}px)`;
  }));
  $('tt-period-label').textContent = TT_PERIODS[idx].label;
  $('tt-sub-text').textContent = TT_PERIODS[idx].sub;
  $$('.tt-dot').forEach((d, i) => {
    d.style.background = i === idx ? 'var(--purple)' : 'var(--bg5)';
  });
}

function ttShift(dir) {
  ttIndex = (ttIndex + dir + TT_PERIODS.length) % TT_PERIODS.length;
  ttRender(ttIndex, dir);
}
function ttGoto(i) {
  const dir = i > ttIndex ? 1 : -1;
  ttIndex = i;
  ttRender(i, dir);
}
function ttWheel(e) { e.preventDefault(); ttShift(e.deltaY > 0 ? 1 : -1); }
function ttTouchStart(e) { ttTouchY = e.touches[0].clientY; }
function ttTouchEnd(e) {
  const dy = ttTouchY - e.changedTouches[0].clientY;
  if(Math.abs(dy) > 20) ttShift(dy > 0 ? 1 : -1);
}

// ── BANNER COLOR ──
// ACCOUNT_SIZE is derived from the currently selected account's startBal
function getAccountSize() {
  if (!ACCOUNTS || ACCOUNTS.length === 0) return 25000; // Default if no accounts
  if (selectedAcct === -1) return ACCOUNTS.reduce((s, a) => s + a.startBal, 0);
  return (ACCOUNTS && ACCOUNTS[selectedAcct]) ? ACCOUNTS[selectedAcct].startBal : 25000;
}
const ACCOUNT_SIZE = 25000; // legacy fallback — use getAccountSize() where possible
function updateAcctPnlBadge() {
  const balance = 25220;
  const start = 25000;
  const pct = ((balance - start) / start * 100).toFixed(2);
  const el = $('acct-pnl-pct');
  const isPos = balance >= start;
  el.textContent = (isPos ? '+' : '') + pct + '%';
  el.className = 'badge ' + (isPos ? 'badge-green' : 'badge-red');
}

function updateBannerColors() {
  const fields = [
    { id: 'banner-equity',  val: 25220 },
    { id: 'banner-balance', val: 25220 },
  ];
  fields.forEach(f => {
    const el = $(f.id);
    if (!el) return;
    el.style.color = f.val > ACCOUNT_SIZE ? 'var(--green)' : f.val < ACCOUNT_SIZE ? 'var(--red)' : 'var(--text2)';
  });
}

// ── DAILY TIMER ──
function updateDailyTimer() {
  const el = $('daily-timer');
  if (!el) return;
  const now = new Date();
  const reset = new Date(now);
  reset.setHours(17, 0, 0, 0); // 5pm reset
  if (now >= reset) reset.setDate(reset.getDate() + 1);
  const diff = reset - now;
  const h = String(Math.floor(diff / 3600000)).padStart(2,'0');
  const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2,'0');
  const s = String(Math.floor((diff % 60000) / 1000)).padStart(2,'0');
  el.textContent = `${h}:${m}:${s}`;
}
setInterval(updateDailyTimer, 1000);

// ── TRADING DAYS SWITCHER ──
const TD_LABELS = ['This Week', 'This Month', 'Overall'];
let tdIndex = 0;

function calculateTradingDays(period) {
  const now = new Date();
  const trades = (typeof getDashboardTrades === 'function' ? getDashboardTrades() : TRADES) || [];
  
  let startDate;
  if (period === 'This Week') {
    // Get Monday of current week
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    startDate = monday;
  } else if (period === 'This Month') {
    // Get first day of current month
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate.setHours(0, 0, 0, 0);
  } else {
    // Overall - all time
    startDate = null;
  }
  
  // Count unique trading days (unique dates with trades)
  const uniqueDates = new Set();
  trades.forEach(trade => {
    if (!trade.date) return;
    const tradeDate = new Date(trade.date);
    if (startDate && tradeDate < startDate) return;
    uniqueDates.add(trade.date);
  });
  
  return uniqueDates.size;
}

function tdRender(idx, dir) {
  const ticker = $('td-ticker');
  const period = TD_LABELS[idx];
  const count = calculateTradingDays(period);
  
  // Update the value displays
  $('td-val-0').textContent = calculateTradingDays(TD_LABELS[0]);
  $('td-val-1').textContent = calculateTradingDays(TD_LABELS[1]);
  $('td-val-2').textContent = calculateTradingDays(TD_LABELS[2]);
  
  // Animate ticker
  ticker.style.transition = 'none';
  ticker.style.transform = `translateY(${dir * -48}px)`;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    ticker.style.transition = 'transform .28s cubic-bezier(.4,0,.2,1)';
    ticker.style.transform = `translateY(${-idx * 48}px)`;
  }));
  
  // Update period label
  $('td-period-label').textContent = period;
  
  // Update unit label (singular/plural)
  const unitLabel = $('td-unit-label');
  if (unitLabel) {
    unitLabel.textContent = count === 1 ? 'day' : 'days';
  }
  
  // Update dots
  $$('.td-dot').forEach((d, i) => {
    d.style.background = i === idx ? 'var(--purple)' : 'var(--bg5)';
  });
}

function tdShift(dir) {
  tdIndex = (tdIndex + dir + TD_LABELS.length) % TD_LABELS.length;
  tdRender(tdIndex, dir);
}

function tdGoto(i) {
  const dir = i > tdIndex ? 1 : -1;
  tdIndex = i;
  tdRender(i, dir);
}

function tdWheel(e) {
  e.preventDefault();
  tdShift(e.deltaY > 0 ? 1 : -1);
}


(function() {
  let dragEl = null, ghost = null, offsetX = 0, offsetY = 0;
  let lastClickTime = 0, lastClickCard = null;

  function getCards() {
    return [...$$('#stat-row .stat-card')];
  }

  function startDrag(e, card) {
    dragEl = card;
    const rect = card.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    ghost = card.cloneNode(true);
    ghost.style.cssText = `
      position:fixed;
      left:${rect.left}px;top:${rect.top}px;
      width:${rect.width}px;height:${rect.height}px;
      opacity:0.8;pointer-events:none;z-index:9999;
      box-shadow:0 12px 40px rgba(0,0,0,.6);
      border-radius:10px;transform:scale(1.04);
      transition:none;
    `;
    document.body.appendChild(ghost);
    card.style.opacity = '0.3';

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
    e.stopPropagation();
  }

  function onMove(e) {
    if (!ghost) return;
    ghost.style.left = (e.clientX - offsetX) + 'px';
    ghost.style.top  = (e.clientY - offsetY) + 'px';

    const ghostCX = e.clientX - offsetX + ghost.offsetWidth / 2;
    getCards().filter(c => c !== dragEl).forEach(c => {
      const r = c.getBoundingClientRect();
      const mid = r.left + r.width / 2;
      c.style.outline = 'none';
      if (ghostCX >= r.left - 10 && ghostCX <= r.right + 10) {
        c.style.outline = ghostCX < mid
          ? '2px solid rgba(232,80,74,.6)'
          : '2px solid rgba(232,80,74,.6)';
        c.style.outlineOffset = ghostCX < mid ? '-2px' : '-2px';
        c.style.boxShadow = ghostCX < mid
          ? '-3px 0 0 0 var(--red)'
          : '3px 0 0 0 var(--red)';
      } else {
        c.style.boxShadow = '';
        c.style.outline = '';
      }
    });
  }

  function onUp(e) {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (!dragEl || !ghost) return;

    getCards().filter(c => c !== dragEl).forEach(c => {
      c.style.boxShadow = '';
      c.style.outline = '';
    });

    const ghostCX = e.clientX - offsetX + ghost.offsetWidth / 2;
    const row = $('stat-row');
    let target = null, insertBefore = true;
    getCards().filter(c => c !== dragEl).forEach(c => {
      const r = c.getBoundingClientRect();
      if (ghostCX >= r.left - 10 && ghostCX <= r.right + 10) {
        target = c;
        insertBefore = ghostCX < r.left + r.width / 2;
      }
    });

    if (target) {
      if (insertBefore) row.insertBefore(dragEl, target);
      else target.after(dragEl);
    }

    dragEl.style.opacity = '1';
    ghost.remove();
    ghost = null;
    dragEl = null;
  }

  // Double-click detection
  document.addEventListener('mousedown', e => {
    const card = e.target.closest('#stat-row .stat-card');
    if (!card) return;

    const now = Date.now();
    if (lastClickCard === card && now - lastClickTime < 400) {
      // Double click — start drag
      lastClickCard = null;
      lastClickTime = 0;
      startDrag(e, card);
    } else {
      lastClickCard = card;
      lastClickTime = now;
    }
  });
})();

document.addEventListener('DOMContentLoaded', () => {
  try {
    // Verify all helpers are available
    console.log('✓ DOMContentLoaded fired');
    console.log('✓ switchView defined:', typeof switchView === 'function');
    console.log('✓ $ helper:', typeof $ === 'function');
    console.log('✓ $$ helper:', typeof $$ === 'function');
    if (typeof $ !== 'function' || typeof $$ !== 'function') {
      console.error('CRITICAL: DOM helpers not available!', {$: typeof $, $$: typeof $$});
    }
    console.log('✓ DOMContentLoaded fired - page initialization starting');
    
    // Initialize accent color CSS variables if not already set
    const root = document.documentElement;
    const accentColor = getComputedStyle(root).getPropertyValue('--accent').trim() || '#6b1fd4';
    // Generate accent color tiers from base accent
    if (!getComputedStyle(root).getPropertyValue('--ac-50').trim() || getComputedStyle(root).getPropertyValue('--ac-50').trim() === 'var(--ac-50)') {
      console.log('Initializing accent color tiers from:', accentColor);
      const generateAccentTiers = (hex) => {
        const tiers = {};
        const baseAlphas = {3:0.03, 4:0.04, 5:0.05, 6:0.06, 7:0.07, 8:0.08, 9:0.09, 10:0.10, 12:0.12, 14:0.14, 15:0.15, 16:0.16, 18:0.18, 20:0.20, 22:0.22, 25:0.25, 28:0.28, 30:0.30, 35:0.35, 40:0.40, 45:0.45, 50:0.50, 55:0.55, 60:0.60, 65:0.65, 70:0.70, 80:0.80, 85:0.85, 90:0.90};
        Object.keys(baseAlphas).forEach(key => {
          const alpha = baseAlphas[key];
          tiers[`--ac-${key}`] = `rgba(107, 31, 212, ${alpha})`;
        });
        return tiers;
      };
      const tiers = generateAccentTiers(accentColor);
      Object.entries(tiers).forEach(([key, value]) => root.style.setProperty(key, value));
      console.log('✓ Accent color tiers initialized');
    }
    
    // Reset to default data if version stamp is missing (ensures new sample trades load)
    if (!localStorage.getItem('etVersion_4a')) {
      localStorage.removeItem('tradingJournalTrades');
      localStorage.setItem('etVersion_4a', '1');
      TRADES.length = 0;
      getDefaultTrades().forEach(t => TRADES.push(t));
      console.log('✓ Reset trades to defaults');
    }
    // ── No scroll/touch on Total Trades card — buttons only ──

    selectAcct(-1);
    updateTopbarAcctLabel();
    const fpAcct = $('fp-account');
    if (fpAcct) fpAcct.value = '';
    applyFilters();
    populateDashboard();
    initEquityChart();
    initDailyPnlChart();
    initPlaybook();
    initScorecard();
    pnlRender(0, 0);
    bannerPnlRender(1, 0);
    updateBannerColors();
    tdRender(0, 0);
    updateAcctPnlBadge();
    
    // ── Restore saved filter state ──
    restoreSavedFilters();

    // ── Sync Add Trade modal account list from ACCOUNTS on load ──
    syncTradeModalAccountList();
  } catch (error) {
    console.error('Initialization error:', error);
  }

  // ── Function to rebuild account list in trade modal ──
  function syncTradeModalAccountList() {
    const fAcctList = $('f-account-list');
    if (!fAcctList) return;
    
    // Clear existing entries
    fAcctList.innerHTML = '';
    
    // Add all accounts from ACCOUNTS array
    ACCOUNTS.forEach(a => {
      const key = a.key || a.phase;
      const el = document.createElement('div');
      el.className = 'mdl-opt mdl-opt-deletable';
      el.innerHTML = `<span class="mdl-opt-label">${key}</span><button class="mdl-del-btn" onclick="deleteAccountOpt(event,this)"><svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></button>`;
      el.onclick = () => selectAccount(key);
      fAcctList.appendChild(el);
    });
  }
  window.syncTradeModalAccountList = syncTradeModalAccountList;

  // ── Trade record card hover: stays active while any dropdown is open ──
  window.trcUpdateHover = function() {
    const trc = document.querySelector('.trade-record-card');
    if (!trc) return;
    const anyOpen = ['fp-symbol-pills','fp-session-pills','fp-cal'].some(id => {
      const el = $(id);
      return el && el.style.display !== 'none';
    });
    trc.classList.toggle('hovered', anyOpen);
  };
  const trc = document.querySelector('.trade-record-card');
  if (trc) {
    trc.addEventListener('mouseenter', () => trc.classList.add('hovered'));
    trc.addEventListener('mouseleave', () => {
      setTimeout(() => {
        const anyOpen = ['fp-symbol-pills','fp-session-pills','fp-cal'].some(id => {
          const el = $(id);
          return el && el.style.display !== 'none';
        });
        if (!anyOpen) trc.classList.remove('hovered');
      }, 50);
    });
  }

  // Animate progress bars
  setTimeout(() => {
    $$('.prog-fill').forEach(el => {
      const w = el.style.width;
      el.style.width = '0';
      requestAnimationFrame(() => requestAnimationFrame(() => el.style.width = w));
    });
  }, 300);

  // ── Fallback: Add global nav item click handler ──
  document.addEventListener('click', function(e) {
    const navItem = e.target.closest('.nav-item');
    if (navItem && typeof switchView === 'function') {
      console.log('✓ Global nav handler: clicking', navItem.dataset.view);
      switchView(navItem);
    }
  });

  // Signal that app initialization is complete
  window._appReady = true;
  console.log('✓ App initialization complete - ready for modules');
});

function populateDashboard() {
  try {
    const ACCOUNT_SIZE = getAccountSize();
  // Toggle equity curve and layout based on selected account
  const equityPanel = $('dashboard-equity-panel');
  const analyticsGrid = $('dashboard-analytics-grid');
  const rightPanels = $('dashboard-right-panels');
  const isAll = selectedAcct === -1;
  const now = new Date();
  const T = getDashboardTrades(); // filtered by selected account
  const hasTrades = T.length > 0;
  if (equityPanel) equityPanel.style.display = isAll ? 'none' : '';
  if (analyticsGrid) {
    analyticsGrid.style.gridTemplateColumns = '1fr';
    analyticsGrid.style.display = (!isAll && !hasTrades) ? 'none' : 'grid';
  }
  if (rightPanels) rightPanels.style.display = 'grid';
  if (rightPanels) { rightPanels.style.gridTemplateColumns = '1fr 1fr'; rightPanels.style.gap = '12px'; }

  // ── Compute from T ──
  const total = T.length;
  const wins  = T.filter(t => t.pnl > 0);
  const losses = T.filter(t => t.pnl < 0);
  const winRate = total ? ((wins.length / total) * 100).toFixed(1) : 0;
  const netPnl  = T.reduce((s, t) => s + t.pnl, 0);
  const grossPnl = T.reduce((s, t) => s + (t.pnl + (t.comm||0)), 0);
  const totalComm = T.reduce((s, t) => s + (t.comm||0), 0);
  const avgWin  = wins.length  ? (wins.reduce((s,t)=>s+t.pnl,0)  / wins.length).toFixed(2)  : 0;
  const avgLoss = losses.length ? (Math.abs(losses.reduce((s,t)=>s+t.pnl,0)) / losses.length).toFixed(2) : 0;
  const bestTrade  = T.length ? T.reduce((best, t) => t.pnl > best.pnl ? t : best, T[0]) : null;
  const worstTrade = T.length ? T.reduce((worst, t) => t.pnl < worst.pnl ? t : worst, T[0]) : null;
  const profitFactor = losses.length && avgLoss > 0 ? (wins.reduce((s,t)=>s+t.pnl,0) / Math.abs(losses.reduce((s,t)=>s+t.pnl,0))).toFixed(2) : '∞';
  const equity = ACCOUNT_SIZE + netPnl;
  const pnlPct = ((netPnl / ACCOUNT_SIZE) * 100).toFixed(2);
  const bestTradePnl  = bestTrade && bestTrade.pnl > 0 ? bestTrade : null;
  const worstTradePnl = worstTrade && worstTrade.pnl < 0 ? worstTrade : null;

  // Today's trades
  const todayStr = now.toISOString().split('T')[0];
  const todayPnl = T.filter(t => t.date === todayStr).reduce((s,t)=>s+t.pnl,0);

  // This week's trades
  const weekStart = new Date(now);
  const dayOfWeek = now.getDay();
  weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  weekStart.setHours(0,0,0,0);
  const weekPnl = T.filter(t => new Date(t.date) >= weekStart).reduce((s,t)=>s+t.pnl,0);

  // This month's trades
  const monthStr = now.toISOString().slice(0,7);
  const monthTrades = T.filter(t => t.date.startsWith(monthStr)).length;
  const monthPnl = T.filter(t => t.date.startsWith(monthStr)).reduce((s,t)=>s+t.pnl,0);

  // Most traded symbol
  const symCount = {};
  T.forEach(t => symCount[t.symbol] = (symCount[t.symbol]||0)+1);
  const mostTraded = Object.entries(symCount).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—';

  // Unique trading days
  const tradingDays = new Set(T.map(t => t.date)).size;
  const weekDays = new Set(T.filter(t => new Date(t.date) >= weekStart).map(t => t.date)).size;

  // ── Streak ──
  const sorted = [...T].sort((a,b) => (b.date+b.time).localeCompare(a.date+a.time));
  let streak = 0, streakType = null;
  for (const t of sorted) {
    const result = t.pnl > 0 ? 'W' : t.pnl < 0 ? 'L' : 'BE';
    if (streakType === null && result !== 'BE') { streakType = result; streak = 1; }
    else if (result === streakType) streak++;
    else break;
  }
  const streakEmoji = streakType === 'W' ? '↑' : streakType === 'L' ? '↓' : '—';
  const streakColor = streakType === 'W' ? 'var(--green)' : streakType === 'L' ? 'var(--red)' : 'var(--text3)';
  const streakText  = streakType ? `${streak}${streakType} ${streakEmoji}` : '—';

  // ── Avg RR ──
  const tradesWithSL = T.filter(t => t.sl && t.entry && t.exit);
  const avgRR = tradesWithSL.length
    ? (tradesWithSL.reduce((s,t) => {
        const risk   = Math.abs(t.entry - t.sl);
        const reward = Math.abs(t.exit  - t.entry);
        return s + (risk > 0 ? reward / risk : 0);
      }, 0) / tradesWithSL.length).toFixed(2)
    : '—';

  // ── Banner title ──
  const bannerTitle = document.querySelector('.banner-title');
  if (bannerTitle) {
    bannerTitle.textContent = selectedAcct === -1 ? 'All Accounts' : (ACCOUNTS[selectedAcct]?.firm || 'Dashboard');
  }
  const acctSizeEl = document.querySelector('.bstat-val[style*="purple"]');
  if (acctSizeEl) acctSizeEl.textContent = '$' + ACCOUNT_SIZE.toFixed(2);

  function set(id, text, color) {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    if (color !== undefined) el.style.color = color;
  }
  function setHTML(id, html) {
    const el = $(id);
    if (el) el.innerHTML = html;
  }

  // ── Goals / All Accounts toggle ──
  const goalsSection = $('goals-section');
  const allAcctSection = $('all-accounts-section');
  if (selectedAcct === -1) {
    if (goalsSection) goalsSection.style.display = 'none';
    if (allAcctSection) allAcctSection.style.display = 'flex';
    renderAllAccountsSection();
  } else {
    if (goalsSection) goalsSection.style.display = 'flex';
    if (allAcctSection) allAcctSection.style.display = 'none';
  }

  // ── Banner ──
  const fmt = v => '$' + v.toFixed(2);
  const bannerRight = $('banner-right-stats');
  const bannerTitleEl = $('banner-title-text');
  if (selectedAcct === -1) {
    if (bannerRight) bannerRight.style.display = 'none';
    if (bannerTitleEl) bannerTitleEl.textContent = 'All Accounts';
  } else {
    if (bannerRight) bannerRight.style.display = '';
    if (bannerTitleEl) bannerTitleEl.textContent = ACCOUNTS[selectedAcct]?.firm || 'Dashboard';
    set('banner-equity',  fmt(equity), equity > ACCOUNT_SIZE ? 'var(--green)' : equity < ACCOUNT_SIZE ? 'var(--red)' : 'var(--text2)');
    set('banner-balance', fmt(equity), equity > ACCOUNT_SIZE ? 'var(--green)' : equity < ACCOUNT_SIZE ? 'var(--red)' : 'var(--text2)');
    const acctSizeEl = $('banner-acct-size');
    if (acctSizeEl) acctSizeEl.textContent = '$' + ACCOUNT_SIZE.toFixed(2);
  }
  set('acct-pnl-pct', (netPnl >= 0 ? '+' : '') + pnlPct + '%');
  $('acct-pnl-pct').className = 'badge ' + (netPnl >= 0 ? 'badge-green' : 'badge-red');

  // ── PNL ticker periods ──
  PNL_PERIODS[0] = { label:'DAILY',   val:(todayPnl>=0?'+':'-')+'$'+Math.abs(todayPnl).toFixed(2),  change:(todayPnl>=0?'↑ ':'↓ ')+'$'+Math.abs(todayPnl).toFixed(2),  sub:'today' };
  PNL_PERIODS[1] = { label:'WEEKLY',  val:(weekPnl>=0?'+':'-')+'$'+Math.abs(weekPnl).toFixed(2),    change:(weekPnl>=0?'↑ ':'↓ ')+'$'+Math.abs(weekPnl).toFixed(2),    sub:'this week' };
  PNL_PERIODS[2] = { label:'MONTHLY', val:(monthPnl>=0?'+':'-')+'$'+Math.abs(monthPnl).toFixed(2),  change:(monthPnl>=0?'↑ ':'↓ ')+'$'+Math.abs(monthPnl).toFixed(2),  sub:'this month' };
  PNL_PERIODS[3] = { label:'OVERALL', val:(netPnl>=0?'+':'-')+'$'+Math.abs(netPnl).toFixed(2),      change:(netPnl>=0?'↑ ':'↓ ')+'$'+Math.abs(netPnl).toFixed(2),      sub:'all time' };

  // ── Win rate card ──
  const wrColor = winRate >= 55 ? 'var(--green)' : winRate >= 50 ? 'var(--amber)' : 'var(--red)';
  const wrText  = winRate >= 55 ? 'GREAT' : winRate >= 50 ? 'GOOD' : 'NEEDS WORK';
  set('wr-val', winRate, wrColor);
  set('wr-label', wrText, wrColor);
  set('wr-wins',   `${wins.length}W`,   'var(--green)');
  set('wr-be',     `${T.length - wins.length - losses.length}BE`, '#dde1ef');
  set('wr-losses', `${losses.length}L`, 'var(--red)');
  set('wr-streak', streakText, streakColor);
  set('wr-rr', avgRR !== '—' ? `1:${avgRR}` : '—', 'var(--blue)');
  const wrBar = $('wr-bar');
  if (wrBar) { wrBar.style.setProperty('--bar-target', winRate + '%'); }

  // ── Total trades card ──
  const todayTrades = T.filter(t => t.date === todayStr).length;
  const weekTrades  = T.filter(t => new Date(t.date) >= weekStart).length;
  $('tt-val-0').textContent = todayTrades;
  $('tt-val-1').textContent = weekTrades;
  $('tt-val-2').textContent = monthTrades;
  $('tt-val-3').textContent = total;
  ttRender(0, 0);

  // ── Trade log total trades ticker ──
  $('tl-tt-val-0').textContent = total;
  $('tl-tt-val-1').textContent = todayTrades;
  $('tl-tt-val-2').textContent = weekTrades;
  $('tl-tt-val-3').textContent = monthTrades;
  tlTtRender(0, 0);

  // ── Profit factor card ──
  set('pf-val', profitFactor);
  const pfBadge = $('pf-badge');
  if (pfBadge) {
    const profitable = netPnl > 0;
    pfBadge.textContent = profitable ? '● Profitable' : '● Not Profitable';
    pfBadge.className = 'badge ' + (profitable ? 'badge-green' : 'badge-red');
  }
  setHTML('pf-worst', worstTradePnl ? `-$${Math.abs(worstTradePnl.pnl).toFixed(2)} <span style="font-size:9px;color:var(--text3);font-weight:400">(${((worstTradePnl.pnl/ACCOUNT_SIZE)*100).toFixed(2)}%)</span>` : '—');
  setHTML('pf-best',  bestTradePnl  ? `+$${bestTradePnl.pnl.toFixed(2)} <span style="font-size:9px;color:var(--text3);font-weight:400">(+${((bestTradePnl.pnl/ACCOUNT_SIZE)*100).toFixed(2)}%)</span>` : '—');

  // ── Trading days ──
  const monthDays = new Set(T.filter(t => t.date && t.date.startsWith(monthStr)).map(t => t.date)).size;
  set('td-val-0', weekDays);
  set('td-val-1', monthDays);
  set('td-val-2', tradingDays);
  tdRender(tdIndex, 0);

  // ── Trade log sub-stats ──
  set('tl-total', total);
  set('tl-gross', (grossPnl >= 0 ? '+$' : '-$') + Math.abs(grossPnl).toFixed(2), grossPnl >= 0 ? 'var(--green)' : 'var(--red)');
  set('tl-comm',  '-$' + totalComm.toFixed(2));
  set('tl-net',   (netPnl >= 0 ? '+$' : '-$') + Math.abs(netPnl).toFixed(2), netPnl >= 0 ? 'var(--green)' : 'var(--red)');
  const tlWrColor = winRate >= 50 ? 'var(--green)' : winRate >= 40 ? 'var(--amber)' : 'var(--red)';
  const tlWrBarClass = winRate >= 50 ? 'g' : winRate >= 40 ? 'a' : 'r';
  const tlWrBadgeClass = winRate >= 50 ? 'badge badge-green' : winRate >= 40 ? 'badge badge-amber' : 'badge badge-red';
  const tlWrBadgeText = winRate >= 50 ? '● Profitable' : winRate >= 40 ? '● Soon to be' : '● Broke';
  set('tl-winrate', winRate + '%', tlWrColor);
  const tlWrBadge = $('tl-wr-badge');
  if (tlWrBadge) { tlWrBadge.className = tlWrBadgeClass; tlWrBadge.textContent = tlWrBadgeText; }
  const tlWrBar = document.querySelector('#tl-winrate ~ div ~ div .mini-bar-fill');
  if (tlWrBar) { tlWrBar.className = 'mini-bar-fill ' + tlWrBarClass; tlWrBar.style.width = winRate + '%'; }

  // ── Shared formatter ──
  const fmtDollar  = v => '$' + v.toFixed(2);

  // Get account-specific rule percentages (fall back to 8/8/4 if not set)
  const acctRules = (selectedAcct >= 0 && ACCOUNTS[selectedAcct]) ? ACCOUNTS[selectedAcct] : null;
  const profitTargetPct  = acctRules ? acctRules.profitTarget  : 8;
  const maxDrawdownPct   = acctRules ? acctRules.maxDrawdown   : 8;
  const dailyLossPct     = acctRules ? acctRules.dailyLoss     : 4;
  const isFunded         = acctRules ? acctRules.profitTarget === 0 : false;
  const isInstant        = acctRules ? acctRules.challengeType === 'Instant' : false;
  const hideProfitBar    = isFunded || isInstant;

  // ── Profit card ──
  const PROFIT_TARGET    = ACCOUNT_SIZE * (profitTargetPct / 100);
  const amountGained     = Math.max(0, netPnl);
  const profitRemaining  = Math.max(0, PROFIT_TARGET - amountGained);
  const profitBarPct     = isFunded ? 0 : Math.min(100, (amountGained / (PROFIT_TARGET || 1)) * 100);
  const profitRemPct     = ((profitRemaining / ACCOUNT_SIZE) * 100).toFixed(2);
  const gainedPct        = ((amountGained / ACCOUNT_SIZE) * 100).toFixed(2);
  const tooltipLeft      = Math.max(6, Math.min(94, profitBarPct)) + '%';

  const prRemaining = $('profit-remaining');
  if (prRemaining) prRemaining.innerHTML = `${fmtDollar(profitRemaining)} <span style="font-size:11px;color:var(--text3);font-weight:400">(${profitRemPct}%)</span>`;

  // Hide profit bar for funded or instant accounts
  const prBarWrap = $('profit-bar-wrap');
  if (prBarWrap) prBarWrap.style.display = hideProfitBar ? 'none' : 'block';

  const prTooltipAmt = $('profit-tooltip-amt');
  if (prTooltipAmt) prTooltipAmt.textContent = '+' + fmtDollar(amountGained) + ' gained';

  const prTooltipPct = $('profit-tooltip-pct');
  if (prTooltipPct) prTooltipPct.textContent = '+' + gainedPct + '%';

  const prTooltip = $('profit-tooltip');
  if (prTooltip) prTooltip.style.left = tooltipLeft;

  const prBarFill = $('profit-bar-fill');
  if (prBarFill) prBarFill.style.width = profitBarPct.toFixed(1) + '%';

  const prLabelLow  = $('profit-label-low');
  const prLabelHigh = $('profit-label-high');
  if (prLabelLow)  prLabelLow.textContent  = fmtDollar(ACCOUNT_SIZE);
  if (prLabelHigh) prLabelHigh.textContent = isFunded ? 'N/A' : fmtDollar(ACCOUNT_SIZE + PROFIT_TARGET);

  // Update profit card header limits
  const profitLimitEl = $('profit-limit-amt');
  if (profitLimitEl) profitLimitEl.innerHTML = isFunded
    ? '<em style="font-size:11px;color:var(--text3);font-weight:400">No target — funded</em>'
    : `${fmtDollar(PROFIT_TARGET)} <span style="font-size:11px;color:var(--text3);font-weight:400">(${profitTargetPct}%)</span>`;

  // ── Max Loss card ──
  const MAX_LOSS_LIMIT = ACCOUNT_SIZE * (maxDrawdownPct / 100);
  const mlLimitEl = $('maxloss-limit-amt');
  if (mlLimitEl) mlLimitEl.innerHTML = `${fmtDollar(MAX_LOSS_LIMIT)} <span style="font-size:11px;color:var(--text3);font-weight:400">(${maxDrawdownPct}%)</span>`;
  // Amount lost = how far equity has dropped below starting balance (0 if in profit)
  const amountLost = Math.max(0, ACCOUNT_SIZE - equity);
  const remaining  = MAX_LOSS_LIMIT - amountLost;
  const barPct     = Math.min(100, (amountLost / MAX_LOSS_LIMIT) * 100);
  const remPct     = ((remaining / ACCOUNT_SIZE) * 100).toFixed(2);
  const lostPct    = ((amountLost / ACCOUNT_SIZE) * 100).toFixed(2);

  const mlRemaining = $('maxloss-remaining');
  if (mlRemaining) mlRemaining.innerHTML = `${fmtDollar(remaining)} <span style="font-size:11px;color:var(--text3);font-weight:400">(${remPct}%)</span>`;

  const mlTooltipAmt = $('maxloss-tooltip-amt');
  if (mlTooltipAmt) mlTooltipAmt.textContent = (amountLost > 0 ? '-' : '') + fmtDollar(amountLost) + ' lost';

  const mlTooltipPct = $('maxloss-tooltip-pct');
  if (mlTooltipPct) mlTooltipPct.textContent = (amountLost > 0 ? '-' : '') + lostPct + '%';

  const mlBarFill = $('maxloss-bar-fill');
  if (mlBarFill) mlBarFill.style.width = barPct.toFixed(1) + '%';

  const mlLabelLow  = $('maxloss-label-low');
  const mlLabelHigh = $('maxloss-label-high');
  if (mlLabelLow)  mlLabelLow.textContent  = fmtDollar(ACCOUNT_SIZE - MAX_LOSS_LIMIT);
  if (mlLabelHigh) mlLabelHigh.textContent = fmtDollar(ACCOUNT_SIZE);

  // ── Daily Loss card ──
  const DAILY_LOSS_LIMIT = ACCOUNT_SIZE * (dailyLossPct / 100);
  // Worst single day loss for today (or 0 if no trades today / in profit)
  const todayDayPnl = T.filter(t => t.date === todayStr).reduce((s,t) => s + t.pnl, 0);
  const todayLost   = Math.max(0, -todayDayPnl);
  const dlRemaining = Math.max(0, DAILY_LOSS_LIMIT - todayLost);
  const dlBarPct    = Math.min(100, (todayLost / (DAILY_LOSS_LIMIT || 1)) * 100);
  const dlRemPct    = ((dlRemaining / ACCOUNT_SIZE) * 100).toFixed(2);
  const dlLostPct   = ((todayLost / ACCOUNT_SIZE) * 100).toFixed(2);

  const dlLimitEl = $('dailyloss-limit-amt');
  if (dlLimitEl) dlLimitEl.innerHTML = `${fmtDollar(DAILY_LOSS_LIMIT)} <span style="font-size:11px;color:var(--text3);font-weight:400">(${dailyLossPct}%)</span>`;

  const dlRemEl = $('dailyloss-remaining');
  if (dlRemEl) dlRemEl.innerHTML = `${fmtDollar(dlRemaining)} <span style="font-size:11px;color:var(--text3);font-weight:400">(${dlRemPct}%)</span>`;

  const dlTooltipAmt = $('dailyloss-tooltip-amt');
  if (dlTooltipAmt) dlTooltipAmt.textContent = (todayLost > 0 ? '-' : '') + fmtDollar(todayLost) + ' lost today';

  const dlTooltipPct = $('dailyloss-tooltip-pct');
  if (dlTooltipPct) dlTooltipPct.textContent = (todayLost > 0 ? '-' : '') + dlLostPct + '%';

  const dlBarFill = $('dailyloss-bar-fill');
  if (dlBarFill) dlBarFill.style.width = dlBarPct.toFixed(1) + '%';

  const dlLabelLow  = $('dailyloss-label-low');
  const dlLabelHigh = $('dailyloss-label-high');
  if (dlLabelLow)  dlLabelLow.textContent  = fmtDollar(ACCOUNT_SIZE - DAILY_LOSS_LIMIT);
  if (dlLabelHigh) dlLabelHigh.textContent = fmtDollar(ACCOUNT_SIZE);

  // Refresh dashboard equity chart with live data
  initEquityChart();
  } catch (e) {
    console.error('populateDashboard error:', e);
  }
}

// ── CUSTOM CALENDAR ──
let calActive = null;
let calFromVal = '';
let calToVal   = '';
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth();

const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function createCalPopup() {
  if ($('fp-cal')) return;
  const el = document.createElement('div');
  el.id = 'fp-cal';
  el.style.cssText = 'display:none;position:fixed;z-index:9999;background:var(--bg2);border:1px solid var(--ac-40);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.7),0 0 0 1px var(--ac-10),inset 0 0 40px var(--ac-05);padding:16px;width:256px';
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <button onclick="calPrevMonth()" style="background:var(--bg4);border:1px solid var(--border);border-radius:7px;width:28px;height:28px;cursor:pointer;color:var(--text2);font-size:14px;display:flex;align-items:center;justify-content:center;transition:all .15s" onmouseenter="this.style.borderColor='var(--ac-50)';this.style.color='#a97de8'" onmouseleave="this.style.borderColor='var(--border)';this.style.color='var(--text2)'">‹</button>
      <div id="cal-month-label" style="font-family:var(--font-display);font-weight:600;font-size:13px;color:var(--text);letter-spacing:.02em"></div>
      <button onclick="calNextMonth()" style="background:var(--bg4);border:1px solid var(--border);border-radius:7px;width:28px;height:28px;cursor:pointer;color:var(--text2);font-size:14px;display:flex;align-items:center;justify-content:center;transition:all .15s" onmouseenter="this.style.borderColor='var(--ac-50)';this.style.color='#a97de8'" onmouseleave="this.style.borderColor='var(--border)';this.style.color='var(--text2)'">›</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:6px">
      ${['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=>`<div style="text-align:center;font-size:9px;font-family:var(--font-mono);color:var(--text3);letter-spacing:.06em;padding:3px 0">${d}</div>`).join('')}
    </div>
    <div id="cal-days" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
      <button onclick="calClear()" style="background:none;border:none;color:var(--text3);font-size:11px;font-family:var(--font-mono);cursor:pointer;padding:0;transition:color .15s" onmouseenter="this.style.color='var(--red)'" onmouseleave="this.style.color='var(--text3)'"><span style="display:inline-flex;align-items:center;gap:4px"><svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg> Clear</span></button>
      <div id="cal-type-label" style="font-size:9px;font-family:var(--font-mono);color:var(--ac-70);letter-spacing:.1em;text-transform:uppercase">FROM</div>
      <button onclick="calToday()" style="background:none;border:none;color:#a97de8;font-size:11px;font-family:var(--font-mono);cursor:pointer;padding:0;transition:opacity .15s;opacity:.8" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='.8'">Today</button>
    </div>
  `;
  document.body.appendChild(el);
}

function openCal(which) {
  createCalPopup();
  calActive = which;
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();
  renderCal();

  const anchor = $(which === 'from' ? 'fp-date-from-display' : 'fp-date-to-display');
  const rect = anchor.getBoundingClientRect();
  const cal  = $('fp-cal');
  cal.style.display = 'block';

  // Position below anchor, flip up if near bottom
  let top = rect.bottom + 8;
  if (top + 290 > window.innerHeight) top = rect.top - 290;
  cal.style.top  = top + 'px';
  cal.style.left = Math.min(rect.left, window.innerWidth - 270) + 'px';

  $('cal-type-label').textContent = which === 'from' ? 'FROM' : 'TO';
  $('fp-date-from-display').style.borderColor = which==='from' ? 'var(--ac-60)' : 'var(--border)';
  $('fp-date-to-display').style.borderColor   = which==='to'   ? 'var(--ac-60)' : 'var(--border)';

  function calReposition() {
    const a = $(which === 'from' ? 'fp-date-from-display' : 'fp-date-to-display');
    if (!a) return;
    const r = a.getBoundingClientRect();
    const c = $('fp-cal');
    if (!c || c.style.display === 'none') { window.removeEventListener('scroll', calReposition, true); return; }
    let t = r.bottom + 8;
    if (t + 290 > window.innerHeight) t = r.top - 290;
    c.style.top  = t + 'px';
    c.style.left = Math.min(r.left, window.innerWidth - 270) + 'px';
  }
  window.addEventListener('scroll', calReposition, true);
  const _origClose = closeCal;
  cal._removeScroll = () => window.removeEventListener('scroll', calReposition, true);

  setTimeout(() => document.addEventListener('click', calOutsideClick), 0);
  trcUpdateHover();
}

function closeCal() {
  calActive = null;
  const cal = $('fp-cal');
  if (cal) { cal.style.display = 'none'; if (cal._removeScroll) cal._removeScroll(); }
  const from = $('fp-date-from-display');
  const to   = $('fp-date-to-display');
  if (from) from.style.borderColor = 'var(--border)';
  if (to)   to.style.borderColor   = 'var(--border)';
  document.removeEventListener('click', calOutsideClick);
  trcUpdateHover();
}

function calOutsideClick(e) {
  const cal     = $('fp-cal');
  const fromBtn = $('fp-date-from-display');
  const toBtn   = $('fp-date-to-display');
  if (!cal.contains(e.target) && !fromBtn.contains(e.target) && !toBtn.contains(e.target)) closeCal();
}

function renderCal() {
  $('cal-month-label').textContent = `${CAL_MONTHS[calMonth]} ${calYear}`;
  const grid = $('cal-days');
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);
  let html = '';
  for (let i = 0; i < firstDay; i++) html += '<div></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isFrom = ds === calFromVal, isTo = ds === calToVal;
    const inRange = calFromVal && calToVal && ds > calFromVal && ds < calToVal;
    const isToday = ds === today;
    let bg = 'transparent', color = 'var(--text2)', border = '1px solid transparent', fw = '400', radius = '6px';
    if (isFrom || isTo) { bg='var(--purple)'; color='#fff'; fw='600'; }
    else if (inRange)   { bg='var(--purple2)'; color='#a97de8'; border='1px solid var(--ac-20)'; }
    else if (isToday)   { border='1px solid var(--ac-50)'; color='#a97de8'; }
    html += `<div onclick="calPickDay('${ds}')" style="text-align:center;padding:6px 2px;border-radius:${radius};font-size:11px;font-family:var(--font-mono);cursor:pointer;background:${bg};color:${color};border:${border};font-weight:${fw};transition:background .1s,color .1s" onmouseenter="if(!['var(--purple)','var(--purple2)'].includes(this.style.background))this.style.background='var(--bg4)'" onmouseleave="if(this.style.background==='var(--bg4)')this.style.background='transparent'">${d}</div>`;
  }
  grid.innerHTML = html;
}

function calPickDay(ds) {
  if (calActive === 'from') {
    calFromVal = ds;
    const lbl = $('fp-from-label');
    if (lbl) { lbl.textContent = ds; lbl.closest('div[id]').style.color='var(--text)'; }
    window._calJustPicked = true;
    setTimeout(() => { window._calJustPicked = false; }, 100);
    calActive = 'to';
    $('cal-type-label').textContent = 'TO';
    $('fp-date-from-display').style.borderColor = 'var(--border)';
    $('fp-date-to-display').style.borderColor   = 'var(--ac-60)';
  } else {
    calToVal = ds;
    const lbl = $('fp-to-label');
    if (lbl) { lbl.textContent = ds; lbl.closest('div[id]').style.color='var(--text)'; }
    window._calJustPicked = true;
    setTimeout(() => { window._calJustPicked = false; }, 100);
    closeCal();
  }
  renderCal();
}

function calPrevMonth() { if(--calMonth < 0){ calMonth=11; calYear--; } renderCal(); }
function calNextMonth() { if(++calMonth > 11){ calMonth=0;  calYear++; } renderCal(); }

/* ── SELECT MODE ── */
// selectModeActive already defined at top
let selectedIds = new Set();

function enableSelectMode() {
  selectModeActive = true;
  selectedIds.clear();
  closeOptionsMenu();
  const search = $('tlog-search');
  const selBar = $('sel-mode-bar');
  if (search) search.style.display = 'none';
  if (selBar) selBar.style.display = 'flex';
  // Highlight options button
  const btn = $('options-btn');
  if (btn) { btn.classList.add('active'); btn.style.boxShadow=''; btn.style.borderColor=''; btn.style.color=''; btn.style.background=''; }
  const lbl = $('options-btn-label');
  if (lbl) lbl.textContent = '';
  renderTrades(filteredTrades);
  updateSelBar();
}

function disableSelectMode() {
  selectModeActive = false;
  selectedIds.clear();
  const search = $('tlog-search');
  const selBar = $('sel-mode-bar');
  if (search) search.style.display = '';
  if (selBar) selBar.style.display = 'none';
  // Reset options button
  const btn = $('options-btn');
  if (btn) { btn.classList.remove('active'); }
  const lbl = $('options-btn-label');
  if (lbl) lbl.textContent = '';
  renderTrades(filteredTrades);
  updateSelBar();
}

function toggleSelectRow(id, e) {
  e.stopPropagation();
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  const cb = $('sel-cb-' + id);
  if (cb) cb.classList.toggle('checked', selectedIds.has(id));
  const row = cb ? cb.closest('tr') : null;
  if (row) row.classList.toggle('sel-row-checked', selectedIds.has(id));
  updateSelBar();
  updateSelectAllCheckbox();
}

function toggleSelectAll(e) {
  e.stopPropagation();
  const allIds = filteredTrades.map(t => t.id);
  const allSelected = allIds.every(id => selectedIds.has(id));
  if (allSelected) allIds.forEach(id => selectedIds.delete(id));
  else             allIds.forEach(id => selectedIds.add(id));
  allIds.forEach(id => {
    const cb = $('sel-cb-' + id);
    if (cb) cb.classList.toggle('checked', selectedIds.has(id));
    const row = cb ? cb.closest('tr') : null;
    if (row) row.classList.toggle('sel-row-checked', selectedIds.has(id));
  });
  updateSelectAllCheckbox();
  updateSelBar();
}

function updateSelectAllCheckbox() {
  const allCb = $('sel-cb-all');
  const allLabel = $('sel-all-label');
  if (!allCb) return;
  const allIds = filteredTrades.map(t => t.id);
  const selCount = allIds.filter(id => selectedIds.has(id)).length;
  allCb.classList.remove('checked','indeterminate');
  if (selCount === allIds.length && allIds.length > 0) {
    allCb.classList.add('checked');
    if (allLabel) allLabel.textContent = 'Deselect All';
  } else if (selCount > 0) {
    allCb.classList.add('indeterminate');
    if (allLabel) allLabel.textContent = 'Select All';
  } else {
    if (allLabel) allLabel.textContent = 'Select All';
  }
}

function updateSelBar() {
  const bar = $('sel-bar');
  const countEl = $('sel-bar-count-num');
  const inlineCount = $('sel-count-inline');
  const inlineWrap = $('sel-count-inline-wrap');
  if (!bar) return;
  if (selectModeActive && selectedIds.size > 0) {
    bar.classList.add('visible');
    if (countEl) countEl.textContent = selectedIds.size;
    if (inlineCount) inlineCount.textContent = selectedIds.size;
    if (inlineWrap) inlineWrap.style.display = 'inline';
  } else {
    bar.classList.remove('visible');
    if (inlineWrap) inlineWrap.style.display = 'none';
  }
}

let undoSnapshot = null;
let undoTimer = null;

function selDeleteSelected() {
  if (!selectedIds.size) return;
  const count = selectedIds.size;
  // Save snapshot for undo
  undoSnapshot = { trades: [...TRADES], filtered: [...filteredTrades] };
  // Delete
  selectedIds.forEach(id => {
    const idx = TRADES.findIndex(t => t.id === id);
    if (idx !== -1) TRADES.splice(idx, 1);
  });
  selectedIds.clear();
  applyFilters();
  disableSelectMode();
  renderTrades(filteredTrades);
  populateDashboard();
  refreshAdvAnalytics();
  showUndoToast(count);
}

// showUndoToast defined below with isEdit support

function hideUndoToast() {
  const toast = $('undo-toast');
  if (!toast) return;
  toast.style.opacity = '0';
  toast.style.transform = 'translateX(-50%) translateY(80px)';
  toast.style.pointerEvents = 'none';
  undoSnapshot = null;
}

function selUndoDelete() {
  if (!undoSnapshot) return;
  if (undoTimer) clearTimeout(undoTimer);
  // Restore
  TRADES.length = 0;
  undoSnapshot.trades.forEach(t => TRADES.push(t));
  filteredTrades = [...undoSnapshot.filtered];
  renderTrades(filteredTrades);
  populateDashboard();
  refreshAdvAnalytics();
  updateSelBar();
  hideUndoToast();
}

function selExportSelected() {
  const rows = TRADES.filter(t => selectedIds.has(t.id));
  if (!rows.length) return;
  const headers = ['ID','Date','Time','Symbol','Type','Direction','Entry','Exit','Size','SL','TP','Commission','Net P&L','Setup','Session','Rating','Notes'];
  const csv = [headers.join(','), ...rows.map(t =>
    [t.id,t.date,t.time,t.symbol,t.type,t.dir,t.entry,t.exit,t.size,t.sl||'',t.tp||'',t.comm,t.pnl,'"'+t.setup+'"','"'+t.session+'"',t.rating,'"'+(t.notes||'').replace(/"/g,'""')+'"'].join(',')
  )].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
  a.download = 'trades_selection_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
}

function selShowSummary() {
  const rows = TRADES.filter(t => selectedIds.has(t.id));
  if (!rows.length) return;
  const wins   = rows.filter(t => t.pnl > 0);
  const losses = rows.filter(t => t.pnl < 0);
  const netPnl = rows.reduce((s,t) => s+t.pnl, 0);
  const wr     = rows.length ? ((wins.length/rows.length)*100).toFixed(1) : 0;
  const avgPnl = rows.length ? (netPnl/rows.length).toFixed(2) : 0;
  const avgWin = wins.length ? (wins.reduce((s,t)=>s+t.pnl,0)/wins.length).toFixed(2) : '—';
  const avgLoss= losses.length ? (losses.reduce((s,t)=>s+t.pnl,0)/losses.length).toFixed(2) : '—';
  const best   = rows.reduce((b,t) => t.pnl>b.pnl?t:b, rows[0]);
  const worst  = rows.reduce((w,t) => t.pnl<w.pnl?t:w, rows[0]);
  const isPos  = netPnl >= 0;
  const m = $('sel-summary-modal');
  $('sel-sum-body').innerHTML =
    '<div style="text-align:center;padding:10px 0 16px">' +
      '<div style="font-size:9px;letter-spacing:.12em;color:var(--text3);font-family:\'JetBrains Mono\',monospace;text-transform:uppercase;margin-bottom:6px">Net P&amp;L &middot; ' + rows.length + ' trades</div>' +
      '<div style="font-family:\'Clash Display\',sans-serif;font-weight:700;font-size:40px;color:' + (isPos?'var(--green)':'var(--red)') + '">' + (isPos?'+':'') + '$' + Math.abs(netPnl).toFixed(2) + '</div>' +
    '</div>' +
    '<div class="sel-summary-grid">' +
      '<div class="sel-sum-card"><div class="sel-sum-label">Win Rate</div><div class="sel-sum-val" style="color:var(--green)">' + wr + '%</div><div style="font-size:10px;color:var(--text3);margin-top:3px;font-family:\'JetBrains Mono\',monospace">' + wins.length + 'W &middot; ' + losses.length + 'L</div></div>' +
      '<div class="sel-sum-card"><div class="sel-sum-label">Avg per Trade</div><div class="sel-sum-val" style="color:' + (parseFloat(avgPnl)>=0?'var(--green)':'var(--red)') + '">' + (parseFloat(avgPnl)>=0?'+':'') + '$' + Math.abs(avgPnl) + '</div></div>' +
      '<div class="sel-sum-card"><div class="sel-sum-label">Avg Win</div><div class="sel-sum-val" style="color:var(--green)">' + (avgWin !== '—' ? '+$'+avgWin : '—') + '</div></div>' +
      '<div class="sel-sum-card"><div class="sel-sum-label">Avg Loss</div><div class="sel-sum-val" style="color:var(--red)">' + (avgLoss !== '—' ? '$'+avgLoss : '—') + '</div></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">' +
      '<div class="sel-sum-card"><div class="sel-sum-label">Best Trade</div><div style="font-family:\'Clash Display\',sans-serif;font-weight:700;font-size:16px;color:var(--green);margin-top:4px">+$' + best.pnl.toFixed(2) + '</div><div style="font-size:10px;color:var(--text3);font-family:\'JetBrains Mono\',monospace;margin-top:2px">' + best.symbol + ' &middot; ' + best.date + '</div></div>' +
      '<div class="sel-sum-card"><div class="sel-sum-label">Worst Trade</div><div style="font-family:\'Clash Display\',sans-serif;font-weight:700;font-size:16px;color:var(--red);margin-top:4px">$' + worst.pnl.toFixed(2) + '</div><div style="font-size:10px;color:var(--text3);font-family:\'JetBrains Mono\',monospace;margin-top:2px">' + worst.symbol + ' &middot; ' + worst.date + '</div></div>' +
    '</div>';
  m.classList.add('open');
}

// ── BULK EDIT ──
function selBulkEdit() {
  const rows = TRADES.filter(t => selectedIds.has(t.id));
  if (!rows.length) return;

  $('be-count-badge').textContent = rows.length + ' trade' + (rows.length !== 1 ? 's' : '');

  // Pull unique values from ALL trades for each field
  const unique = field => [...new Set(TRADES.map(t => t[field]).filter(Boolean))].sort();

  // Populate each custom dropdown list
  const beFillList = (field, values) => {
    const list = $('be-' + field + '-list');
    if (!list) return;
    // "Keep original" row first
    list.innerHTML = `<div class="mdl-opt" onclick="beSelect('${field}','')" style="color:var(--text3);font-style:italic">— keep original —</div>` +
      values.map(v =>
        `<div class="mdl-opt" onclick="beSelect('${field}','${v.replace(/'/g,"\\'")}')"><span class="mdl-opt-label">${v}</span></div>`
      ).join('');
  };

  // Also pull options visible in the main form lists (includes any custom-added ones)
  const fromFormList = (listId) => {
    const el = $(listId);
    if (!el) return [];
    return [...el.querySelectorAll('.mdl-opt-label')].map(e => e.textContent.trim()).filter(Boolean);
  };

  beFillList('account', [...new Set([...fromFormList('f-account-list'), ...unique('account')])].sort());
  beFillList('session', [...new Set([...fromFormList('f-session-list'), ...unique('session')])].sort());
  beFillList('setup',   [...new Set([...fromFormList('f-setup-list'),   ...unique('setup')])].sort());
  beFillList('model',   [...new Set([...fromFormList('f-model-list'),   ...unique('model')])].sort());

  // Reset all fields to "keep original"
  ['account','session','setup','model'].forEach(f => {
    $('be-' + f).value = '';
    const lbl = $('be-' + f + '-label');
    if (lbl) { lbl.textContent = '— keep original —'; lbl.style.color = 'var(--text3)'; }
    const trig = $('be-' + f + '-trigger');
    if (trig) trig.style.borderColor = 'var(--border)';
    const chev = $('be-' + f + '-chevron');
    if (chev) { chev.style.transform = ''; }
    const dd = $('be-' + f + '-dd');
    if (dd) dd.style.display = 'none';
  });

  // Reset rating
  $$('.be-rating-btn').forEach(b => {
    b.style.background = 'var(--bg4)';
    b.style.borderColor = 'var(--border)';
    b.style.color = 'var(--text3)';
  });
  $('be-preview-text').textContent = 'No changes selected';

  $('bulk-edit-overlay').style.display = 'flex';

  // Close dropdowns on outside click
  setTimeout(() => {
    document.addEventListener('click', beOutsideClick);
  }, 0);
}

function beOutsideClick(e) {
  const overlay = $('bulk-edit-overlay');
  if (!overlay || overlay.style.display === 'none') { document.removeEventListener('click', beOutsideClick); return; }
  ['account','session','setup','model'].forEach(f => {
    const dd = $('be-' + f + '-dd');
    const trig = $('be-' + f + '-trigger');
    if (dd && trig && !trig.contains(e.target) && !dd.contains(e.target)) {
      dd.style.display = 'none';
      $('be-' + f + '-chevron').style.transform = '';
    }
  });
}

function beToggleDd(field) {
  const dd   = $('be-' + field + '-dd');
  const chev = $('be-' + field + '-chevron');
  const isOpen = dd.style.display !== 'none';
  // Close all others first
  ['account','session','setup','model'].forEach(f => {
    $('be-' + f + '-dd').style.display = 'none';
    $('be-' + f + '-chevron').style.transform = '';
  });
  if (!isOpen) {
    dd.style.display = 'block';
    chev.style.transform = 'rotate(180deg)';
    // Reset arrow key index
    const list = $('be-' + field + '-list');
    if (list) {
      list._beIdx = -1;
      list.querySelectorAll('.mdl-opt').forEach(el => { el.style.background = ''; el.style.color = ''; });
    }
  }
}

function beFieldHover(field, el) {
  const val = $('be-' + field)?.value;
  const dd  = $('be-' + field + '-dd');
  if (!dd || dd.style.display !== 'none') return;
  el.style.borderColor = val ? 'var(--ac-50)' : 'var(--border)';
}

function beSelect(field, val) {
  $('be-' + field).value = val;
  const lbl = $('be-' + field + '-label');
  if (lbl) {
    lbl.textContent = val || '— keep original —';
    lbl.style.color = val ? 'var(--text)' : 'var(--text3)';
  }
  const trig = $('be-' + field + '-trigger');
  if (trig) trig.style.borderColor = val ? 'var(--ac-50)' : 'var(--border)';
  const dd = $('be-' + field + '-dd');
  if (dd) dd.style.display = 'none';
  const chev = $('be-' + field + '-chevron');
  if (chev) chev.style.transform = '';
  updateBePreview();
}

// ── Bulk edit arrow key navigation ──
function beGetActiveField() {
  return ['account','session','setup','model'].find(f =>
    $('be-' + f + '-dd')?.style.display !== 'none'
  ) || null;
}

function beHighlightItem(list, idx) {
  const items = list.querySelectorAll('.mdl-opt');
  items.forEach((el, i) => {
    el.style.background = i === idx ? 'var(--ac-20)' : '';
    el.style.color      = i === idx ? 'var(--text)' : '';
  });
  if (items[idx]) items[idx].scrollIntoView({ block: 'nearest' });
  list._beIdx = idx;
}

document.addEventListener('keydown', function(e) {
  if ($('bulk-edit-overlay')?.style.display !== 'flex') return;
  const field = beGetActiveField();
  if (!field) {
    // Arrow left/right on rating buttons
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const btns = [...$$('.be-rating-btn')];
      const cur  = btns.findIndex(b => b.style.borderColor.includes('107,31,212'));
      const next = e.key === 'ArrowRight'
        ? Math.min(btns.length - 1, (cur < 0 ? 0 : cur + 1))
        : Math.max(0, (cur < 0 ? btns.length - 1 : cur - 1));
      beSelectRating(btns[next]);
      e.preventDefault();
    }
    return;
  }
  const list  = $('be-' + field + '-list');
  const items = list?.querySelectorAll('.mdl-opt');
  if (!items?.length) return;
  const curIdx = list._beIdx ?? -1;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    beHighlightItem(list, Math.min(curIdx + 1, items.length - 1));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    beHighlightItem(list, Math.max(curIdx - 1, 0));
  } else if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    if (curIdx >= 0 && items[curIdx]) items[curIdx].click();
  }
}, true); // capture phase so it fires before the main handler

function beSelectRating(btn) {
  $$('.be-rating-btn').forEach(b => {
    b.style.background = 'var(--bg4)';
    b.style.borderColor = 'var(--border)';
    b.style.color = 'var(--text3)';
  });
  if (btn.dataset.val) {
    btn.style.background = 'var(--purple2)';
    btn.style.borderColor = 'var(--ac-50)';
    btn.style.color = 'var(--purple)';
  }
  updateBePreview();
}

function updateBePreview() {
  const changes = getBulkEditChanges();
  const keys = Object.keys(changes);
  if (!keys.length) {
    $('be-preview-text').textContent = 'No changes selected';
  } else {
    $('be-preview-text').textContent =
      'Will update: ' + keys.map(k => {
        const v = k === 'rating' ? changes[k] + '★' : changes[k];
        return k + ' → ' + v;
      }).join(' · ');
  }
}

function getBulkEditChanges() {
  const changes = {};
  ['account','session','setup','model'].forEach(f => {
    const v = $('be-' + f)?.value;
    if (v) changes[f] = v;
  });
  const ratingBtn = [...$$('.be-rating-btn')].find(b => b.style.background.includes('purple') || b.style.borderColor.includes('107,31,212'));
  if (ratingBtn && ratingBtn.dataset.val) changes.rating = parseInt(ratingBtn.dataset.val);
  return changes;
}

function applyBulkEdit() {
  const changes = getBulkEditChanges();
  if (!Object.keys(changes).length) { closeBulkEdit(); return; }

  // Snapshot for undo
  undoSnapshot = { trades: [...TRADES], filtered: [...filteredTrades] };

  const count = selectedIds.size;
  TRADES.forEach(t => {
    if (!selectedIds.has(t.id)) return;
    Object.assign(t, changes);
  });

  filteredTrades = [...TRADES];
  renderTrades(filteredTrades);
  populateDashboard();
  refreshAdvAnalytics();
  closeBulkEdit();
  disableSelectMode();

  // Show undo toast
  showUndoToast(count, true);
}

function closeBulkEdit() {
  $('bulk-edit-overlay').style.display = 'none';
  document.removeEventListener('click', beOutsideClick);
  ['account','session','setup','model'].forEach(f => {
    const dd = $('be-' + f + '-dd');
    if (dd) dd.style.display = 'none';
  });
}

function showUndoToast(count, isEdit) {
  const toast = $('undo-toast');
  const msg   = $('undo-toast-msg');
  msg.textContent = isEdit
    ? 'Updated ' + count + ' trade' + (count !== 1 ? 's' : '')
    : 'Deleted ' + count + ' trade' + (count !== 1 ? 's' : '');
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  toast.style.pointerEvents = 'all';
  const prog = $('undo-progress');
  if (prog) { prog.style.transition = 'none'; prog.style.width = '100%'; requestAnimationFrame(() => { prog.style.transition = 'width 4s linear'; prog.style.width = '0%'; }); }
  if (undoTimer) clearTimeout(undoTimer);
  undoTimer = setTimeout(hideUndoToast, 4000);
}

function calClear() {
  if (calActive === 'from') {
    calFromVal = '';
    const lbl = $('fp-from-label');
    if (lbl) { lbl.textContent = 'From'; $('fp-date-from-display').style.color='var(--text3)'; }
  } else {
    calToVal = '';
    const lbl = $('fp-to-label');
    if (lbl) { lbl.textContent = 'To'; $('fp-date-to-display').style.color='var(--text3)'; }
  }
  renderCal();
}
function calToday() { calPickDay(new Date().toISOString().slice(0,10)); }

/* ── OPTIONS MENU ── */
function toggleOptionsMenu() {
  const menu = $('options-menu');
  const isOpen = menu.style.display !== 'none';
  if (isOpen) {
    closeOptionsMenu();
  } else {
    menu.style.display = 'block';
    setTimeout(() => document.addEventListener('click', optionsOutsideClick), 0);
  }
}
function closeOptionsMenu() {
  const menu = $('options-menu');
  if (menu) menu.style.display = 'none';
  document.removeEventListener('click', optionsOutsideClick);
}
function optionsOutsideClick(e) {
  const wrap = $('options-wrap');
  if (wrap && !wrap.contains(e.target)) closeOptionsMenu();
}
function exportTrades() {
  selExportSelected();
}
const TL_TT_PERIODS = [
  { label: 'OVERALL',    sub: 'all time' },
  { label: 'TODAY',      sub: 'today' },
  { label: 'THIS WEEK',  sub: 'this week' },
  { label: 'THIS MONTH', sub: 'this month' },
];
let tlTtIndex = 0;
let tlTtTouchY = 0;

function tlTtRender(idx, dir) {
  const ticker = $('tl-tt-ticker');
  if (!ticker) return;
  ticker.style.transition = 'none';
  ticker.style.transform = `translateY(${dir * -36}px)`;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    ticker.style.transition = 'transform .28s cubic-bezier(.4,0,.2,1)';
    ticker.style.transform = `translateY(${-idx * 36}px)`;
  }));
  $('tl-tt-period-label').textContent = TL_TT_PERIODS[idx].label;
  $('tl-tt-sub-text').textContent = TL_TT_PERIODS[idx].sub;
  $$('.tl-tt-dot').forEach((d, i) => {
    d.style.background = i === idx ? 'var(--purple)' : 'var(--bg5)';
  });
}
function tlTtShift(dir) {
  tlTtIndex = (tlTtIndex + dir + TL_TT_PERIODS.length) % TL_TT_PERIODS.length;
  tlTtRender(tlTtIndex, dir);
}
function tlTtGoto(i) {
  const dir = i > tlTtIndex ? 1 : -1;
  tlTtIndex = i;
  tlTtRender(i, dir);
}


// ── Trade log scroll indicator ──
function tlogScrollRight() {
  const wrap = $('tlog-table-wrap');
  if (!wrap) return;
  wrap.scrollBy({ left: 200, behavior: 'smooth' });
}

function updateTlogScrollIndicator() {
  const wrap = $('tlog-table-wrap');
  const ind  = $('tlog-scroll-indicator');
  if (!wrap || !ind) return;
  const hasOverflow = wrap.scrollWidth > wrap.clientWidth + 4;
  const atEnd = wrap.scrollLeft + wrap.clientWidth >= wrap.scrollWidth - 4;
  ind.style.opacity = (!hasOverflow || atEnd) ? '0' : '1';
  ind.style.pointerEvents = (!hasOverflow || atEnd) ? 'none' : 'auto';
}
// Init on render
function initTlogScrollIndicator() {
  const wrap = $('tlog-table-wrap');
  const ind  = $('tlog-scroll-indicator');
  if (!wrap || !ind) return;
  const thead = wrap.querySelector('thead tr');
  if (thead) {
    const h = thead.offsetHeight || 34;
    ind.querySelector('div').style.height = h + 'px';
  }
  setTimeout(() => updateTlogScrollIndicator(), 100);
}

// ── Keyboard Shortcuts ──
document.addEventListener('keydown', function(e) {
  const tag = document.activeElement.tagName;
  const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement.isContentEditable;
  const modalOpen = $('modal-overlay').style.display === 'flex';
  const bulkEditOpen = $('bulk-edit-overlay').style.display === 'flex';
  
  // Check if ANY overlay/popup is open
  const anyPopupOpen = modalOpen || bulkEditOpen
    || $('pb-modal-overlay')?.style.display === 'flex'  // Playbook modal
    || $('add-account-overlay')?.style.display === 'flex'  // Add account modal
    || $('acct-modal-overlay')?.style.display === 'flex'  // Account modal
    || $('incomplete-confirm-overlay')?.style.display === 'flex'  // Incomplete confirm
    || $('col-editor-overlay')?.style.display === 'flex'  // Column editor
    || $('cmdk-overlay')?.style.display === 'flex';  // Command palette
  
  // Block number shortcuts (1-9) when ANY popup is open — but NOT when user is typing in an input
  if ((e.key >= '1' && e.key <= '9') && anyPopupOpen && !isTyping) {
    e.preventDefault();
    return;
  }

  // Backspace: close detail and go back to origin view (e.g. dashboard after chart click)
  if (e.key === 'Backspace' && !isTyping && !modalOpen && !bulkEditOpen) {
    const dp = $('detail-panel');
    if (dp.classList.contains('open')) {
      closeDetail();
      if (_detailOriginView) {
        const originNav = document.querySelector(`.nav-item[data-view="${_detailOriginView}"]`);
        if (originNav) originNav.click();
        _detailOriginView = null;
      }
      e.preventDefault();
      return;
    }
  }

  // Ctrl/Cmd+Enter — save trade if modal open (or trigger modal's save action)
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    if (modalOpen) {
      e.preventDefault();
      saveTrade();
      return;
    }
    // Could add other modal save handlers here if needed
    return;  // Prevent default behavior when any popup is open
  }

  // Enter — save trade if modal open (allow from input fields, but not textarea/select)
  if (e.key === 'Enter' && modalOpen) {
    const tag = document.activeElement.tagName;
    const isInTextarea = tag === 'TEXTAREA' || document.activeElement.isContentEditable;
    if (!isInTextarea) {
      e.preventDefault();
      
      // Block keyboard handler from calling saveTrade at all if already attempted recently
      const now = Date.now();
      if (now - _lastSaveAttemptTime < 1000) {
        console.warn(`Save already attempted ${now - _lastSaveAttemptTime}ms ago, blocking Enter press`);
        return;
      }
      
      // Update last attempt time BEFORE calling saveTrade
      _lastSaveAttemptTime = now;
      saveTrade();
      return;
    }
  }

  // Always: Escape - close ANY open popup/overlay
  if (e.key === 'Escape') {
    // Close bulk edit dropdown first if open
    if (bulkEditOpen) {
      const anyDdOpen = ['account','session','setup','model'].some(f =>
        $('be-' + f + '-dd')?.style.display !== 'none'
      );
      if (anyDdOpen) {
        ['account','session','setup','model'].forEach(f => {
          $('be-' + f + '-dd').style.display = 'none';
          $('be-' + f + '-chevron').style.transform = '';
        });
        return;
      }
      closeBulkEdit(); return;
    }
    
    // Close any other popups
    if (selectModeActive) { disableSelectMode(); return; }
    if (modalOpen) { closeModal(); return; }
    if ($('kb-help-overlay')?.style.display === 'flex') { kbHelpClose(); return; }
    if ($('pb-modal-overlay')?.style.display === 'flex') { closePbModal?.(); return; }  // Playbook modal
    if ($('add-account-overlay')?.style.display === 'flex') { closeLegacyAddAccountModal?.(); return; }  // Add account
    if ($('acct-modal-overlay')?.style.display === 'flex') { closeAccountModal?.(); return; }  // Account modal
    if ($('incomplete-confirm-overlay')?.style.display === 'flex') { incompleteCancel?.(); return; }  // Incomplete confirm
    if ($('col-editor-overlay')?.style.display === 'flex') { closeColumnEditor?.(); return; }  // Column editor
    if ($('cmdk-overlay')?.style.display === 'flex') { closeCmdK?.(); return; }  // Command palette
  }

  // Enter in bulk edit = select highlighted dropdown item, or apply if no dropdown open
  if (e.key === 'Enter' && bulkEditOpen && !isTyping) {
    e.preventDefault();
    if (!beGetActiveField()) applyBulkEdit(); // only apply when no dropdown is open
    return;
  }

  // Always: / = show help (but not if popup is open)
  if (e.key === '/' && !isTyping && !anyPopupOpen) { e.preventDefault(); kbHelpToggle(); return; }

  // Block all other shortcuts while typing or ANY popup is open
  if (isTyping || anyPopupOpen) return;

  switch (e.key) {
    case 'n': case 'N':
      e.preventDefault();
      openModal();
      break;
    case 'd': case 'D':
      e.preventDefault();
      toggleTheme();
      break;
    case '1':
      document.querySelector('[data-view="dashboard"]')?.click(); break;
    case '2':
      document.querySelector('[data-view="tradelog"]')?.click(); break;
    case '3':
      document.querySelector('[data-view="analytics"]')?.click(); break;
    case '4':
      document.querySelector('[data-view="advanalytics"]')?.click(); break;
    case '5':
      document.querySelector('[data-view="playbook"]')?.click(); break;
    case '6':
      document.querySelector('[data-view="accounts"]')?.click(); break;
    case '7':
      document.querySelector('[data-view="calendar"]')?.click(); break;
    case '8':
      document.querySelector('[data-view="reports"]')?.click(); break;
    case '9':
      document.querySelector('[data-view="settings"]')?.click(); break;
    case ',':
      e.preventDefault();
      if (typeof window._histBack === 'function') window._histBack(); break;
    case '.':
      e.preventDefault();
      if (typeof window._histForward === 'function') window._histForward(); break;
  }
});

// ── Theme Toggle ──
function toggleTheme() {
  const cl = document.documentElement.classList;
  const cur = cl.contains('light') ? 'light' : cl.contains('medium') ? 'medium' : 'dark';
  const next = cur === 'dark' ? 'light' : cur === 'light' ? 'medium' : 'dark';
  // Preserve scroll position — theme switch can cause jump
  const savedScroll = window.scrollY;
  setThemeMode(next);
  const isLight = next === 'light';
  
  try {
    if (equityChartInstance) { equityChartInstance.destroy(); equityChartInstance = null; initEquityChart(); }
  } catch (e) { console.warn('Error updating equity chart:', e); }
  
  try {
    if (dailyPnlChartInstance) { dailyPnlChartInstance.destroy(); dailyPnlChartInstance = null; }
    // Reinit then reapply the previously active filter so data isn't lost
    initDailyPnlChart();
    if (dailyPnlActiveMode && dailyPnlActiveMode !== 'this-week') {
      filterDailyPnl(dailyPnlActiveMode);
    }
  } catch (e) { console.warn('Error updating daily PnL chart:', e); }
  
  
  // Update hour chart if it exists
  try {
    if (hourChartInstance) {
      const isMed = next === 'medium';
      const axisTickColor = isLight ? 'rgba(10,11,16,.6)' : (isMed ? 'rgba(221,225,239,.65)' : 'rgba(221,225,239,.4)');
      const gridColor = isLight ? 'rgba(0,0,0,.06)' : (isMed ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.03)');
      
      hourChartInstance.options.scales.x.ticks.color = axisTickColor;
      hourChartInstance.options.scales.y.ticks.color = axisTickColor;
      hourChartInstance.options.scales.y.grid.color = gridColor;
      hourChartInstance.update();
    }
  } catch (e) { console.warn('Error updating hour chart:', e); }

  // Reinitialize all advanced analytics charts so they pick up the new theme
  try {
    const activeView = document.querySelector('.view.active');
    if (activeView?.id === 'view-analytics') {
      analyticsInitialized = false;
      initAnalyticsCharts();
    }
    if (activeView?.id === 'view-advanalytics') {
      refreshAdvAnalytics();
    }
  } catch (e) { console.warn('Error updating adv analytics charts:', e); }
  // Restore scroll position after theme switch
  // Double rAF ensures all DOM reflows from chart re-init are complete first
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: savedScroll, behavior: 'instant' });
    });
  });
}
// ── FAQ Toggles ──
function faqToggleGroup(header) {
  const body = header.nextElementSibling;
  const chevron = header.querySelector('.faq-group-chevron');
  const isOpen = body.style.display === 'block';
  body.style.display = isOpen ? 'none' : 'block';
  chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
}
function faqToggleItem(item) {
  item.classList.toggle('open');
}

// Apply saved theme on load
(function() {
  const saved = localStorage.getItem('et-theme');
  if (saved === 'light')  document.documentElement.classList.add('light');
  if (saved === 'medium') document.documentElement.classList.add('medium');
})();

function kbHelpToggle() {
  const el = $('kb-help-overlay');
  el.style.display = el.style.display === 'flex' ? 'none' : 'flex';
}
function kbHelpClose() {
  $('kb-help-overlay').style.display = 'none';
}

// ═══════════════════════════════════════════════════════
// ACCOUNTS PAGE — Full CRUD + Leverage Per Instrument
// ═══════════════════════════════════════════════════════

let _acmEditId = null;   // null = add mode, number = edit mode
let _acmActive = true;

function updatePhaseFields() {
  try {
    const phaseType = $('acm-phase') ? $('acm-phase').value : '';
    const profitCol = $('acm-profit-target-col');
    const multiPhaseSection = $('acm-multi-phase-targets');
    const currentPhaseInput = $('acm-current-phase');
    
    // Hide profit target for Instant and Funded challenges
    if (profitCol) profitCol.style.display = (phaseType === 'Instant' || phaseType === 'Funded') ? 'none' : '';
    
    // Hide current phase for Funded challenges
    if (currentPhaseInput) {
      currentPhaseInput.parentElement.style.display = phaseType === 'Funded' ? 'none' : '';
      if (phaseType !== 'Funded') currentPhaseInput.value = '1';
    }
    
    // Show multi-phase section for 2 Phase and 3 Phase, and hide for others
    if (multiPhaseSection) {
      multiPhaseSection.style.display = (phaseType === '2 Phase' || phaseType === '3 Phase') ? '' : 'none';
    }
    
    // Show/hide phase rows based on challenge type
    const phase2Row = $('acm-phase2-target-row');
    const phase3Row = $('acm-phase3-target-row');
    if (phase2Row) phase2Row.style.display = phaseType === '2 Phase' || phaseType === '3 Phase' ? '' : 'none';
    if (phase3Row) phase3Row.style.display = phaseType === '3 Phase' ? '' : 'none';
  } catch (e) {
    console.warn('updatePhaseFields error:', e);
  }
}

function checkAndCreateNextPhase(accountName) {
  try {
    if (!accountName || !ACCOUNTS) return;
    
    const account = ACCOUNTS.find(a => (a.key || a.phase) === accountName || a.phase === accountName);
    if (!account || !account.challengeType || account.challengeType === 'Instant') return;
    
    // Get all trades for this account
    const accountTrades = TRADES.filter(t => t.account === accountName);
    if (accountTrades.length === 0) return;
    
    // Calculate cumulative P&L
    const totalPnL = accountTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const profitTargetPercent = account.profitTarget || 8;
    const profitTargetAmount = (account.startBal * profitTargetPercent) / 100;
    
    // Check if profit target reached and next phase doesn't exist
    if (totalPnL >= profitTargetAmount && account.currentPhase < 3) {
      const totalPhases = parseInt(account.challengeType.split(' ')[0]) || 1;
      if (account.currentPhase < totalPhases) {
        // Auto-create next phase
        const nextPhaseNum = account.currentPhase + 1;
        const nextPhaseAccount = {
          id: Date.now(),
          firm: account.firm,
          phase: `${account.firm} - Phase ${nextPhaseNum}`,
          key: `${account.firm} - Phase ${nextPhaseNum}`.replace(/\s+/g, ' ').trim(),
          balance: '$' + account.startBal.toFixed(2),
          active: true,
          startBal: account.startBal,
          challengeType: account.challengeType,
          currentPhase: nextPhaseNum,
          phaseTargets: account.phaseTargets,
          maxDrawdown: account.maxDrawdown,
          dailyLoss: account.dailyLoss,
          profitTarget: account.phaseTargets && account.phaseTargets[nextPhaseNum] ? account.phaseTargets[nextPhaseNum] : 8,
          ddType: account.ddType,
          notes: account.notes + ` [Auto-created from Phase ${account.currentPhase}]`,
          leverage: account.leverage,
          nextPhaseId: null,
          prevPhaseId: account.id
        };
        ACCOUNTS.push(nextPhaseAccount);
        account.nextPhaseId = nextPhaseAccount.id;
        saveAccounts();
        showToast(`🎉 Phase ${nextPhaseNum} account auto-created!`, 'success', '✓', 3000);
        // Only refresh Accounts page if it's currently active
        if (typeof renderAccountsPage === 'function') {
          renderAccountsPage();
        }
        // ── Sync the Add Trade modal account list ──
        if (typeof syncTradeModalAccountList === 'function') {
          syncTradeModalAccountList();
        }
      }
    }
  } catch (e) {
    console.warn('checkAndCreateNextPhase error:', e);
  }
}

// ── Account Labels (FCFS auto-numbering, user-editable) ──────
const ACCT_LABELS_KEY = 'et-acct-labels';

function loadAcctLabels() {
  try { return JSON.parse(localStorage.getItem(ACCT_LABELS_KEY) || '{}'); } catch(e) { return {}; }
}
function saveAcctLabels(obj) {
  try { localStorage.setItem(ACCT_LABELS_KEY, JSON.stringify(obj)); } catch(e) {}
}

// Assigns a sequential FCFS number to any account that doesn't yet have one
function ensureAcctLabels() {
  const labels = loadAcctLabels();
  let changed = false;
  let maxOrder = Object.values(labels).reduce((m, v) => {
    const n = parseInt(v.order); return (!isNaN(n) && n > m) ? n : m;
  }, 0);
  ACCOUNTS.forEach(a => {
    const key = String(a.id);
    if (!labels[key]) {
      maxOrder++;
      labels[key] = { order: maxOrder, display: String(maxOrder) };
      changed = true;
    }
  });
  if (changed) saveAcctLabels(labels);
  return labels;
}

// Opens an inline prompt so the user can rename the badge to any number or text
function editAcctLabel(id) {
  const labels = loadAcctLabels();
  const key = String(id);
  const current = (labels[key] && labels[key].display) ? labels[key].display : String(labels[key] ? labels[key].order : '');
  showInlinePrompt('Account Label / Number', current, function(val) {
    if (val === null) return;
    const trimmed = val.trim();
    if (!trimmed) return;
    const labs = loadAcctLabels();
    if (!labs[key]) labs[key] = { order: 0, display: trimmed };
    else labs[key].display = trimmed;
    saveAcctLabels(labs);
    renderAccountsPage();
  });
}

// ── Lightweight inline confirm (fallback when confirm-modal is absent) ──
function _showInlineConfirm(bodyHtml, okLabel, callback) {
  let ov = document.getElementById('_inline-confirm-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = '_inline-confirm-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center';
    document.body.appendChild(ov);
  }
  ov.innerHTML = `
    <div onclick="event.stopPropagation()" style="background:var(--bg2);border:1px solid var(--border2);border-radius:14px;width:380px;max-width:94vw;padding:26px 24px;box-shadow:0 32px 80px rgba(0,0,0,.6)">
      <div style="font-size:13px;color:var(--text2);font-family:var(--font-body);line-height:1.6;margin-bottom:22px">${bodyHtml}</div>
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button onclick="document.getElementById('_inline-confirm-ov').remove()" style="padding:8px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg4);color:var(--text2);font-family:var(--font-body);font-size:13px;font-weight:600;cursor:pointer;transition:all .15s">Cancel</button>
        <button id="_inline-confirm-ok" style="padding:8px 20px;border-radius:9px;border:none;background:rgba(232,80,74,.9);color:#fff;font-family:var(--font-body);font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 0 14px rgba(232,80,74,.35)">${okLabel}</button>
      </div>
    </div>`;
  ov.style.display = 'flex';
  document.getElementById('_inline-confirm-ok').onclick = function() {
    ov.remove();
    callback && callback();
  };
  ov.onclick = function(e) { if (e.target === ov) ov.remove(); };
}

// Unified confirm helper — uses confirm-modal if present, else _showInlineConfirm
function _acctConfirm(title, bodyHtml, okLabel, callback) {
  const modal = document.getElementById('confirm-modal');
  if (modal && typeof showConfirmModal === 'function') {
    showConfirmModal(title, bodyHtml, okLabel, 'Cancel', 'danger', callback);
  } else {
    _showInlineConfirm(bodyHtml, okLabel, callback);
  }
}

function renderAccountsPage() {
  try {
    const grid  = $('accounts-page-grid');
    const empty = $('accounts-page-empty');
    if (!grid) return;

    // Filter out hidden accounts
    const visibleAccounts = ACCOUNTS.filter(a => !hiddenAccountIds.has(a.id));

    if (!ACCOUNTS || ACCOUNTS.length === 0) {
      grid.innerHTML  = '';
      grid.style.display  = 'none';
      if (empty) empty.style.display = 'block';
      updateHiddenCount();
      return;
    }
    
    if (visibleAccounts.length === 0 && ACCOUNTS.length > 0) {
      // All accounts are hidden
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 0;color:var(--text3);font-family:var(--font-mono);font-size:13px">All accounts are hidden. Click Options → Show Hidden to view them.</div>';
      grid.style.display = 'grid';
      if (empty) empty.style.display = 'none';
      updateHiddenCount();
      return;
    }
    
    if (empty) empty.style.display = 'none';
    grid.style.display  = 'grid';

  // Inject card styles once
  if (!document.getElementById('acct-page-card-styles')) {
    const s = document.createElement('style');
    s.id = 'acct-page-card-styles';
    s.textContent = `
      .acct-page-card { transition: border-color .22s, box-shadow .22s, transform .18s; }
      .acct-page-card:hover { transform: translateY(-2px); }
      .acct-page-card:hover .acct-card-glow { opacity: 1 !important; }

      .acct-page-card.status-challenge:hover {
        border-color: var(--ac-50) !important;
        box-shadow: 0 0 0 1px var(--ac-20), 0 8px 32px rgba(0,0,0,.4), 0 0 48px rgba(139,81,245,.18) !important;
      }
      .acct-page-card.status-funded:hover {
        border-color: rgba(52,211,153,.55) !important;
        box-shadow: 0 0 0 1px rgba(52,211,153,.15), 0 8px 32px rgba(0,0,0,.4), 0 0 48px rgba(52,211,153,.18) !important;
      }
      .acct-page-card.status-breached:hover {
        border-color: rgba(239,68,68,.55) !important;
        box-shadow: 0 0 0 1px rgba(239,68,68,.15), 0 8px 32px rgba(0,0,0,.4), 0 0 48px rgba(239,68,68,.18) !important;
      }

      .acct-action-btn { display:flex;align-items:center;justify-content:center;gap:6px;padding:7px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);font-family:var(--font-body);font-size:12px;font-weight:500;cursor:pointer;transition:all .15s; }
      .acct-action-btn.edit  { flex:1;color:var(--text2); }
      .acct-action-btn.edit:hover  { background:var(--ac-12);border-color:var(--ac-40);color:#b891f5; }
      .acct-action-btn.dupe  { flex:1;color:var(--text2); }
      .acct-action-btn.dupe:hover  { background:var(--blue2);border-color:rgba(77,142,240,.4);color:var(--blue); }
      .acct-action-btn.del   { color:var(--text3); }
      .acct-action-btn.del:hover   { background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.4);color:var(--red); }

      .acct-num-badge {
        display:inline-flex;align-items:center;justify-content:center;
        min-width:24px;height:22px;padding:0 7px;border-radius:6px;
        background:var(--bg4);border:1px solid var(--border);
        font-family:var(--font-mono);font-size:10px;font-weight:700;color:var(--text3);
        cursor:pointer;transition:all .15s;flex-shrink:0;user-select:none;
      }
      .acct-num-badge:hover { background:var(--ac-12);border-color:var(--ac-40);color:#b891f5; }
      
      .acct-select-checkbox {
        width:20px;height:20px;border-radius:6px;border:2px solid var(--border);
        background:transparent;cursor:pointer;transition:all .15s;
        display:flex;align-items:center;justify-content:center;
        flex-shrink:0;
      }
      .acct-select-checkbox:hover {
        border-color:var(--ac-50);background:var(--ac-10);
      }
    `;
    document.head.appendChild(s);
  }

  // Ensure all accounts have a label assigned (FCFS)
  const labels = ensureAcctLabels();

  // ── Split visible accounts into Active, Passed, and Breached sections ──
  function computeStatus(a) {
    const acctName   = a.key || a.phase;
    const acctTrades = TRADES.filter(t => (t.account || '') === acctName);
    const netPnl     = acctTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const ml = (a.startBal || 0) * ((a.maxDrawdown || 8) / 100);
    const dl = (a.startBal || 0) * ((a.dailyLoss   || 4) / 100);
    const pt = (a.startBal || 0) * ((a.profitTarget || 0) / 100);
    const dayMap = {};
    acctTrades.forEach(t => { dayMap[t.date] = (dayMap[t.date] || 0) + t.pnl; });
    const worstDay = Math.min(0, ...Object.values(dayMap).concat([0]));
    if (netPnl <= -ml || Math.abs(worstDay) >= dl) return 'breached';
    if (a.profitTarget > 0 && netPnl >= pt) return 'passed';
    return 'active';
  }

  function computeBreachReason(a) {
    const acctName   = a.key || a.phase;
    const acctTrades = TRADES.filter(t => (t.account || '') === acctName);
    const netPnl     = acctTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const ml = (a.startBal || 0) * ((a.maxDrawdown || 8) / 100);
    const dl = (a.startBal || 0) * ((a.dailyLoss   || 4) / 100);
    const dayMap = {};
    acctTrades.forEach(t => { dayMap[t.date] = (dayMap[t.date] || 0) + t.pnl; });
    const worstDayPnl = Math.min(0, ...Object.values(dayMap).concat([0]));
    const worstDate = Object.entries(dayMap).find(([d, p]) => p === worstDayPnl)?.[0] || '';
    const reasons = [];
    if (netPnl <= -ml) {
      reasons.push(`Max drawdown exceeded — lost $${Math.abs(netPnl).toFixed(2)} of $${ml.toFixed(2)} limit`);
    }
    if (Math.abs(worstDayPnl) >= dl) {
      reasons.push(`Daily loss limit hit on ${worstDate} — lost $${Math.abs(worstDayPnl).toFixed(2)} (limit $${dl.toFixed(2)})`);
    }
    return reasons;
  }

  const activeAccounts   = visibleAccounts.filter(a => computeStatus(a) === 'active');
  const passedAccounts   = visibleAccounts.filter(a => computeStatus(a) === 'passed');
  const breachedAccounts = visibleAccounts.filter(a => computeStatus(a) === 'breached');

  function renderCardHtml(a) {
    const acctName   = a.key || a.phase;
    const acctTrades = TRADES.filter(t => (t.account || '') === acctName);
    const netPnl     = acctTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const pnlColor   = netPnl >= 0 ? 'var(--green)' : 'var(--red)';
    const pnlStr     = (netPnl >= 0 ? '+' : '-') + '$' + Math.abs(netPnl).toFixed(2);

    // Compute status: breached / passed / active
    const ml = (a.startBal || 0) * ((a.maxDrawdown || 8) / 100);
    const dl = (a.startBal || 0) * ((a.dailyLoss   || 4) / 100);
    const pt = (a.startBal || 0) * ((a.profitTarget || 0) / 100);
    const dayMap = {};
    acctTrades.forEach(t => { dayMap[t.date] = (dayMap[t.date] || 0) + t.pnl; });
    const worstDay = Math.min(0, ...Object.values(dayMap).concat([0]));
    let status = 'active';
    if (netPnl <= -ml || Math.abs(worstDay) >= dl) status = 'breached';
    else if (a.profitTarget > 0 && netPnl >= pt)   status = 'passed';

    // Calculate margin metrics
    const currentBalance = (a.startBal || 0) + netPnl;
    const marginUsedPct = ml > 0 ? Math.max(0, Math.min(100, (Math.abs(netPnl) / ml) * 100)).toFixed(1) : 0;
    const marginUsedColor = marginUsedPct >= 80 ? 'var(--red)' : marginUsedPct >= 50 ? 'var(--amber)' : 'var(--green)';
    const freMarginColor = currentBalance < 0 ? 'var(--red)' : currentBalance < (a.startBal || 0) * 0.5 ? 'var(--amber)' : 'var(--green)';

    // Status badge + glow colours
    const statusBadge = status === 'breached'
      ? '<span style="font-size:9px;font-family:var(--font-mono);font-weight:700;letter-spacing:.06em;padding:2px 8px;border-radius:5px;background:rgba(239,68,68,.12);color:var(--red);border:1px solid rgba(239,68,68,.3)">BREACHED</span>'
      : status === 'passed'
      ? '<span style="font-size:9px;font-family:var(--font-mono);font-weight:700;letter-spacing:.06em;padding:2px 8px;border-radius:5px;background:var(--ac-12);color:#b891f5;border:1px solid var(--ac-30)">PASSED</span>'
      : '<span style="font-size:9px;font-family:var(--font-mono);font-weight:700;letter-spacing:.06em;padding:2px 8px;border-radius:5px;background:var(--ac-12);color:#b891f5;border:1px solid var(--ac-30)">ACTIVE</span>';

    const glowRgba = status === 'passed'   ? 'rgba(184,145,245,.16)'
                   : status === 'breached' ? 'rgba(239,68,68,.16)'
                   :                        'rgba(139,81,245,.16)';

    const typeBg    = a.type === 'LIVE' ? 'var(--green2)' : 'var(--blue2)';
    const typeColor = a.type === 'LIVE' ? 'var(--green)'  : 'var(--blue)';
    const lev = a.leverage || {};

    // FCFS account number/label badge
    const labelData    = labels[String(a.id)];
    const displayLabel = labelData ? labelData.display : '?';
    
    // Selection checkbox (only in select mode)
    const isSelected = selectedAccountIds.has(a.id);
    const checkboxHtml = acctSelectMode ? `
      <div class="acct-select-checkbox" id="acct-checkbox-${a.id}" onclick="event.stopPropagation();toggleAccountSelection(${a.id})" style="position:absolute;top:16px;left:16px;z-index:10;${isSelected ? 'background:var(--purple);border-color:var(--purple)' : ''}">
        ${isSelected ? '<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-6" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
      </div>` : '';

    return `
    <div class="acct-page-card status-${status}"
      style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:20px;cursor:pointer;position:relative;">

      ${checkboxHtml}

      <!-- Glow layer -->
      <div class="acct-card-glow" style="pointer-events:none;position:absolute;inset:0;border-radius:16px;opacity:0;transition:opacity .22s;background:radial-gradient(ellipse at 50% 0%,${glowRgba} 0%,transparent 68%)"></div>

      <!-- Card header -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;position:relative" onclick="${acctSelectMode ? `toggleAccountSelection(${a.id})` : `openEditAccountModal(${a.id})`}">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:5px">
            <!-- FCFS number badge — click to rename -->
            <span class="acct-num-badge" onclick="event.stopPropagation();${acctSelectMode ? '' : `editAcctLabel(${a.id})`}" title="Click to rename label">#${displayLabel}</span>
            <div style="font-family:var(--font-display);font-size:15px;font-weight:700;color:var(--text)">${a.firm}</div>
            ${status === 'breached' ? (() => {
              const phaseStr = (a.phase || '').toLowerCase();
              const isChallenge = /phase [123]|eval|challenge/i.test(phaseStr) && !/funded/i.test(phaseStr);
              const pLabel = isChallenge ? 'CHALLENGE' : 'FUNDED';
              const pBg    = isChallenge ? 'var(--ac-12)' : 'rgba(52,211,153,.12)';
              const pColor = isChallenge ? '#b891f5'      : 'var(--green)';
              const pBorder= isChallenge ? 'var(--ac-30)' : 'rgba(52,211,153,.3)';
              return `<span style="font-size:9px;font-family:var(--font-mono);font-weight:700;letter-spacing:.06em;padding:2px 8px;border-radius:5px;background:${pBg};color:${pColor};border:1px solid ${pBorder}">${pLabel}</span>`;
            })() : ''}
            ${statusBadge}
          </div>
          <div style="font-size:11px;color:var(--text3);font-family:var(--font-mono)">${a.phase}</div>
        </div>
        <div style="font-family:var(--font-mono);font-size:17px;font-weight:700;color:${pnlColor};margin-left:12px;white-space:nowrap">${pnlStr}</div>
      </div>

      <!-- Balance / DD type -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;position:relative" onclick="${acctSelectMode ? `toggleAccountSelection(${a.id})` : `openEditAccountModal(${a.id})`}">
        <div style="background:var(--bg3);border-radius:9px;padding:10px 14px">
          <div style="font-size:10px;color:var(--text4);font-family:var(--font-mono);letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px">Balance</div>
          <div style="font-size:14px;font-weight:700;color:var(--text);font-family:var(--font-mono)">$${Number(a.startBal||0).toLocaleString()}</div>
        </div>
        <div style="background:var(--bg3);border-radius:9px;padding:10px 14px">
          <div style="font-size:10px;color:var(--text4);font-family:var(--font-mono);letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px">DD Type</div>
          <div style="font-size:14px;font-weight:700;color:var(--text2);font-family:var(--font-mono)">${(a.ddType||'trailing').charAt(0).toUpperCase()+(a.ddType||'trailing').slice(1)}</div>
        </div>
      </div>

      <!-- Margin / Free Margin -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;position:relative" onclick="${acctSelectMode ? `toggleAccountSelection(${a.id})` : `openEditAccountModal(${a.id})`}">
        <div style="background:var(--bg3);border-radius:9px;padding:10px 14px">
          <div style="font-size:10px;color:var(--text4);font-family:var(--font-mono);letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px">Margin Used</div>
          <div style="font-size:14px;font-weight:700;color:${marginUsedColor};font-family:var(--font-mono)">${marginUsedPct}% of ${a.maxDrawdown||8}%</div>
        </div>
        <div style="background:var(--bg3);border-radius:9px;padding:10px 14px">
          <div style="font-size:10px;color:var(--text4);font-family:var(--font-mono);letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px">Free Margin</div>
          <div style="font-size:14px;font-weight:700;color:${freMarginColor};font-family:var(--font-mono)">$${Number(currentBalance).toLocaleString()}</div>
        </div>
      </div>

      <!-- Rules chips -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;position:relative" onclick="${acctSelectMode ? `toggleAccountSelection(${a.id})` : `openEditAccountModal(${a.id})`}">
        <span style="font-size:11px;font-family:var(--font-mono);color:var(--text2);background:var(--bg3);padding:4px 10px;border-radius:6px;border:1px solid var(--border);font-weight:600">Max DD: ${a.maxDrawdown||8}%</span>
        <span style="font-size:11px;font-family:var(--font-mono);color:var(--text2);background:var(--bg3);padding:4px 10px;border-radius:6px;border:1px solid var(--border);font-weight:600">Daily: ${a.dailyLoss||4}%</span>
        ${a.profitTarget ? `<span style="font-size:11px;font-family:var(--font-mono);color:var(--text2);background:var(--bg3);padding:4px 10px;border-radius:6px;border:1px solid var(--border);font-weight:600">Target: ${a.profitTarget}%</span>` : ''}
      </div>

      <!-- Leverage chips -->
      ${(lev.forex||lev.metals||lev.futures||lev.crypto||lev.stocks||lev.indices) ? `
      <div style="display:flex;gap:6px;flex-wrap:wrap;padding-bottom:14px;border-bottom:1px solid var(--border);margin-bottom:14px;position:relative" onclick="${acctSelectMode ? `toggleAccountSelection(${a.id})` : `openEditAccountModal(${a.id})`}">
        ${lev.forex   ? `<span style="font-size:9px;font-family:var(--font-mono);color:var(--blue);background:var(--blue2);padding:2px 7px;border-radius:4px">Forex 1:${lev.forex}</span>` : ''}
        ${lev.metals  ? `<span style="font-size:9px;font-family:var(--font-mono);color:var(--amber);background:var(--amber2);padding:2px 7px;border-radius:4px">Metals 1:${lev.metals}</span>` : ''}
        ${lev.futures ? `<span style="font-size:9px;font-family:var(--font-mono);color:var(--green);background:var(--green2);padding:2px 7px;border-radius:4px">Futures 1:${lev.futures}</span>` : ''}
        ${lev.crypto  ? `<span style="font-size:9px;font-family:var(--font-mono);color:#b891f5;background:var(--ac-12);padding:2px 7px;border-radius:4px">Crypto 1:${lev.crypto}</span>` : ''}
        ${lev.stocks  ? `<span style="font-size:9px;font-family:var(--font-mono);color:var(--text2);background:var(--bg3);border:1px solid var(--border);padding:2px 7px;border-radius:4px">Stocks 1:${lev.stocks}</span>` : ''}
        ${lev.indices ? `<span style="font-size:9px;font-family:var(--font-mono);color:var(--text2);background:var(--bg3);border:1px solid var(--border);padding:2px 7px;border-radius:4px">Indices 1:${lev.indices}</span>` : ''}
      </div>` : ''}

      ${a.notes ? `<div style="font-size:11px;color:var(--text3);font-family:var(--font-body);padding-bottom:14px;border-bottom:1px solid var(--border);margin-bottom:14px;line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;position:relative" onclick="${acctSelectMode ? `toggleAccountSelection(${a.id})` : `openEditAccountModal(${a.id})`}">${a.notes}</div>` : ''}

      ${status === 'breached' ? (() => {
        const reasons = computeBreachReason(a);
        return reasons.length ? `<div style="margin-bottom:14px;padding:10px 12px;border-radius:9px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25)">
          <div style="font-family:var(--font-mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--red);font-weight:700;margin-bottom:6px">⚠ Breach Reason${reasons.length > 1 ? 's' : ''}</div>
          ${reasons.map(r => `<div style="font-size:11px;color:rgba(239,68,68,.85);font-family:var(--font-body);line-height:1.5">• ${r}</div>`).join('')}
        </div>` : '';
      })() : ''}

      <!-- Action buttons -->
      ${!acctSelectMode ? `
      <div style="display:flex;gap:8px;position:relative">
        <button class="acct-action-btn edit" onclick="event.stopPropagation();openEditAccountModal(${a.id})">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
          Edit
        </button>
        <button class="acct-action-btn dupe" onclick="event.stopPropagation();duplicateAccountCard(${a.id})">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M2 10V2h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Duplicate
        </button>
        <button class="acct-action-btn del" onclick="event.stopPropagation();deleteAccountCard(${a.id})" title="Delete account">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><polyline points="2,4 12,4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M5 4V2.5h4V4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M3 4l.8 7.5h6.4L11 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>` : ''}
    </div>`;
  }

  // ── Render Active section ──
  let sectionsHtml = '';

  if (activeAccounts.length > 0) {
    sectionsHtml += `
      <div style="grid-column:1/-1;display:flex;align-items:center;gap:12px;margin-bottom:4px;margin-top:4px">
        <span style="font-family:var(--font-mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--green);font-weight:700">● Active</span>
        <span style="font-family:var(--font-mono);font-size:10px;color:var(--text4)">${activeAccounts.length} account${activeAccounts.length !== 1 ? 's' : ''}</span>
        <div style="flex:1;height:1px;background:linear-gradient(90deg,rgba(52,211,153,.35),transparent)"></div>
      </div>
    `;
    sectionsHtml += activeAccounts.map(a => renderCardHtml(a)).join('');
  }

  // ── Render Passed challenges section ──
  if (passedAccounts.length > 0) {
    sectionsHtml += `
      <div style="grid-column:1/-1;display:flex;align-items:center;gap:12px;margin-bottom:4px;margin-top:${activeAccounts.length > 0 ? '16px' : '4px'}">
        <span style="font-family:var(--font-mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#b891f5;font-weight:700">✓ Passed Challenges</span>
        <span style="font-family:var(--font-mono);font-size:10px;color:var(--text4)">${passedAccounts.length} account${passedAccounts.length !== 1 ? 's' : ''}</span>
        <div style="flex:1;height:1px;background:linear-gradient(90deg,rgba(184,145,245,.35),transparent)"></div>
      </div>
    `;
    sectionsHtml += passedAccounts.map(a => renderCardHtml(a)).join('');
  }

  if (breachedAccounts.length > 0) {
    sectionsHtml += `
      <div style="grid-column:1/-1;display:flex;align-items:center;gap:12px;margin-bottom:4px;margin-top:${(activeAccounts.length > 0 || passedAccounts.length > 0) ? '16px' : '4px'}">
        <span style="font-family:var(--font-mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--red);font-weight:700">✕ Breached / Inactive</span>
        <span style="font-family:var(--font-mono);font-size:10px;color:var(--text4)">${breachedAccounts.length} account${breachedAccounts.length !== 1 ? 's' : ''}</span>
        <div style="flex:1;height:1px;background:linear-gradient(90deg,rgba(239,68,68,.35),transparent)"></div>
      </div>
    `;
    sectionsHtml += breachedAccounts.map(a => renderCardHtml(a)).join('');
  }

  grid.innerHTML = sectionsHtml;
  
  // Update hidden accounts count
  updateHiddenCount();
  
  } catch (e) {
    console.error('renderAccountsPage fatal error:', e);
    const grid = $('accounts-page-grid');
    if (grid) grid.innerHTML = '<div style="color:var(--red);padding:20px;">Error rendering accounts. Check browser console.</div>';
  }
}

function duplicateAccountCard(id) {
  const a = ACCOUNTS.find(x => x.id === id);
  if (!a) return;
  const newId = Date.now();
  // Copy only account configuration — not trade data or hidden/balance state
  const copy = {
    id: newId,
    firm: a.firm,
    phase: a.phase + ' (Copy)',
    key: (a.key || a.phase) + ' (Copy)',
    balance: a.balance,
    type: a.type,
    active: false,
    startBal: a.startBal,
    maxDrawdown: a.maxDrawdown,
    dailyLoss: a.dailyLoss,
    profitTarget: a.profitTarget,
    ddType: a.ddType,
  };
  ACCOUNTS.push(copy);
  // Assign a sequential label for the copy
  const labels = loadAcctLabels();
  const maxOrder = Object.values(labels).reduce((m, v) => {
    const n = parseInt(v.order); return (!isNaN(n) && n > m) ? n : m;
  }, 0);
  labels[String(newId)] = { order: maxOrder + 1, display: String(maxOrder + 1) };
  saveAcctLabels(labels);
  saveAccounts();
  renderAccountsPage();
  // ── Sync the Add Trade modal account list ──
  if (typeof syncTradeModalAccountList === 'function') {
    syncTradeModalAccountList();
  }
  showToast('Account duplicated', 'success', '', 2000);
}

function deleteAccountCard(id) {
  const a = ACCOUNTS.find(x => x.id === id);
  if (!a) return;
  _acctConfirm(
    '⚠️ Delete Account',
    `Delete <strong>${a.firm} — ${a.phase}</strong>? Trades linked to it will remain but won\'t appear under any account.`,
    'Delete',
    function() {
      const idx = ACCOUNTS.findIndex(x => x.id === id);
      if (idx !== -1) {
        // Store the deleted account for undo
        const deletedAccount = ACCOUNTS[idx];
        const deletedIdx = idx;
        const deletedLabels = loadAcctLabels();
        const deletedAccountLabels = {...deletedLabels};
        
        // Remember if this account was hidden before deletion
        const wasHidden = hiddenAccountIds.has(id);
        
        ACCOUNTS.splice(idx, 1);
        // Also remove from hidden accounts set if it was hidden
        hiddenAccountIds.delete(id);
        saveHiddenAccounts();
        // Clean up its label entry
        const labels = loadAcctLabels();
        delete labels[String(id)];
        saveAcctLabels(labels);
        saveAccounts();
        renderAccountsPage();
        // Re-render hidden accounts list if section is open
        if (hiddenSectionExpanded) {
          const remainingHidden = ACCOUNTS.filter(a => hiddenAccountIds.has(a.id));
          if (remainingHidden.length === 0) {
            // No more hidden accounts — hide the section
            hiddenSectionExpanded = false;
            const hiddenSection = $('hidden-accounts-section');
            if (hiddenSection) hiddenSection.style.display = 'none';
          } else {
            renderHiddenAccounts();
          }
        }
        renderAllAccountsSection && renderAllAccountsSection();
        // ── Sync the Add Trade modal account list ──
        if (typeof syncTradeModalAccountList === 'function') {
          syncTradeModalAccountList();
        }
        
        // Show "Account deleted" toast
        showToast('Account deleted', 'info', '🗑️', 2500);
        
        // Show "Undo (Ctrl+Z)" toast with undo functionality
        setTimeout(() => {
          showToast('Undo (Ctrl+Z)', 'info', '↶', 4000, function() {
            // Restore the account
            ACCOUNTS.splice(deletedIdx, 0, deletedAccount);
            // If it was hidden before deletion, restore it to hidden set
            if (wasHidden) {
              hiddenAccountIds.add(id);
              saveHiddenAccounts();
            }
            saveAcctLabels(deletedAccountLabels);
            saveAccounts();
            renderAccountsPage();
            // Re-render hidden section if it was hidden
            if (wasHidden && hiddenSectionExpanded) {
              renderHiddenAccounts();
            } else if (wasHidden) {
              // Show the hidden section again since there's a hidden account
              const hiddenSection = $('hidden-accounts-section');
              if (hiddenSection) hiddenSection.style.display = 'block';
            }
            renderAllAccountsSection && renderAllAccountsSection();
            if (typeof syncTradeModalAccountList === 'function') {
              syncTradeModalAccountList();
            }
            showToast('Account restored', 'success', '✓', 2000);
          });
        }, 300);
      }
    }
  );
}

function openAddAccountModal() {
  _acmEditId = null;
  _acmActive = true;
  $('acct-modal-title').textContent = 'Add Account';
  $('acm-delete-btn').style.display = 'none';
  $('acm-firm').value       = '';
  $('acm-phase').value      = '';
  $('acm-current-phase').value = '1';
  $('acm-balance').value    = '';
  $('acm-profit-target').value = '';
  $('acm-phase1-target').value = '';
  $('acm-phase2-target').value = '';
  $('acm-phase3-target').value = '';
  $('acm-maxdd').value      = '8';
  $('acm-dailyloss').value  = '4';
  $('acm-ddtype').value     = 'trailing';
  $('acm-notes').value      = '';
  $('acm-lev-forex').value  = '';
  $('acm-lev-metals').value = '';
  $('acm-lev-futures').value= '';
  $('acm-lev-crypto').value = '';
  $('acm-lev-indices').value= '';
  updatePhaseFields();
  _syncAcctModalActiveUI();
  $('acct-modal-overlay').style.display = 'flex';
  setTimeout(() => $('acm-firm').focus(), 50);
}

function openEditAccountModal(id) {
  const a = ACCOUNTS.find(x => x.id === id);
  if (!a) return;
  _acmEditId = id;
  _acmActive = !!a.active;
  const lev = a.leverage || {};
  $('acct-modal-title').textContent = 'Edit Account';
  $('acm-delete-btn').style.display = 'block';
  
  // For display in the form, show clean firm name (strip Phase X suffix for Funded)
  let displayFirm = a.firm || '';
  if (a.challengeType === 'Funded') {
    displayFirm = displayFirm.replace(/\s*-\s*Phase\s*\d+\s*$/i, '').trim();
  }
  
  $('acm-firm').value       = displayFirm;
  $('acm-phase').value      = a.challengeType || '';
  // For Funded accounts, clear current phase; for others, use stored value
  $('acm-current-phase').value = a.challengeType === 'Funded' ? '' : (a.currentPhase || '1');
  $('acm-balance').value    = a.startBal || '';
  $('acm-profit-target').value = a.profitTarget !== undefined ? a.profitTarget : '';
  $('acm-phase1-target').value = a.phaseTargets && a.phaseTargets[1] !== undefined ? a.phaseTargets[1] : '';
  $('acm-phase2-target').value = a.phaseTargets && a.phaseTargets[2] !== undefined ? a.phaseTargets[2] : '';
  $('acm-phase3-target').value = a.phaseTargets && a.phaseTargets[3] !== undefined ? a.phaseTargets[3] : '';
  $('acm-maxdd').value      = a.maxDrawdown || '';
  $('acm-dailyloss').value  = a.dailyLoss || '';
  $('acm-ddtype').value     = a.ddType || 'trailing';
  $('acm-notes').value      = a.notes || '';
  $('acm-lev-forex').value  = lev.forex   || '';
  $('acm-lev-metals').value = lev.metals  || '';
  $('acm-lev-futures').value= lev.futures || '';
  $('acm-lev-crypto').value = lev.crypto  || '';
  $('acm-lev-indices').value= lev.indices || '';
  updatePhaseFields();
  _syncAcctModalActiveUI();
  $('acct-modal-overlay').style.display = 'flex';
}

function closeAccountModal() {
  $('acct-modal-overlay').style.display = 'none';
}

function toggleAcctModalActive() {
  _acmActive = !_acmActive;
  _syncAcctModalActiveUI();
}

function _syncAcctModalActiveUI() {
  const tog  = $('acm-active-toggle');
  const knob = $('acm-active-knob');
  if (!tog || !knob) return;
  tog.style.background   = _acmActive ? 'var(--purple)' : 'var(--bg5)';
  tog.style.borderColor  = _acmActive ? 'transparent' : 'var(--border)';
  knob.style.left        = _acmActive ? '17px' : '2px';
}

function saveAccountFromModal() {
  let firm  = $('acm-firm').value.trim();
  const challengeType = $('acm-phase').value.trim();
  
  // If editing a Funded account, strip any "- Phase X" suffix from firm name
  if (challengeType === 'Funded' && _acmEditId !== null) {
    firm = firm.replace(/\s*-\s*Phase\s*\d+\s*$/i, '').trim();
  }
  
  const bal   = parseFloat($('acm-balance').value) || 0;
  if (!firm || !challengeType) {
    showToast('Firm name and challenge type are required', 'error', '⚠️', 2800);
    return;
  }
  
  const lev = {};
  const lf = parseFloat($('acm-lev-forex').value);  if (lf > 0) lev.forex   = lf;
  const lm = parseFloat($('acm-lev-metals').value); if (lm > 0) lev.metals  = lm;
  const lu = parseFloat($('acm-lev-futures').value);if (lu > 0) lev.futures = lu;
  const lc = parseFloat($('acm-lev-crypto').value); if (lc > 0) lev.crypto  = lc;
  const li = parseFloat($('acm-lev-indices').value);if (li > 0) lev.indices = li;

  // Set hardcoded defaults if not provided
  if (!lev.forex)   lev.forex   = 100;
  if (!lev.metals)  lev.metals  = 50;
  if (!lev.futures) lev.futures = 20;
  if (!lev.crypto)  lev.crypto  = 5;
  if (!lev.indices) lev.indices = 10;

  // Build phase display text: "FIRM - Phase 1" for multi-phase challenges (but not for Funded)
  let phase = firm;
  let currentPhase = 1;  // Default to 1 for non-Funded accounts
  
  // For Funded accounts, don't use phase numbering
  if (challengeType === 'Funded') {
    phase = firm;
    currentPhase = null;
  } else if (challengeType !== 'Instant') {
    currentPhase = parseInt($('acm-current-phase').value) || 1;
    phase = `${firm} - Phase ${currentPhase}`;
  }
  
  const key = phase.replace(/\s+/g, ' ').trim();
  
  // Collect phase targets
  const phaseTargets = {};
  if (challengeType !== 'Instant' && challengeType !== 'Funded') {
    phaseTargets[1] = parseFloat($('acm-phase1-target').value) || 8;
    if (challengeType === '2 Phase' || challengeType === '3 Phase') {
      phaseTargets[2] = parseFloat($('acm-phase2-target').value) || 8;
    }
    if (challengeType === '3 Phase') {
      phaseTargets[3] = parseFloat($('acm-phase3-target').value) || 8;
    }
  }

  if (_acmEditId === null) {
    // Add new
    const newId = ACCOUNTS.length > 0 ? Math.max(...ACCOUNTS.map(a => a.id)) + 1 : 1;
    ACCOUNTS.push({
      id: newId,
      firm,
      phase,
      key,
      balance: '$' + bal.toFixed(2),
      active:      _acmActive,
      startBal:    bal,
      challengeType: challengeType,
      currentPhase: currentPhase,
      phaseTargets: phaseTargets,
      maxDrawdown: parseFloat($('acm-maxdd').value)     || 8,
      dailyLoss:   parseFloat($('acm-dailyloss').value) || 4,
      profitTarget: (challengeType === 'Instant' || challengeType === 'Funded') ? null : (phaseTargets[currentPhase] || 8),
      ddType:      $('acm-ddtype').value || 'trailing',
      notes:       $('acm-notes').value.trim(),
      leverage:    lev,
      nextPhaseId: null  // Will be populated when next phase is auto-created
    });
    showToast('Account added', 'success', '✓', 2000);
  } else {
    const idx = ACCOUNTS.findIndex(a => a.id === _acmEditId);
    if (idx !== -1) {
      const oldAccount = ACCOUNTS[idx];
      const oldPhase = oldAccount.phase;
      ACCOUNTS[idx] = { ...ACCOUNTS[idx],
        firm,
        phase,
        key,
        balance: '$' + bal.toFixed(2),
        active:      _acmActive,
        startBal:    bal,
        challengeType: challengeType,
        currentPhase: currentPhase,
        phaseTargets: phaseTargets,
        maxDrawdown: parseFloat($('acm-maxdd').value)     || 8,
        dailyLoss:   parseFloat($('acm-dailyloss').value) || 4,
        profitTarget: challengeType === 'Instant' || challengeType === 'Funded' ? null : (phaseTargets[currentPhase] || 8),
        ddType:      $('acm-ddtype').value || 'trailing',
        notes:       $('acm-notes').value.trim(),
        leverage:    lev
      };
      // Update all trades that reference the old account name to use the new one
      if (oldPhase !== phase) {
        TRADES.forEach(t => {
          if (t.account === oldPhase) {
            t.account = phase;
          }
        });
        saveTrades();
      }
      // Also check for any trades with old phase names matching the firm name but wrong phase format
      // This helps migrate trades when challenge type changes (e.g., from "1 Phase" to "Funded")
      const tradesToUpdate = TRADES.filter(t => t.account && t.account.startsWith(firm) && t.account !== phase);
      if (tradesToUpdate.length > 0) {
        tradesToUpdate.forEach(t => {
          t.account = phase;
        });
        saveTrades();
      }
      showToast('Account updated', 'success', '✓', 2000);
    }
  }
  saveAccounts();
  closeAccountModal();
  renderAccountsPage();
  // Also refresh the account dropdowns elsewhere
  renderAllAccountsSection && renderAllAccountsSection();
  populateDashboard && populateDashboard();
  // ── Sync the Add Trade modal account list ──
  if (typeof syncTradeModalAccountList === 'function') {
    syncTradeModalAccountList();
  }
}

function deleteAccountFromModal() {
  if (_acmEditId === null) return;
  const a = ACCOUNTS.find(x => x.id === _acmEditId);
  if (!a) return;
  const idToDelete = _acmEditId;
  closeAccountModal();
  _acctConfirm(
    '⚠️ Delete Account',
    `Delete <strong>${a.firm} — ${a.phase}</strong>? Trades linked to it will remain but won\'t appear under any account.`,
    'Delete',
    function() {
      const idx = ACCOUNTS.findIndex(x => x.id === idToDelete);
      if (idx !== -1) ACCOUNTS.splice(idx, 1);
      // Clean up its label entry
      const labels = loadAcctLabels();
      delete labels[String(idToDelete)];
      saveAcctLabels(labels);
      saveAccounts();
      renderAccountsPage();
      renderAllAccountsSection && renderAllAccountsSection();
      // ── Sync the Add Trade modal account list ──
      if (typeof syncTradeModalAccountList === 'function') {
        syncTradeModalAccountList();
      }
      showToast('Account deleted', 'info', '', 2000);
    }
  );
}

// Wire accounts page render when its view is activated
const _origSwitchView = window.switchView;
window.switchView = function(el) {
  _origSwitchView && _origSwitchView.call(this, el);
  if (el && el.dataset && el.dataset.view === 'accounts') {
    renderAccountsPage();
  }
};

// ══════════════════════════════════════════════
// ── ACCOUNT SELECTION & BULK OPERATIONS ──
// ══════════════════════════════════════════════

let acctSelectMode = false;
let selectedAccountIds = new Set();
let hiddenAccountIds = new Set();
let hiddenSectionExpanded = false;

// Load hidden accounts from localStorage
function loadHiddenAccounts() {
  const stored = localStorage.getItem('hiddenAccountIds');
  if (stored) {
    try {
      hiddenAccountIds = new Set(JSON.parse(stored));
    } catch(e) {
      hiddenAccountIds = new Set();
    }
  }
}

// Save hidden accounts to localStorage
function saveHiddenAccounts() {
  localStorage.setItem('hiddenAccountIds', JSON.stringify([...hiddenAccountIds]));
}

// Initialize hidden accounts on load
loadHiddenAccounts();

// Toggle Options Dropdown
function toggleAcctOptions() {
  const dropdown = $('acct-options-dropdown');
  const btn = $('acct-options-btn');
  if (!dropdown) return;
  
  if (dropdown.style.display === 'none' || !dropdown.style.display) {
    dropdown.style.display = 'block';
    // Close when clicking outside
    setTimeout(() => {
      document.addEventListener('click', closeAcctOptionsOutside);
    }, 10);
  } else {
    dropdown.style.display = 'none';
    document.removeEventListener('click', closeAcctOptionsOutside);
  }
}

function closeAcctOptionsOutside(e) {
  const wrap = $('acct-options-wrap');
  const dropdown = $('acct-options-dropdown');
  if (!wrap.contains(e.target)) {
    dropdown.style.display = 'none';
    document.removeEventListener('click', closeAcctOptionsOutside);
  }
}

// Toggle Select Mode
function toggleSelectMode() {
  acctSelectMode = !acctSelectMode;
  selectedAccountIds.clear();
  
  if (acctSelectMode) {
    $('acct-select-bar').style.display = 'block';
    updateSelectedCount();
    renderAccountsPage();
  } else {
    exitSelectMode();
  }
  
  // Close options dropdown
  $('acct-options-dropdown').style.display = 'none';
}

function exitSelectMode() {
  acctSelectMode = false;
  selectedAccountIds.clear();
  $('acct-select-bar').style.display = 'none';
  renderAccountsPage();
}

// Toggle account selection
function toggleAccountSelection(id) {
  if (selectedAccountIds.has(id)) {
    selectedAccountIds.delete(id);
  } else {
    selectedAccountIds.add(id);
  }
  updateSelectedCount();
  
  // Update checkbox visual
  const checkbox = document.querySelector(`#acct-checkbox-${id}`);
  if (checkbox) {
    if (selectedAccountIds.has(id)) {
      checkbox.style.background = 'var(--purple)';
      checkbox.style.borderColor = 'var(--purple)';
      checkbox.innerHTML = '<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-6" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    } else {
      checkbox.style.background = 'transparent';
      checkbox.style.borderColor = 'var(--border)';
      checkbox.innerHTML = '';
    }
  }
}

function updateSelectedCount() {
  const countEl = $('acct-selected-count');
  if (countEl) {
    const count = selectedAccountIds.size;
    countEl.textContent = count === 1 ? '1 selected' : `${count} selected`;
  }
}

function selectAllAccounts() {
  ACCOUNTS.forEach(a => {
    if (!hiddenAccountIds.has(a.id)) {
      selectedAccountIds.add(a.id);
    }
  });
  updateSelectedCount();
  renderAccountsPage();
}

function deselectAllAccounts() {
  selectedAccountIds.clear();
  updateSelectedCount();
  renderAccountsPage();
}

// Hide selected accounts
function hideSelectedAccounts() {
  if (selectedAccountIds.size === 0) {
    showToast('No accounts selected', 'info', '⚠️', 2000);
    return;
  }
  
  selectedAccountIds.forEach(id => hiddenAccountIds.add(id));
  saveHiddenAccounts();
  
  showToast(`${selectedAccountIds.size} account${selectedAccountIds.size > 1 ? 's' : ''} hidden`, 'success', '👁️', 2000);
  
  selectedAccountIds.clear();
  updateSelectedCount();
  exitSelectMode();
  $('acct-options-dropdown').style.display = 'none';
  renderAccountsPage();
}

// Duplicate selected accounts
function duplicateSelectedAccounts() {
  if (selectedAccountIds.size === 0) {
    showToast('No accounts selected', 'info', '⚠️', 2000);
    return;
  }
  
  let duplicatedCount = 0;
  selectedAccountIds.forEach(id => {
    const a = ACCOUNTS.find(x => x.id === id);
    if (a) {
      // Copy only account configuration — not trade data or hidden/balance state
      const newAcct = {
        id: ACCOUNTS.length > 0 ? Math.max(...ACCOUNTS.map(x => x.id)) + 1 : 1,
        firm: a.firm,
        phase: a.phase + ' (Copy)',
        key: (a.key || a.phase) + ' (Copy)',
        balance: a.balance,
        type: a.type,
        active: false,
        startBal: a.startBal,
        maxDrawdown: a.maxDrawdown,
        dailyLoss: a.dailyLoss,
        profitTarget: a.profitTarget,
        ddType: a.ddType,
      };
      ACCOUNTS.push(newAcct);
      duplicatedCount++;
    }
  });
  
  saveAccounts();
  selectedAccountIds.clear();
  updateSelectedCount();
  exitSelectMode();
  $('acct-options-dropdown').style.display = 'none';
  renderAccountsPage();
  
  if (typeof syncTradeModalAccountList === 'function') {
    syncTradeModalAccountList();
  }
  
  showToast(`${duplicatedCount} account${duplicatedCount > 1 ? 's' : ''} duplicated`, 'success', '✓', 2000);
}

// Delete selected accounts
function deleteSelectedAccounts() {
  if (selectedAccountIds.size === 0) {
    showToast('No accounts selected', 'info', '⚠️', 2000);
    return;
  }
  
  const count = selectedAccountIds.size;
  _acctConfirm(
    '⚠️ Delete Accounts',
    `Delete <strong>${count} account${count > 1 ? 's' : ''}</strong>? Trades linked to them will remain but won't appear under any account.`,
    'Delete All',
    function() {
      // Store deleted accounts for undo
      const deletedAccounts = [];
      const deletedLabels = loadAcctLabels();
      const deletedAccountLabels = {...deletedLabels};
      
      selectedAccountIds.forEach(id => {
        const idx = ACCOUNTS.findIndex(x => x.id === id);
        if (idx !== -1) {
          deletedAccounts.push({ account: ACCOUNTS[idx], index: idx });
          ACCOUNTS.splice(idx, 1);
          delete deletedLabels[String(id)];
        }
      });
      
      saveAcctLabels(deletedLabels);
      saveAccounts();
      
      selectedAccountIds.clear();
      updateSelectedCount();
      exitSelectMode();
      $('acct-options-dropdown').style.display = 'none';
      renderAccountsPage();
      renderAllAccountsSection && renderAllAccountsSection();
      
      if (typeof syncTradeModalAccountList === 'function') {
        syncTradeModalAccountList();
      }
      
      // Show deletion toast
      showToast(`${count} account${count > 1 ? 's' : ''} deleted`, 'info', '🗑️', 2500);
      
      // Show undo toast
      setTimeout(() => {
        showToast('Undo (Ctrl+Z)', 'info', '↶', 4000, function() {
          // Restore all deleted accounts
          deletedAccounts.sort((a, b) => a.index - b.index).forEach(item => {
            ACCOUNTS.splice(item.index, 0, item.account);
          });
          saveAcctLabels(deletedAccountLabels);
          saveAccounts();
          renderAccountsPage();
          renderAllAccountsSection && renderAllAccountsSection();
          if (typeof syncTradeModalAccountList === 'function') {
            syncTradeModalAccountList();
          }
          showToast(`${count} account${count > 1 ? 's' : ''} restored`, 'success', '✓', 2000);
        });
      }, 300);
    }
  );
}

// ══════════════════════════════════════════════
// ── HIDDEN ACCOUNTS SECTION ──
// ══════════════════════════════════════════════

function toggleHiddenSection() {
  const section = $('hidden-accounts-section');
  const toggleText = $('hidden-toggle-text');
  
  if (hiddenAccountIds.size === 0) {
    showToast('No hidden accounts', 'info', '👁️', 2000);
    return;
  }
  
  // Always ensure the section is visible in the DOM before toggling
  section.style.display = 'block';
  
  if (!hiddenSectionExpanded) {
    // Show the section and expand the list
    if (toggleText) toggleText.textContent = 'Hide Hidden';
    toggleHiddenAccounts();
    // Scroll so user sees the hidden accounts section
    setTimeout(() => {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    showToast('Hidden accounts are shown at the bottom of the page', 'info', '👁️', 3000);
  } else {
    // Hide the entire section
    hiddenSectionExpanded = false;
    section.style.display = 'none';
    if (toggleText) toggleText.textContent = 'Show Hidden';
    showToast('Hidden accounts section is now hidden', 'info', '👁️', 2000);
  }
  
  // Close options dropdown
  $('acct-options-dropdown').style.display = 'none';
}

function toggleHiddenAccounts() {
  const grid = $('hidden-accounts-grid');
  const chevron = $('hidden-chevron');
  
  if (!grid) return;
  
  hiddenSectionExpanded = !hiddenSectionExpanded;
  
  if (hiddenSectionExpanded) {
    grid.style.display = 'grid';
    if (chevron) chevron.style.transform = 'rotate(180deg)';
    renderHiddenAccounts();
  } else {
    grid.style.display = 'none';
    if (chevron) chevron.style.transform = 'rotate(0deg)';
  }
}

function renderHiddenAccounts() {
  const grid = $('hidden-accounts-grid');
  if (!grid) return;
  
  const hiddenAccounts = ACCOUNTS.filter(a => hiddenAccountIds.has(a.id));
  
  grid.innerHTML = hiddenAccounts.map(a => {
    const acctName = a.key || a.phase;
    const acctTrades = TRADES.filter(t => (t.account || '') === acctName);
    const netPnl = acctTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const pnlColor = netPnl >= 0 ? 'var(--green)' : 'var(--red)';
    const pnlStr = (netPnl >= 0 ? '+' : '-') + '$' + Math.abs(netPnl).toFixed(2);
    
    return `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:20px;opacity:.6;position:relative">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
        <div style="flex:1">
          <div style="font-family:var(--font-display);font-size:15px;font-weight:700;color:var(--text2)">${a.firm}</div>
          <div style="font-size:11px;color:var(--text4);font-family:var(--font-mono);margin-top:2px">${a.phase}</div>
        </div>
        <div style="font-family:var(--font-mono);font-size:17px;font-weight:700;color:${pnlColor}">${pnlStr}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="unhideAccount(${a.id})" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:7px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--text2);font-size:12px;cursor:pointer;font-family:var(--font-body);font-weight:600;transition:all .15s" onmouseenter="this.style.background='var(--ac-12)';this.style.color='var(--purple)'" onmouseleave="this.style.background='var(--bg3)';this.style.color='var(--text2)'">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/><path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/></svg>
          Unhide
        </button>
        <button onclick="deleteAccountCard(${a.id})" style="display:flex;align-items:center;justify-content:center;padding:7px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--text3);cursor:pointer;transition:all .15s" onmouseenter="this.style.background='rgba(239,68,68,.12)';this.style.borderColor='rgba(239,68,68,.4)';this.style.color='var(--red)'" onmouseleave="this.style.background='var(--bg3)';this.style.borderColor='var(--border)';this.style.color='var(--text3)'">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><polyline points="2,4 12,4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M5 4V2.5h4V4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M3 4l.8 7.5h6.4L11 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

function unhideAccount(id) {
  hiddenAccountIds.delete(id);
  saveHiddenAccounts();
  renderAccountsPage();
  if (hiddenSectionExpanded) {
    renderHiddenAccounts();
  }
  showToast('Account unhidden', 'success', '👁️', 2000);
}

function updateHiddenCount() {
  // Only count IDs that still exist in ACCOUNTS (deleted accounts may linger in the set)
  const actualHiddenCount = ACCOUNTS.filter(a => hiddenAccountIds.has(a.id)).length;
  
  const badge = $('hidden-count-badge');
  if (badge) {
    badge.textContent = actualHiddenCount;
  }
  
  const section = $('hidden-accounts-section');
  if (section) {
    if (actualHiddenCount === 0 && !hiddenSectionExpanded) {
      section.style.display = 'none';
    }
  }
}
