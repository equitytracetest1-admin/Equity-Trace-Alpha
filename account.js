// ═══ Account & Goals Module ═══

/* ─── PERFORMANCE CALENDAR ─── */
// Wait for app.js to be ready before initializing
function initAccountCalendarModule() {
  if (!window._appReady) {
    setTimeout(initAccountCalendarModule, 100);
    return;
  }

(function(){
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  let calYear, calMonth;

  function calInit() {
    const now = new Date();
    if (calYear === undefined) { calYear = now.getFullYear(); calMonth = now.getMonth(); }
    // Populate account selector (reuses same buildAnAccountBar as Analytics)
    const bar = $('cal-acct-bar');
    if (bar && typeof buildAnAccountBar === 'function') bar.innerHTML = buildAnAccountBar();
    renderCal();
  }

  // Re-render calendar when account is switched via anSetAccount
  const _origAnSetAccountCal = window.anSetAccount;
  window.anSetAccount = function(acct) {
    if (typeof _origAnSetAccountCal === 'function') _origAnSetAccountCal.apply(this, arguments);
    const active = document.querySelector('.view.active');
    if (active?.id === 'view-calendar') {
      const bar2 = $('cal-acct-bar');
      if (bar2 && typeof buildAnAccountBar === 'function') bar2.innerHTML = buildAnAccountBar();
      renderCal();
    }
  };

  window.calNav = function(dir) { calMonth += dir; if (calMonth > 11) { calMonth = 0; calYear++; } if (calMonth < 0) { calMonth = 11; calYear--; } renderCal(); };
  window.calGoToday = function() { const n = new Date(); calYear = n.getFullYear(); calMonth = n.getMonth(); renderCal(); };

  function getAcctTrades() {
    const all = (typeof TRADES !== 'undefined') ? TRADES : [];
    // Calendar uses anCurrentAccount (same as Analytics pages)
    const anAcct = (typeof anCurrentAccount !== 'undefined' && anCurrentAccount && anCurrentAccount !== '__all__') ? anCurrentAccount : null;
    if (anAcct) return all.filter(t => (t.account||'') === anAcct);
    // If anCurrentAccount is __all__ or undefined, return all trades
    if (!anCurrentAccount || anCurrentAccount === '__all__') return all;
    // Fallback: respect the global selectedAcct (only if anCurrentAccount is not explicitly set)
    const acctName = (typeof selectedAcct !== 'undefined' && selectedAcct !== -1 && typeof ACCOUNTS !== 'undefined' && ACCOUNTS[selectedAcct])
      ? ACCOUNTS[selectedAcct].firm + ' - ' + (ACCOUNTS[selectedAcct].key || ACCOUNTS[selectedAcct].phase)
      : '';
    return acctName ? all.filter(t => (t.account||'') === acctName) : all;
  }

  function buildDayMap(trades) {
    const map = {};
    trades.forEach(t => {
      if (!map[t.date]) map[t.date] = { pnl: 0, trades: 0 };
      map[t.date].pnl += t.pnl;
      map[t.date].trades++;
    });
    return map;
  }

  function fmt(v) {
    const abs = Math.abs(v).toFixed(2);
    return (v >= 0 ? '+$' : '-$') + abs;
  }

  function renderCal() {
    const label = $('cal-month-label');
    if (label) label.textContent = MONTHS[calMonth] + ' ' + calYear;

    const trades = getAcctTrades();
    const dayMap = buildDayMap(trades);

    // Monthly trades
    const monthTrades = trades.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === calYear && d.getMonth() === calMonth;
    });

    // Monthly stats
    const tradedDays = new Set(monthTrades.map(t => t.date));
    let winDays = 0, lossDays = 0, beakDays = 0, monthPnl = 0;
    tradedDays.forEach(d => {
      const p = dayMap[d]?.pnl || 0;
      monthPnl += p;
      if (p > 0) winDays++; else if (p < 0) lossDays++; else beakDays++;
    });
    const avgDay = tradedDays.size > 0 ? monthPnl / tradedDays.size : 0;

    // Best / worst day
    let bestDay = -Infinity, worstDay = Infinity;
    tradedDays.forEach(d => { const p = dayMap[d]?.pnl || 0; if (p > bestDay) bestDay = p; if (p < worstDay) worstDay = p; });
    if (tradedDays.size === 0) { bestDay = 0; worstDay = 0; }

    // Stats bar
    const stats = $('cal-stats-bar');
    if (stats) stats.innerHTML = [
      { label: 'NET P&L', val: fmt(monthPnl), cls: monthPnl >= 0 ? 'var(--green)' : 'var(--red)' },
      { label: 'WIN DAYS', val: winDays, cls: 'var(--green)' },
      { label: 'LOSS DAYS', val: lossDays, cls: 'var(--red)' },
      { label: 'TRADED DAYS', val: tradedDays.size, cls: 'var(--text)' },
      { label: 'AVG DAILY P&L', val: fmt(avgDay), cls: avgDay >= 0 ? 'var(--green)' : 'var(--red)' },
      { label: 'BEST DAY', val: tradedDays.size > 0 ? fmt(bestDay) : '—', cls: 'var(--green)' },
    ].map(s => `<div class="cal-stat-card" style="border-radius:var(--radius);padding:12px 16px;">
      <div style="font-family:var(--font-mono);font-size:9px;letter-spacing:.12em;color:var(--text3);text-transform:uppercase;margin-bottom:5px">${s.label}</div>
      <div style="font-family:var(--font-display);font-weight:600;font-size:17px;color:${s.cls}">${s.val}</div>
    </div>`).join('');

    // Build grid
    // First day of month (0=Sun), we need Mon-based (0=Mon)
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7; // 0=Mon
    const totalDays = lastDay.getDate();
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');

    // Build weeks array
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) {
      const ds = calYear + '-' + String(calMonth+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
      cells.push({ d, ds });
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i+7));

    const body = $('cal-grid-body');
    if (!body) return;

    body.innerHTML = weeks.map(week => {
      let weekPnl = 0;
      let weekTraded = 0;
      const DOW = ['MON','TUE','WED','THU','FRI','SAT','SUN'];

      const dayCells = week.map((cell, idx) => {
        // Empty cell (padding before month start / after end)
        if (!cell) return `<div style="padding:6px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--bg2);opacity:.3"></div>`;

        const { d, ds } = cell;
        const data = dayMap[ds];
        const isWeekend = idx >= 5;
        const isToday = ds === todayStr;
        const dow = DOW[idx];

        // Colors
        let borderColor, bgColor, pnlColor, glowColor, hoverBg;
        if (data && data.pnl > 0) {
          borderColor = 'rgba(46,204,138,.4)'; bgColor = 'rgba(46,204,138,.08)';
          pnlColor = 'var(--green)'; glowColor = 'rgba(46,204,138,.12)'; hoverBg = 'rgba(46,204,138,.15)';
          weekPnl += data.pnl; weekTraded++;
        } else if (data && data.pnl < 0) {
          borderColor = 'rgba(232,80,74,.4)'; bgColor = 'rgba(232,80,74,.08)';
          pnlColor = 'var(--red)'; glowColor = 'rgba(232,80,74,.12)'; hoverBg = 'rgba(232,80,74,.15)';
          weekPnl += data.pnl; weekTraded++;
        } else if (data) {
          borderColor = 'rgba(160,168,190,.25)'; bgColor = 'rgba(160,168,190,.06)';
          pnlColor = 'var(--text3)'; glowColor = 'transparent'; hoverBg = 'rgba(160,168,190,.1)';
          weekTraded++;
        } else {
          borderColor = isToday ? 'var(--ac-55)' : (isWeekend ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.06)');
          bgColor = isWeekend ? 'rgba(0,0,0,.15)' : 'var(--bg4)';
          pnlColor = 'var(--text4)'; glowColor = 'transparent'; hoverBg = bgColor;
        }

        if (isToday && !data) borderColor = 'var(--ac-55)';
        if (isToday && data)  borderColor = 'var(--ac-70)';

        const cursor = data ? 'cursor:pointer;' : '';
        const todayGlow = isToday ? ';box-shadow:0 0 0 2px var(--ac-25)' : '';
        const hover = data ? `onmouseenter="this.style.background='${hoverBg}';this.style.transform='translateY(-1px)'" onmouseleave="this.style.background='${bgColor}';this.style.transform=''"` : '';
        const click = data ? `onclick="calDayClick('${ds}')"` : '';

        const dateNumColor = isToday ? 'var(--purple)' : isWeekend ? 'rgba(160,168,190,.35)' : 'rgba(160,168,190,.5)';

        return `<div ${click} ${hover} style="${cursor}padding:10px 10px 10px;border:1px solid ${borderColor};border-radius:8px;margin:4px;background:${bgColor};display:flex;flex-direction:column;justify-content:space-between;min-height:96px;transition:background .15s,transform .15s${todayGlow}">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
            <span style="font-family:var(--font-mono);font-size:8.5px;letter-spacing:.1em;font-weight:700;color:${isWeekend ? 'rgba(232,80,74,.4)' : (isToday ? 'var(--purple)' : 'var(--text3)')}">${dow}</span>
            ${isToday ? `<span style="width:5px;height:5px;border-radius:50%;background:var(--purple);box-shadow:0 0 5px var(--ac-80);display:inline-block"></span>` : ''}
          </div>
          <div style="text-align:center;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px">
            ${data
              ? `<div style="font-family:var(--font-display);font-weight:700;font-size:15px;color:${pnlColor};line-height:1">${fmt(data.pnl)}</div>`
              : `<div style="font-family:var(--font-mono);font-size:13px;color:var(--text4)">—</div>`
            }
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
            <span style="font-family:var(--font-mono);font-size:9px;color:var(--text3)">${data ? data.trades + ' trade' + (data.trades !== 1 ? 's' : '') : '0 trades'}</span>
            <span style="font-family:var(--font-mono);font-size:10px;color:${dateNumColor};font-weight:600">${d}</span>
          </div>
        </div>`;
      }).join('');

      const weekColor = weekPnl > 0 ? 'var(--green)' : weekPnl < 0 ? 'var(--red)' : 'var(--text3)';
      const weekBg    = weekPnl > 0 ? 'rgba(46,204,138,.07)' : weekPnl < 0 ? 'rgba(232,80,74,.07)' : 'transparent';
      const weekBorder= weekPnl > 0 ? 'rgba(46,204,138,.3)' : weekPnl < 0 ? 'rgba(232,80,74,.3)' : 'var(--border)';
      const weekCell  = `<div style="border-left:1px solid var(--border);border-bottom:1px solid var(--border);padding:8px 10px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:5px;background:${weekBg}">
        <div style="font-family:var(--font-mono);font-size:8px;letter-spacing:.1em;color:var(--text3);text-transform:uppercase;margin-bottom:2px">WEEK</div>
        ${weekTraded > 0
          ? `<div style="font-family:var(--font-display);font-weight:700;font-size:13px;color:${weekColor};text-align:center">${fmt(weekPnl)}</div>
             <div style="font-family:var(--font-mono);font-size:9px;color:var(--text3)">${weekTraded}d</div>`
          : `<div style="font-family:var(--font-mono);font-size:11px;color:var(--text4)">—</div>`
        }
      </div>`;

      return `<div style="display:grid;grid-template-columns:repeat(7,1fr) 90px;border-bottom:1px solid var(--border)">${dayCells}${weekCell}</div>`;
    }).join('');
  }

  window.calDayClick = function(ds) {
    // Sync anCurrentAccount into selectedAcct so trade log respects the same account
    if (typeof anCurrentAccount !== 'undefined' && anCurrentAccount && anCurrentAccount !== '__all__') {
      const matchIdx = (typeof ACCOUNTS !== 'undefined') ? ACCOUNTS.findIndex(a => (a.key || a.phase) === anCurrentAccount) : -1;
      if (matchIdx !== -1 && typeof selectAcct === 'function') selectAcct(matchIdx);
    }
    window._symbolQuickFilter = null;
    window._sessionQuickFilter = null;
    window._streakIdFilter = null;
    const ids = getAcctTrades().filter(t => t.date === ds).map(t => String(t.id));
    if (!ids.length) return;
    window._streakIdFilter = ids;
    const nav = document.querySelector('.nav-item[data-view="tradelog"]');
    if (nav) nav.click();
    setTimeout(() => {
      if (typeof applyFilters === 'function') applyFilters();
      
    }, 80);
  };

  // Re-render when account changes or view becomes active
  const _origSwitchViewCal = window.switchView;
  window.switchView = function(el) {
    const r = _origSwitchViewCal.apply(this, arguments);
    if (el?.dataset?.view === 'calendar') setTimeout(calInit, 40);
    return r;
  };

  // Also re-render when trades change
  const _origSaveTradeCal = window.saveTrade;
  if (typeof _origSaveTradeCal === 'function') {
    window.saveTrade = function() {
      const r = _origSaveTradeCal.apply(this, arguments);
      const active = document.querySelector('.view.active');
      if (active?.id === 'view-calendar') setTimeout(renderCal, 200);
      return r;
    };
  }
})();
}

// Initialize the calendar module when ready
if (window._appReady) {
  initAccountCalendarModule();
} else {
  setTimeout(initAccountCalendarModule, 50);
}

/* ─── LIVE CLOCK (timezone-aware) ─── */
(function(){
  function tick(){
    const tz = (typeof loadSettings === 'function') ? (loadSettings().timezone || 'UTC') : 'UTC';
    let now;
    try {
      // Get the current time in the selected timezone
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday:'short', month:'short', day:'numeric',
        hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false
      }).formatToParts(new Date());
      const get = t => (parts.find(p=>p.type===t)||{value:''}).value;
      const dateEl = $('live-date');
      const clockEl = $('live-clock');
      let hh = parseInt(get('hour').replace('24','00'));
      const mm = get('minute');
      const ss = get('second');
      const ampm = hh >= 12 ? 'PM' : 'AM';
      hh = (hh % 12 || 12).toString().padStart(2,'0');
      if(dateEl) dateEl.textContent = `${get('weekday')} ${get('month')} ${get('day')}`;
      if(clockEl) clockEl.innerHTML = `<span style="font-size:13px;color:var(--purple);font-weight:600">${hh}<span style="animation:clockDot 1s steps(1,end) infinite">:</span>${mm}</span><span style="font-size:10px;color:var(--purple);opacity:0.8;margin-left:2px">${ampm}</span>`;
    } catch(e) {
      // Fallback to local time
      const now = new Date();
      const dateEl = $('live-date');
      const clockEl = $('live-clock');
      const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      if(dateEl) dateEl.textContent=`${days[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()}`;
      let h = now.getHours();
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = (h % 12 || 12).toString().padStart(2,'0');
      const m=String(now.getMinutes()).padStart(2,'0');
      const s=String(now.getSeconds()).padStart(2,'0');
      if(clockEl) clockEl.innerHTML=`<span style="font-size:13px;color:var(--purple);font-weight:600">${h}<span style="animation:clockDot 1s steps(1,end) infinite">:</span>${m}</span><span style="font-size:10px;color:var(--purple);opacity:0.8;margin-left:2px">${ampm}</span>`;
    }
  }
  tick();
  setInterval(tick,1000);
  window._tickLiveClock = tick; // expose so TZ switcher can refresh immediately
})();

/* ─── TZ SWITCHER ─── */
const TZ_GROUPS = [
  { group: 'Universal', zones: [
    { tz:'UTC', label:'UTC' }
  ]},
  { group: 'Americas', zones: [
    { tz:'America/New_York',    label:'New York (ET)' },
    { tz:'America/Chicago',     label:'Chicago (CT)' },
    { tz:'America/Denver',      label:'Denver (MT)' },
    { tz:'America/Los_Angeles', label:'Los Angeles (PT)' },
    { tz:'America/Toronto',     label:'Toronto' },
    { tz:'America/Vancouver',   label:'Vancouver' },
    { tz:'America/Sao_Paulo',   label:'São Paulo' },
    { tz:'America/Mexico_City', label:'Mexico City' },
  ]},
  { group: 'Europe', zones: [
    { tz:'Europe/London',     label:'London (GMT/BST)' },
    { tz:'Europe/Paris',      label:'Paris (CET)' },
    { tz:'Europe/Berlin',     label:'Berlin' },
    { tz:'Europe/Madrid',     label:'Madrid' },
    { tz:'Europe/Rome',       label:'Rome' },
    { tz:'Europe/Amsterdam',  label:'Amsterdam' },
    { tz:'Europe/Stockholm',  label:'Stockholm' },
    { tz:'Europe/Zurich',     label:'Zurich' },
    { tz:'Europe/Moscow',     label:'Moscow' },
  ]},
  { group: 'Asia / Pacific', zones: [
    { tz:'Asia/Dubai',        label:'Dubai (GST)' },
    { tz:'Asia/Kolkata',      label:'India (IST)' },
    { tz:'Asia/Colombo',      label:'Sri Lanka' },
    { tz:'Asia/Dhaka',        label:'Dhaka (BST)' },
    { tz:'Asia/Bangkok',      label:'Bangkok (ICT)' },
    { tz:'Asia/Singapore',    label:'Singapore (SGT)' },
    { tz:'Asia/Kuala_Lumpur', label:'Kuala Lumpur' },
    { tz:'Asia/Hong_Kong',    label:'Hong Kong (HKT)' },
    { tz:'Asia/Shanghai',     label:'Shanghai (CST)' },
    { tz:'Asia/Tokyo',        label:'Tokyo (JST)' },
    { tz:'Asia/Seoul',        label:'Seoul (KST)' },
    { tz:'Australia/Sydney',  label:'Sydney (AEDT)' },
    { tz:'Australia/Melbourne',label:'Melbourne' },
    { tz:'Pacific/Auckland',  label:'Auckland (NZST)' },
    { tz:'Pacific/Honolulu',  label:'Honolulu (HST)' },
  ]},
  { group: 'Africa', zones: [
    { tz:'Africa/Cairo',        label:'Cairo (EET)' },
    { tz:'Africa/Johannesburg', label:'Johannesburg (SAST)' },
  ]},
];

function toggleTzSwitcher() {
  const dd = $('tz-switcher-dd');
  if (!dd) return;
  const isOpen = dd.style.display !== 'none';
  if (isOpen) { dd.style.display = 'none'; return; }
  // Build list
  const list = $('tz-switcher-list');
  const currentTz = (typeof loadSettings === 'function') ? (loadSettings().timezone || 'UTC') : 'UTC';
  list.innerHTML = '';
  TZ_GROUPS.forEach(g => {
    const grpLabel = document.createElement('div');
    grpLabel.style.cssText = 'font-size:9px;letter-spacing:.1em;color:var(--text3);font-family:var(--font-mono);text-transform:uppercase;padding:8px 10px 4px;';
    grpLabel.textContent = g.group;
    list.appendChild(grpLabel);
    g.zones.forEach(z => {
      const btn = document.createElement('div');
      const isActive = z.tz === currentTz;
      btn.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-radius:7px;cursor:pointer;font-size:11px;font-family:var(--font-body);color:${isActive?'#b891f5':'var(--text2)'};background:${isActive?'var(--ac-15)':'transparent'};transition:background .1s`;
      btn.innerHTML = `<span>${z.label}</span>${isActive?'<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#b891f5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>':''}`;
      btn.onmouseenter = () => { if(!isActive) btn.style.background='var(--ac-08)'; };
      btn.onmouseleave = () => { if(!isActive) btn.style.background='transparent'; };
      btn.onclick = () => { selectTz(z.tz, z.label); };
      list.appendChild(btn);
    });
  });
  dd.style.display = 'block';
  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function _closeTz(e) {
      const wrap = $('tz-switcher-wrap');
      if (wrap && !wrap.contains(e.target)) {
        dd.style.display = 'none';
        document.removeEventListener('click', _closeTz);
      }
    });
  }, 0);
}

function selectTz(tz, label) {
  const dd = $('tz-switcher-dd');
  if (dd) dd.style.display = 'none';
  // Save to settings
  if (typeof saveSetting === 'function') saveSetting('timezone', tz);
  // Sync the Settings page dropdown too
  const sel = $('setting-timezone');
  if (sel) sel.value = tz;
  // Update topbar label — show short TZ name
  const lbl = $('tz-switcher-label');
  if (lbl) lbl.textContent = _tzShortLabel(tz);
  // Restart the tz-clock in Settings
  if (typeof startTzClock === 'function') startTzClock(tz);
  // Refresh live clock immediately
  if (typeof window._tickLiveClock === 'function') window._tickLiveClock();
}

function _tzShortLabel(tz) {
  // Show a compact version in the topbar button
  const map = {
    'UTC':'UTC','America/New_York':'ET','America/Chicago':'CT','America/Denver':'MT',
    'America/Los_Angeles':'PT','America/Toronto':'ET','America/Vancouver':'PT',
    'America/Sao_Paulo':'BRT','America/Mexico_City':'CST','Europe/London':'GMT',
    'Europe/Paris':'CET','Europe/Berlin':'CET','Europe/Madrid':'CET','Europe/Rome':'CET',
    'Europe/Amsterdam':'CET','Europe/Stockholm':'CET','Europe/Zurich':'CET',
    'Europe/Moscow':'MSK','Asia/Dubai':'GST','Asia/Kolkata':'IST','Asia/Colombo':'IST',
    'Asia/Dhaka':'BST','Asia/Bangkok':'ICT','Asia/Singapore':'SGT',
    'Asia/Kuala_Lumpur':'MYT','Asia/Hong_Kong':'HKT','Asia/Shanghai':'CST',
    'Asia/Tokyo':'JST','Asia/Seoul':'KST','Australia/Sydney':'AEDT',
    'Australia/Melbourne':'AEDT','Pacific/Auckland':'NZST','Pacific/Honolulu':'HST',
    'Africa/Cairo':'EET','Africa/Johannesburg':'SAST'
  };
  return map[tz] || tz.split('/').pop().replace(/_/g,' ');
}

// Init the TZ switcher label on load
(function initTzSwitcherLabel(){
  const set = () => {
    if (typeof loadSettings !== 'function') { setTimeout(set, 100); return; }
    const tz = loadSettings().timezone || 'UTC';
    const lbl = $('tz-switcher-label');
    if (lbl) lbl.textContent = _tzShortLabel(tz);
  };
  set();
})();

/* ─── WIN RATE RING ANIMATOR ─── */
(function(){
  function animateRing(){
    const ring=$('wr-ring');
    const valEl=$('wr-val');
    if(!ring||!valEl) return;
    // Get the win rate from the element text
    const pct=parseFloat(valEl.textContent)||0;
    const circumference=314.16; // 2 * pi * 50
    const offset=circumference*(1-pct/100);
    // Color based on value
      const color=pct>=60?'var(--green)':pct>=45?'var(--amber)':'var(--red)';
      ring.style.stroke=color;
      // Force number text color to match ring — must use setProperty('important') to beat
      // the theme blanket color:var(--text)!important rules in Aura (.medium) and Dawn (.light)
      valEl.style.setProperty('color', color, 'important');
      // Store glow color for CSS hover
    const glowColor=pct>=60?'rgba(46,204,138,.55)':pct>=45?'rgba(245,166,35,.55)':'rgba(232,80,74,.55)';
    ring.dataset.glow=glowColor;
    ring.style.strokeDashoffset=offset;
  }
  // Run after page scripts have loaded/rendered
  setTimeout(animateRing,300);
  // Also watch for data updates via MutationObserver
  const valEl=$('wr-val');
  if(valEl){
    new MutationObserver(animateRing).observe(valEl,{childList:true,subtree:true,characterData:true});
  }
  // Hover glow — color-matched to green/amber/red
  const card=$('wr-card');
  if(card){
    card.addEventListener('mouseenter',()=>{
      const r=$('wr-ring');
      if(r) r.style.filter=`drop-shadow(0 0 6px ${r.dataset.glow||'rgba(46,204,138,.55)'})`;
    });
    card.addEventListener('mouseleave',()=>{
      const r=$('wr-ring');
      if(r) r.style.filter='none';
    });
  }
})();

/* ─── KEYBOARD SHORTCUTS ─── */
(function(){
  // Navigation map: key → nav-item data-view


  /* ─── Keyboard shortcuts overlay ─── */
  function showKbShortcuts(){
    if($('kb-overlay')){ $('kb-overlay').remove(); return; }
    const shortcuts = [
      ['N','New Trade'],
      ['D','Toggle Theme'],
      ['1','Dashboard'],['2','Trade Journal'],['3','Analytics'],
      ['4','Adv. Analytics'],['5','Playbook'],['6','Accounts'],
      ['7','Calendar'],['8','Reports'],['9','Settings'],
      [',','Navigate Back'],['.','Navigate Forward'],
      ['Esc','Close / Cancel'],['?','This Help Screen'],
    ];

    const ov = document.createElement('div');
    ov.id = 'kb-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px)';
    ov.addEventListener('click', ()=>ov.remove());

    const box = document.createElement('div');
    box.style.cssText = 'background:var(--bg2);border:1px solid var(--ac-30);border-radius:16px;padding:28px 32px;max-width:420px;width:90vw;box-shadow:0 24px 64px rgba(0,0,0,.7)';
    box.addEventListener('click', e=>e.stopPropagation());

    /* Header */
    const hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:20px';
    const ttl = document.createElement('div');
    ttl.style.cssText = 'font-family:var(--font-display);font-weight:700;font-size:15px';
    ttl.textContent = 'Keyboard Shortcuts';
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:var(--bg4);border:1px solid var(--border);border-radius:7px;width:28px;height:28px;cursor:pointer;color:var(--text2);font-size:13px;display:flex;align-items:center;justify-content:center;transition:all .15s';
    closeBtn.textContent = '✕';
    closeBtn.onclick = ()=>ov.remove();
    hdr.appendChild(ttl); hdr.appendChild(closeBtn);
    box.appendChild(hdr);

    /* Grid */
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px';
    shortcuts.forEach(function(pair){
      const k = pair[0], v = pair[1];
      const cell = document.createElement('div');
      cell.style.cssText = 'display:flex;align-items:center;gap:10px;padding:7px 10px;background:var(--bg3);border-radius:8px;border:1px solid var(--border)';
      const kbd = document.createElement('kbd');
      kbd.style.cssText = 'background:var(--bg5);border:1px solid var(--border2);border-radius:5px;padding:2px 7px;font-family:var(--font-mono);font-size:11px;color:var(--purple);min-width:28px;text-align:center;flex-shrink:0';
      kbd.textContent = k;
      const lbl = document.createElement('span');
      lbl.style.cssText = 'font-size:11.5px;color:var(--text2)';
      lbl.textContent = v;
      cell.appendChild(kbd); cell.appendChild(lbl);
      grid.appendChild(cell);
    });
    box.appendChild(grid);

    /* Footer hint */
    const foot = document.createElement('div');
    foot.style.cssText = 'margin-top:14px;text-align:center;font-size:10px;color:var(--text3);font-family:var(--font-mono)';
    foot.textContent = 'Press ? or click outside to close';
    box.appendChild(foot);

    ov.appendChild(box);
    document.body.appendChild(ov);
  }
  window.showKbShortcuts = showKbShortcuts;
})();

/* ─── TOAST SYSTEM ─── */
/* ─── TOAST SYSTEM (queue-aware, max 4 stacked, with undo support) ─── */
window.showToast = (function(){
  const MAX = 4;
  return function(msg, type='info', icon='', duration=3000, undoCallback=null){
    const container = $('toast-container');
    if(!container) return;
    const icons = {success:'✓', error:'✕', info:'◆'};
    // Prune oldest if at max
    while(container.children.length >= MAX){
      const oldest = container.children[0];
      oldest.classList.add('hide');
      setTimeout(()=>oldest.remove(), 300);
    }
    const t = document.createElement('div');
    t.className = `toast t-${type}`;
    
    // If undoCallback is provided, add an undo button
    if (undoCallback && typeof undoCallback === 'function') {
      t.innerHTML = `<span class="toast-icon">${icon||icons[type]||icons.info}</span><span class="toast-msg">${msg}</span><button class="t-undo-btn" style="margin-left:auto;background:var(--ac-20);border:1px solid var(--ac-40);border-radius:6px;padding:4px 10px;font-size:11px;color:var(--purple);cursor:pointer;font-family:var(--font-mono);font-weight:600;transition:all .15s;flex-shrink:0" onmouseenter="this.style.background='var(--ac-30)';this.style.borderColor='var(--ac-60)'" onmouseleave="this.style.background='var(--ac-20)';this.style.borderColor='var(--ac-40)'">UNDO</button>`;
      // Store the callback
      t._undoCallback = undoCallback;
    } else {
      t.innerHTML = `<span class="toast-icon">${icon||icons[type]||icons.info}</span><span class="toast-msg">${msg}</span>`;
    }
    
    container.appendChild(t);
    
    // Add click handler for undo button
    if (undoCallback) {
      const undoBtn = t.querySelector('.t-undo-btn');
      if (undoBtn) {
        undoBtn.onclick = function(e) {
          e.stopPropagation();
          t.classList.add('hide');
          setTimeout(() => t.remove(), 300);
          undoCallback();
        };
      }
    }
    
    requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));
    setTimeout(()=>{ t.classList.add('hide'); setTimeout(()=>t.remove(),350); }, duration);
    
    return t; // Return toast element for reference
  };
})();

// ── Startup hint toast ──
document.addEventListener('DOMContentLoaded', function() {
  const THEME_HINT_SEEN_KEY = 'etThemeHintSeen';
  const themeHintSeen = localStorage.getItem(THEME_HINT_SEEN_KEY) === '1';
  if (themeHintSeen) return;

  localStorage.setItem(THEME_HINT_SEEN_KEY, '1');
  setTimeout(function() {
    showToast('Press <kbd style="background:var(--bg4);border:1px solid var(--border2);border-radius:3px;padding:1px 5px;font-family:var(--font-mono);font-size:10px;color:var(--text)">D</kbd> to switch theme', 'info', '🎨', 4000);
    // Override the semi-transparent t-info gradient with a solid background
    const container = document.getElementById('toast-container');
    if (container) {
      const t = container.lastElementChild;
      if (t) t.style.background = 'var(--bg2)';
    }
  }, 500);
});

// ── CTRL+Z: trigger undo if undo toast is visible ──
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    const container = $('toast-container');
    if (!container) return;
    // Find any visible undo toast button
    const undoBtn = container.querySelector('.toast .t-undo-btn');
    if (undoBtn) {
      e.preventDefault();
      undoBtn.click();
    }
  }
});
(function(){
  function tryHook(){
    const orig=window.saveTrade;
    if(typeof orig==='function'&&!orig.__hooked){
      window.saveTrade=function(){
        // Record trades count before attempting save
        const tradeCountBefore = TRADES ? TRADES.length : 0;
        const r=orig.apply(this,arguments);
        setTimeout(()=>{
          const modal=$('trade-modal');
          // Only show "Trade saved" if modal actually closed AND a trade was added/modified
          // (meaning validation passed and save succeeded)
          if((!modal||modal.style.display==='none') && TRADES && TRADES.length > tradeCountBefore){
            showToast('Trade saved','success','');
          }
        },200);
        // Refresh equity curve on dashboard
        setTimeout(()=>{ if(typeof renderDashEc==='function') renderDashEc(); }, 200);
        return r;
      };
      window.saveTrade.__hooked=true;
    }
  }
  setTimeout(tryHook,500);
})();

/* ─── VIEW HISTORY (for , / . back-forward) ─── */
(function(){
  const _hist=[];
  let _histIdx=-1;
  let _navigating=false;

  const _origSwitch=window.switchView;
  window.switchView=function(el){
    const view=el?.dataset?.view;
    if(view&&!_navigating){
      if(_histIdx<_hist.length-1) _hist.splice(_histIdx+1);
      if(_hist[_histIdx]!==view){
        _hist.push(view);
        _histIdx=_hist.length-1;
      }
    }
    return _origSwitch.apply(this,arguments);
  };

  const initNav=document.querySelector('.nav-item.active');
  if(initNav?.dataset?.view){ _hist.push(initNav.dataset.view); _histIdx=0; }

  function _go(view){
    _navigating=true;
    window._histNavInProgress=true;
    const nav=document.querySelector(`.nav-item[data-view="${view}"]`);
    if(nav) nav.click();
    _navigating=false;
    // Restore scroll position for this view
    const savedY = _viewScrollPos['view-' + view];
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: savedY !== undefined ? savedY : 0, behavior: 'instant' });
        window._histNavInProgress=false;
      });
    });
  }

  window._histBack=function(){
    if(_histIdx<=0){ showToast('No previous page','info','◀'); return; }
    _histIdx--;
    _go(_hist[_histIdx]);
    const label=document.querySelector(`.nav-item[data-view="${_hist[_histIdx]}"] .nav-text`)?.textContent?.trim()||_hist[_histIdx];
    showToast('◀  '+label,'info','');
  };

  window._histForward=function(){
    if(_histIdx>=_hist.length-1){ showToast('No next page','info','▶'); return; }
    _histIdx++;
    _go(_hist[_histIdx]);
    const label=document.querySelector(`.nav-item[data-view="${_hist[_histIdx]}"] .nav-text`)?.textContent?.trim()||_hist[_histIdx];
    showToast('▶  '+label,'info','');
  };
})();

/* ─── FONT LOAD DETECTION ─── */
(function(){
  if(!document.fonts) return;
  // Check if Clash Display loaded; if not, patch to Outfit (Google)
  document.fonts.ready.then(function(){
    let clashLoaded = false, cabinetLoaded = false;
    document.fonts.forEach(function(f){
      if(f.family.toLowerCase().includes('clash')) clashLoaded = true;
      if(f.family.toLowerCase().includes('cabinet')) cabinetLoaded = true;
    });
    const root = document.documentElement;
    if(!clashLoaded && !cabinetLoaded){
      root.style.setProperty('--font-display','\'Outfit\', system-ui, sans-serif');
      root.style.setProperty('--font-body','\'Space Grotesk\', system-ui, sans-serif');
    } else if(!clashLoaded){
      root.style.setProperty('--font-display','\'Outfit\', system-ui, sans-serif');
    } else if(!cabinetLoaded){
      root.style.setProperty('--font-body','\'Space Grotesk\', system-ui, sans-serif');
    }
  });
})();

(function(){
  function labelRows(){
    $$('.trade-table tbody tr').forEach(row=>{
      const id = row.dataset.id;
      const trade = id ? TRADES.find(t=>String(t.id)===String(id)) : null;
      row.classList.remove('win-row','loss-row','be-row');
      if (trade) {
        const res = getTradeResult(trade);
        row.classList.add(res==='win'?'win-row':res==='be'?'be-row':'loss-row');
      } else {
        const cells=[...row.querySelectorAll('td')];
        const pnlCell=cells.find(td=>td.textContent.trim().startsWith('+$')||td.textContent.trim().startsWith('-$'));
        if(!pnlCell) return;
        row.classList.add(pnlCell.textContent.trim().startsWith('+')?'win-row':'loss-row');
      }
    });
  }
  setTimeout(labelRows,900);
  const tbody=document.querySelector('.trade-table tbody');
  if(tbody) new MutationObserver(labelRows).observe(tbody,{childList:true,subtree:true});
})();
