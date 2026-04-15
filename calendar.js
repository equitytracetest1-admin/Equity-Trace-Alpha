// ═══ Calendar Module ═══

// ══════════════════════════════════════════════
// SYMBOL AUTOCOMPLETE
// ══════════════════════════════════════════════
const SYM_LIST = [
  'EUR/USD','GBP/USD','USD/JPY','USD/CHF','AUD/USD','USD/CAD','NZD/USD',
  'EUR/GBP','EUR/JPY','EUR/CHF','EUR/AUD','EUR/CAD','EUR/NZD',
  'GBP/JPY','GBP/CHF','GBP/AUD','GBP/CAD','GBP/NZD',
  'AUD/JPY','AUD/CHF','AUD/CAD','AUD/NZD','CAD/JPY','CHF/JPY','NZD/JPY','NZD/CAD',
  'XAU/USD','XAG/USD','XPT/USD','XPD/USD',
  'NQ','ES','YM','RTY','DAX','FTSE','NIKKEI','HSI','CAC40','SPX','NDX','DJI','VIX',
  'BTC/USD','ETH/USD','BNB/USD','SOL/USD','XRP/USD','ADA/USD','DOGE/USD',
  'AVAX/USD','DOT/USD','MATIC/USD','LINK/USD','LTC/USD',
  'AAPL','MSFT','NVDA','TSLA','AMZN','GOOGL','META','NFLX','AMD','INTC',
  'JPM','BAC','GS','MS','V','MA','PYPL','SPY','QQQ','IWM','DIA','GLD','SLV','USO',
  'CL','NG','HG','ZC','ZS','ZW'
];
let symHighlight = -1;

function symInput(inp) {
  inp.value = inp.value.toUpperCase();
  const q = inp.value.trim();
  const dd = $('f-symbol-dd');
  if (!q) { dd.style.display='none'; return; }
  const matches = SYM_LIST.filter(s => s.replace('/','').startsWith(q.replace('/','')) || s.startsWith(q));
  if (!matches.length) { dd.style.display='none'; return; }
  symHighlight = -1;
  dd.innerHTML = matches.slice(0,10).map((s,i) =>
    `<div class="mdl-opt" data-sym="${s}" onclick="symSelect('${s}')" onmouseenter="symHover(${i})"
      style="padding:6px 14px;font-family:var(--font-mono);font-size:11px">${s}</div>`
  ).join('');
  dd.style.display = 'block';
}
function symHover(i) {
  symHighlight = i;
  $$('#f-symbol-dd .mdl-opt').forEach((o,idx) => o.classList.toggle('selected', idx===i));
}
function symSelect(val) {
  const inp = $('f-symbol');
  inp.value = val;
  $('f-symbol-dd').style.display = 'none';
  symHighlight = -1;
  inp.blur();
}
function symKeydown(e) {
  const dd = $('f-symbol-dd');
  const items = dd.querySelectorAll('.mdl-opt');
  if (dd.style.display === 'none' || !items.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); symHighlight = Math.min(symHighlight+1, items.length-1); items.forEach((o,i)=>o.classList.toggle('selected',i===symHighlight)); items[symHighlight]?.scrollIntoView({block:'nearest'}); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); symHighlight = Math.max(symHighlight-1,0); items.forEach((o,i)=>o.classList.toggle('selected',i===symHighlight)); items[symHighlight]?.scrollIntoView({block:'nearest'}); }
  else if (e.key === 'Enter') { e.preventDefault(); if(symHighlight>=0&&items[symHighlight]) symSelect(items[symHighlight].dataset.sym); else { $('f-symbol').blur(); $('f-symbol-dd').style.display='none'; } }
  else if (e.key === 'Escape') { dd.style.display='none'; }
}
document.addEventListener('click', function(e) {
  const dd = $('f-symbol-dd');
  if (dd && !dd.contains(e.target) && e.target.id !== 'f-symbol') dd.style.display = 'none';
});

// ══════════════════════════════════════════════
// DATE / TIME CLEAR + AUTOFORMAT
// ══════════════════════════════════════════════
function clearDateField() {
  if(window._fpDate) window._fpDate.clear();
  else $('f-date').value = '';
  const btn = $('f-date-clear');
  if(btn) btn.style.display='none';
}
function clearTimeField() {
  const input = $('f-time');
  input.value = '';
  if(input.dataset) input.dataset.time24h = '';
  const btn = $('f-time-clear');
  if(btn) btn.style.display='none';
}

// ══════════════════════════════════════════════
// SESSION DROPDOWN
// ══════════════════════════════════════════════
function toggleSessionDropdown() {
  const dd=$('f-session-dd');
  const open=dd.style.display!=='none';
  closeAllModalDropdowns();
  if(!open){dd.style.display='block';$('f-session-chevron').style.transform='rotate(180deg)';$('f-session-trigger').style.borderColor='var(--ac-50)';}
}
function selectSession(val) {
  $('f-session').value=val;
  $('f-session-label').textContent=val;
  $('f-session-label').style.color='var(--text)';
  $('f-session-dd').style.display='none';
  $('f-session-chevron').style.display='none';
  $('f-session-clear').style.display='block';
  $('f-session-trigger').style.borderColor='var(--border)';
}
function deleteSessionOpt(e,btn){e.stopPropagation();btn.closest('.mdl-opt-deletable').remove();}
function showAddSessionInput(){$('f-session-add-btn').style.display='none';$('f-session-add-input-row').style.display='flex';$('f-session-custom-input').focus();}
function confirmAddSession(){
  const v=$('f-session-custom-input').value.trim();
  if(!v)return;
  const el=document.createElement('div');el.className='mdl-opt mdl-opt-deletable';
  el.innerHTML=`<span class="mdl-opt-label">${v}</span><button class="mdl-del-btn" onclick="deleteSessionOpt(event,this)"><svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></button>`;
  el.onclick=()=>selectSession(v);
  $('f-session-list').appendChild(el);
  $('f-session-custom-input').value='';
  $('f-session-add-input-row').style.display='none';
  $('f-session-add-btn').style.display='flex';
  selectSession(v);
}
function addSessionKey(e){if(e.key==='Enter')confirmAddSession();else if(e.key==='Escape'){$('f-session-add-input-row').style.display='none';$('f-session-add-btn').style.display='flex';}}

// ══════════════════════════════════════════════
// ACCOUNT DROPDOWN
// ══════════════════════════════════════════════
function toggleAccountDropdown() {
  const dd=$('f-account-dd');
  const open=dd.style.display!=='none';
  closeAllModalDropdowns();
  if(!open){dd.style.display='block';$('f-account-chevron').style.transform='rotate(180deg)';$('f-account-trigger').style.borderColor='var(--ac-50)';}
}
function selectAccount(val) {
  $('f-account').value=val;
  $('f-account-label').textContent=val;
  $('f-account-label').style.color='var(--text)';
  $('f-account-dd').style.display='none';
  $('f-account-chevron').style.display='none';
  $('f-account-clear').style.display='block';
  $('f-account-trigger').style.borderColor='var(--border)';
  // Recalculate PnL with new account leverage
  if (typeof calcPnl === 'function') calcPnl();
}
function deleteAccountOpt(e,btn){e.stopPropagation();btn.closest('.mdl-opt-deletable').remove();}
function showAddAccountInput(){
  // Close the account dropdown, close the trade modal, navigate to Accounts page, open Add Account modal
  closeAllModalDropdowns();
  if (typeof closeModal === 'function') closeModal();
  const navItem = document.querySelector('.nav-item[data-view="accounts"]');
  if (navItem && typeof switchView === 'function') {
    switchView(navItem);
    setTimeout(function() {
      if (typeof openAddAccountModal === 'function') openAddAccountModal();
    }, 150);
  }
}
function confirmAddAccount(){
  const v=$('f-account-custom-input').value.trim();
  if(!v)return;
  const el=document.createElement('div');el.className='mdl-opt mdl-opt-deletable';
  el.innerHTML=`<span class="mdl-opt-label">${v}</span><button class="mdl-del-btn" onclick="deleteAccountOpt(event,this)"><svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></button>`;
  el.onclick=()=>selectAccount(v);
  $('f-account-list').appendChild(el);
  $('f-account-custom-input').value='';
  $('f-account-add-input-row').style.display='none';
  $('f-account-add-btn').style.display='flex';
  selectAccount(v);
}
function addAccountKey(e){if(e.key==='Enter')confirmAddAccount();else if(e.key==='Escape'){$('f-account-add-input-row').style.display='none';$('f-account-add-btn').style.display='flex';}}

// ══════════════════════════════════════════════
// SETUP DROPDOWN
// ══════════════════════════════════════════════
function toggleSetupDropdown() {
  const dd=$('f-setup-dd');
  const open=dd.style.display!=='none';
  closeAllModalDropdowns();
  if(!open){dd.style.display='block';$('f-setup-chevron').style.transform='rotate(180deg)';$('f-setup-trigger').style.borderColor='var(--ac-50)';}
}
function selectSetup(val) {
  $('f-setup').value=val;
  $('f-setup-label').textContent=val;
  $('f-setup-label').style.color='var(--text)';
  $('f-setup-dd').style.display='none';
  $('f-setup-chevron').style.display='none';
  $('f-setup-clear').style.display='block';
  $('f-setup-trigger').style.borderColor='var(--border)';
}
function deleteSetupOpt(e,btn){e.stopPropagation();btn.closest('.mdl-opt-deletable').remove();}
function showAddSetupInput(){$('f-setup-add-btn').style.display='none';$('f-setup-add-input-row').style.display='flex';$('f-setup-custom-input').focus();}
function confirmAddSetup(){
  const v=$('f-setup-custom-input').value.trim();
  if(!v)return;
  const el=document.createElement('div');el.className='mdl-opt mdl-opt-deletable';
  el.innerHTML=`<span class="mdl-opt-label">${v}</span><button class="mdl-del-btn" onclick="deleteSetupOpt(event,this)"><svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></button>`;
  el.onclick=()=>selectSetup(v);
  $('f-setup-list').appendChild(el);
  $('f-setup-custom-input').value='';
  $('f-setup-add-input-row').style.display='none';
  $('f-setup-add-btn').style.display='flex';
  selectSetup(v);
}
function addSetupKey(e){if(e.key==='Enter')confirmAddSetup();else if(e.key==='Escape'){$('f-setup-add-input-row').style.display='none';$('f-setup-add-btn').style.display='flex';}}

// ══════════════════════════════════════════════
// CLEAR DROPDOWN HELPER
// ══════════════════════════════════════════════
function clearDropdown(name, e) {
  if(e){e.stopPropagation();}
  $('f-'+name).value='';
  const lbl = $('f-'+name+'-label');
  lbl.textContent = name==='model' ? 'Add entry model' : 'Select...';
  lbl.style.color='var(--text3)';
  $('f-'+name+'-clear').style.display='none';
  const ch = $('f-'+name+'-chevron');
  if(ch){ch.style.display='';ch.style.transform='';}
  $('f-'+name+'-dd').style.display='none';
}

function closeAllModalDropdowns() {
  ['setup','session','account','model'].forEach(n => {
    const dd=$('f-'+n+'-dd');
    if(dd) dd.style.display='none';
    const ch=$('f-'+n+'-chevron');
    if(ch) ch.style.transform='';
    const tr=$('f-'+n+'-trigger');
    if(tr) tr.style.borderColor='var(--border)';
  });
}

// Close dropdowns on outside click (capture phase so it works inside modal, which stops bubbling)
document.addEventListener('click', function(e) {
  ['setup','session','account','model'].forEach(n => {
    const dd=$('f-'+n+'-dd');
    const tr=$('f-'+n+'-trigger');
    if(dd && tr && dd.style.display!=='none' && !dd.contains(e.target) && e.target!==tr && !tr.contains(e.target)){
      dd.style.display='none';
      const ch=$('f-'+n+'-chevron'); if(ch) ch.style.transform='';
      tr.style.borderColor='var(--border)';
    }
  });
}, true);

// ══════════════════════════════════════════════
// ANALOG CLOCK
// ══════════════════════════════════════════════
(function(){
  let clkMode='hr', clkHour=0, clkMin=0, clkAMPM='AM', clkOpen=false, isDragging=false;

  function clkDraw() {
    const canvas=$('clk-canvas');
    if(!canvas)return;
    const ctx=canvas.getContext('2d');
    const cx=90,cy=90,R=82;
    ctx.clearRect(0,0,180,180);
    // Get computed background color from CSS variable
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg3').trim() || '#1a1d28';
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#fff';
    const textMuted = getComputedStyle(document.documentElement).getPropertyValue('--text3').trim() || 'rgba(160,168,190,.7)';
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.fillStyle=bgColor;ctx.fill();
    ctx.strokeStyle='var(--ac-30)';ctx.lineWidth=1.5;ctx.stroke();
    for(let i=0;i<12;i++){
      const a=(i/12)*Math.PI*2-Math.PI/2;
      const inner=i%3===0?R-12:R-8;
      ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*inner,cy+Math.sin(a)*inner);
      ctx.lineTo(cx+Math.cos(a)*(R-4),cy+Math.sin(a)*(R-4));
      ctx.strokeStyle=i%3===0?'var(--ac-70)':'var(--ac-30)';
      ctx.lineWidth=i%3===0?2:1;ctx.stroke();
    }
    if(clkMode==='hr'){
      for(let i=1;i<=12;i++){
        const a=(i/12)*Math.PI*2-Math.PI/2;
        ctx.font='700 11px JetBrains Mono,monospace';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillStyle=(i===clkHour%12||(clkHour===0&&i===12))?textColor:textMuted;
        ctx.fillText(i,cx+Math.cos(a)*(R-22),cy+Math.sin(a)*(R-22));
      }
    } else {
      for(let i=0;i<12;i++){
        const m=i*5,a=(i/12)*Math.PI*2-Math.PI/2;
        ctx.font='700 10px JetBrains Mono,monospace';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillStyle=Math.abs(clkMin-m)<3?textColor:textMuted;
        ctx.fillText(m===0?'00':m,cx+Math.cos(a)*(R-22),cy+Math.sin(a)*(R-22));
      }
    }
    const val=clkMode==='hr'?(clkHour%12)/12:clkMin/60;
    const ha=val*Math.PI*2-Math.PI/2,hl=R-26;
    ctx.shadowColor='var(--ac-60)';ctx.shadowBlur=8;
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(ha)*hl,cy+Math.sin(ha)*hl);
    ctx.strokeStyle='#a97de8';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.stroke();
    ctx.shadowBlur=0;
    ctx.beginPath();ctx.arc(cx,cy,5,0,Math.PI*2);ctx.fillStyle='var(--purple)';ctx.fill();
    ctx.beginPath();ctx.arc(cx+Math.cos(ha)*hl,cy+Math.sin(ha)*hl,9,0,Math.PI*2);
    ctx.fillStyle='var(--ac-90)';ctx.fill();
    ctx.beginPath();ctx.arc(cx+Math.cos(ha)*hl,cy+Math.sin(ha)*hl,4,0,Math.PI*2);
    ctx.fillStyle=textColor;ctx.fill();
  }

  function clkUpdateDisplay(){
    const hd=$('clk-hr-display');
    const md=$('clk-min-display');
    if(hd)hd.textContent=String(clkHour).padStart(2,'0');
    if(md)md.textContent=String(clkMin).padStart(2,'0');
    // Update AM/PM button styles
    const amBtn=$('clk-am-btn');
    const pmBtn=$('clk-pm-btn');
    if(amBtn){
      amBtn.style.background=clkAMPM==='AM'?'var(--purple)':'var(--bg4)';
      amBtn.style.color=clkAMPM==='AM'?'#fff':'var(--text3)';
    }
    if(pmBtn){
      pmBtn.style.background=clkAMPM==='PM'?'var(--purple)':'var(--bg4)';
      pmBtn.style.color=clkAMPM==='PM'?'#fff':'var(--text3)';
    }
  }

  window.clkSetMode=function(mode){
    clkMode=mode;
    ['hr','min'].forEach(m=>{
      const btn=$('clk-tab-'+m);
      if(!btn)return;
      btn.style.background=m===mode?'var(--purple)':'var(--bg4)';
      btn.style.color=m===mode?'#fff':'var(--text3)';
      btn.style.borderColor=m===mode?'var(--ac-40)':'var(--border)';
    });
    $('clk-hr-display').style.color=mode==='hr'?'var(--purple)':'var(--text2)';
    $('clk-min-display').style.color=mode==='min'?'var(--purple)':'var(--text2)';
    clkDraw();
  };

  window.clkSetAMPM=function(period){
    clkAMPM=period;
    clkUpdateDisplay();
  };

  function clkApplyXY(x,y){
    const angle=Math.atan2(y,x)+Math.PI/2;
    const norm=((angle%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
    if(clkMode==='hr') clkHour=Math.round(norm/(Math.PI*2)*12)%12;
    else clkMin=Math.round(norm/(Math.PI*2)*60)%60;
    clkUpdateDisplay();clkDraw();
  }

  window.clkCancel=function(){$('analog-clock-popup').style.display='none';clkOpen=false;isDragging=false;};
  window.clkConfirm=function(){
    // Convert 12-hour time to 24-hour format
    let hour24=clkHour;
    if(clkAMPM==='PM'&&clkHour!==12)hour24=clkHour+12;
    if(clkAMPM==='AM'&&clkHour===12)hour24=0;
    const val24h=String(hour24).padStart(2,'0')+':'+String(clkMin).padStart(2,'0');
    // Store 24-hour format as data attribute for internal use
    $('f-time').dataset.time24h=val24h;
    // Display 12-hour format to user
    $('f-time').value=typeof formatTradeTime==='function'?formatTradeTime(val24h):format24to12Hour(val24h);
    const btn=$('f-time-clear');if(btn)btn.style.display='block';
    $('analog-clock-popup').style.display='none';clkOpen=false;
  };

  function clkPos(){
    const inp=$('f-time');
    const pop=$('analog-clock-popup');
    if(!inp||!pop)return;
    const rect=inp.getBoundingClientRect();
    let top=rect.top-360;
    if(top<8)top=rect.bottom+8;
    let left=rect.left;
    if(left+240>window.innerWidth-8)left=window.innerWidth-248;
    pop.style.top=top+'px';pop.style.left=left+'px';
  }

  document.addEventListener('DOMContentLoaded',function(){
    const inp=$('f-time');
    const pop=$('analog-clock-popup');
    const canvas=$('clk-canvas');
    if(!inp||!pop||!canvas)return;

    inp.addEventListener('keydown', function(e){
      if(e.key === 'Enter'){ e.preventDefault(); inp.blur(); $('f-symbol-dd').style.display='none'; }
    });
    inp.addEventListener('click',function(e){
      e.stopPropagation();
      if(inp.value){
        const p=inp.value.split(':');
        let hour24=parseInt(p[0])||0;
        clkMin=parseInt(p[1])||0;
        // Convert 24-hour to 12-hour format
        if(hour24===0){clkHour=12;clkAMPM='AM';}
        else if(hour24<12){clkHour=hour24;clkAMPM='AM';}
        else if(hour24===12){clkHour=12;clkAMPM='PM';}
        else{clkHour=hour24-12;clkAMPM='PM';}
      }
      else{
        const n=new Date();
        let hour24=n.getHours();
        clkMin=n.getMinutes();
        // Convert current time to 12-hour format
        if(hour24===0){clkHour=12;clkAMPM='AM';}
        else if(hour24<12){clkHour=hour24;clkAMPM='AM';}
        else if(hour24===12){clkHour=12;clkAMPM='PM';}
        else{clkHour=hour24-12;clkAMPM='PM';}
      }
      clkSetMode('hr');clkUpdateDisplay();clkDraw();clkPos();
      pop.style.display='block';clkOpen=true;
    });

    // Auto-format HH:MM + show clear btn
    inp.addEventListener('input',function(){
      let v=inp.value.replace(/[^0-9]/g,'');
      if(v.length>=3)v=v.slice(0,2)+':'+v.slice(2,4);
      inp.value=v;
      const btn=$('f-time-clear');
      if(btn)btn.style.display=inp.value.trim()?'block':'none';
    });

    // Drag on canvas
    canvas.addEventListener('mousedown',function(e){
      e.preventDefault();
      const rect=canvas.getBoundingClientRect();
      const x=e.clientX-rect.left-90,y=e.clientY-rect.top-90;
      if(Math.sqrt(x*x+y*y)>82)return;
      isDragging=true;canvas.style.cursor='grabbing';
      clkApplyXY(x,y);
    });
    document.addEventListener('mousemove',function(e){
      if(!isDragging)return;
      const rect=canvas.getBoundingClientRect();
      let x=e.clientX-rect.left-90,y=e.clientY-rect.top-90;
      const d=Math.sqrt(x*x+y*y);
      if(d>78){x=x/d*78;y=y/d*78;}
      clkApplyXY(x,y);
    });
    document.addEventListener('mouseup',function(){
      if(!isDragging)return;
      isDragging=false;canvas.style.cursor='grab';
      if(clkMode==='hr')setTimeout(()=>clkSetMode('min'),120);
    });

    document.addEventListener('click',function(e){
      if(clkOpen&&!pop.contains(e.target)&&e.target!==inp)clkCancel();
    });

    // Date auto-format + clear btn
    const dateInp=$('f-date');
    if(dateInp){
      dateInp.addEventListener('input',function(){
        let v=this.value.replace(/[^0-9]/g,'');
        if(v.length>=5)v=v.slice(0,4)+'-'+v.slice(4);
        if(v.length>=8)v=v.slice(0,7)+'-'+v.slice(7,9);
        this.value=v;
        const btn=$('f-date-clear');
        if(btn)btn.style.display=this.value.trim()?'block':'none';
      });
    }

    // Init flatpickr for date
    if(typeof flatpickr!=='undefined'){
      window._fpDate=flatpickr('#f-date',{
        dateFormat:'Y-m-d',disableMobile:true,allowInput:true,
        onChange:function(_,dateStr){
          const btn=$('f-date-clear');
          if(btn)btn.style.display=dateStr?'block':'none';
        }
      });
    }
  });
})();

// ══════════════════════════════════════════════
// INCOMPLETE TRADE CONFIRMATION
// ══════════════════════════════════════════════
let _pendingSaveFn=null;
function incompleteCancel(){$('incomplete-confirm-overlay').style.display='none';_pendingSaveFn=null;}
function incompleteSave(){$('incomplete-confirm-overlay').style.display='none';if(_pendingSaveFn){_pendingSaveFn();_pendingSaveFn=null;}}

// ══════════════════════════════════════════════
// SAVE TRADE (with incomplete check)
// Override the original saveTrade
// ══════════════════════════════════════════════
const _origSaveTrade = window.saveTrade;
window.saveTrade = function() {
  const sym=$('f-symbol').value.trim();
  const entry=parseFloat($('f-entry').value)||0;
  const exit=parseFloat($('f-exit').value)||0;
  const size=Math.abs(parseFloat($('f-size').value))||0;
  const account=$('f-account').value||'';

  // REQUIRED fields validation — block save if missing
  const requiredErrors = [];
  if(!sym) requiredErrors.push('Symbol');
  if(entry<=0) requiredErrors.push('Entry Price');
  if(exit<=0) requiredErrors.push('Exit Price');
  if(size<=0) requiredErrors.push('Lot Size');
  if(!account) requiredErrors.push('Account');
  if(entry === exit) requiredErrors.push('Entry/Exit same price');
  
  // If required fields are missing, show error and don't save at all
  if(requiredErrors.length>0){
    // Show validation error using showToast
    if(typeof showToast==='function'){
      showToast('Missing required fields: ' + requiredErrors.join(', '), 'error', '⚡', 3000);
    }
    return; // Do NOT call _origSaveTrade
  }
  
  // All required fields are present, just call original save
  _origSaveTrade();
};

// ══════════════════════════════════════════════
// LAYERED ESC + ENTER HANDLER (override existing)
// ══════════════════════════════════════════════
document.addEventListener('keydown', function(e) {
  const modalOpen = $('modal-overlay').classList.contains('open');
  if (!modalOpen) return;

  const tag=document.activeElement.tagName;
  const isTyping=tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||document.activeElement.isContentEditable;

  // incomplete confirm overlay intercepts both Enter and Esc
  if($('incomplete-confirm-overlay').style.display==='flex'){
    if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();incompleteSave();return;}
    if(e.key==='Escape'){e.stopImmediatePropagation();incompleteCancel();return;}
  }

  if (e.key==='Escape') {
    e.stopImmediatePropagation();
    // symbol dd
    const symDd=$('f-symbol-dd');
    if(symDd&&symDd.style.display!=='none'){symDd.style.display='none';return;}
    // flatpickr calendar
    if(window._fpDate&&window._fpDate.isOpen){window._fpDate.close();return;}
    // analog clock
    if($('analog-clock-popup').style.display!=='none'){clkCancel();return;}
    // open dropdown
    const dds=['f-setup-dd','f-model-dd','f-session-dd','f-account-dd'];
    for(const id of dds){const dd=$(id);if(dd&&dd.style.display!=='none'){dd.style.display='none';return;}}
    // add input rows
    const rows=['f-setup-add-input-row','f-model-add-input-row','f-session-add-input-row','f-account-add-input-row'];
    for(const id of rows){const row=$(id);if(row&&row.style.display==='flex'){row.style.display='none';const base=id.replace('-add-input-row','');const btn=$(base+'-add-btn');if(btn)btn.style.display='flex';return;}}
    // blur focused input
    if(isTyping){document.activeElement.blur();return;}
    // close modal
    if(typeof closeModal==='function')closeModal();
    return;
  }

  if (e.key==='Enter' && !isTyping) {
    const anyOpen=['f-setup-dd','f-model-dd','f-session-dd','f-account-dd','f-symbol-dd'].some(id=>{const d=$(id);return d&&d.style.display!=='none';});
    const clockOpen=$('analog-clock-popup').style.display!=='none';
    const calOpen=window._fpDate&&window._fpDate.isOpen;
    if(!anyOpen&&!clockOpen&&!calOpen){e.preventDefault();window.saveTrade();}
  }
}, true);

// ══════════════════════════════════════════════
// ── ADVANCED ANALYTICS — LIVE REFRESH ──
// Called whenever TRADES changes (save/delete/undo)
// ══════════════════════════════════════════════
function refreshAdvAnalytics() {
  const activeView = document.querySelector('.view.active');
  if (!activeView || activeView.id !== 'view-advanalytics') return;
  const barP4 = $('an-acct-bar-p4');
  if (barP4) barP4.innerHTML = buildAnAccountBar();
  // Hide equity curve when All Accounts is selected
  const equityPanel = document.querySelector('#advan-grid .panel');
  const isAll = !anCurrentAccount || anCurrentAccount === '__all__';
  if (equityPanel) equityPanel.style.display = isAll ? 'none' : '';
  if (!isAll) initEquityCurve(ecCurrentPeriod || 'all');
  // Reset month filter on account change
  _mpSelectedMonths.clear();
  const clearBtn = $('mp-clear-btn');
  if (clearBtn) clearBtn.style.display = 'none';
  const chipsEl = $('mp-month-chips');
  if (chipsEl) chipsEl.dataset.built = ''; // force chip rebuild
  initMonthlyPnL();
  initRMultiple();
  initSymbolBreakdown();
  initStreaks();
}

// ══════════════════════════════════════════════
// ── ADVANCED ANALYTICS — 01 EQUITY CURVE ── v2
// ══════════════════════════════════════════════
// Returns the starting balance for a given account trade-label (e.g. "FTM Prop Firm - Phase 1")
function getAcctStartBal(acctName) {
  if (!acctName) return ACCOUNT_SIZE || 25000;
  const match = ACCOUNTS.find(a => (a.key || a.phase) === acctName);
  return match ? match.startBal : (ACCOUNT_SIZE || 25000);
}

let ecChartInst = null;
let ecCurrentPeriod = 'all';

function ecSetPeriod(btn, period) {
  $$('#view-advanalytics .pan-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ecCurrentPeriod = period;
  initEquityCurve(ecCurrentPeriod);
}

function getAcctStartBal(acctName) {
  if (!acctName) return ACCOUNT_SIZE || 25000;
  const match = ACCOUNTS.find(a => (a.key || a.phase) === acctName);
  return match ? match.startBal : (ACCOUNT_SIZE || 25000);
}

function initEquityCurve(period) {
  const canvas = $('ec-chart');
  if (!canvas) return;

  const light = document.documentElement.classList.contains('light');
  const now = new Date();

  const acctName = anCurrentAccount && anCurrentAccount !== '__all__' ? anCurrentAccount : null;
  const acct = acctName ? ACCOUNTS.find(a => (a.key || a.phase) === acctName) : null;

  let allSorted = [...TRADES]
    .filter(t => acctName ? (t.account || '') === acctName : true)
    .sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time));

  if (period === 'week') {
    const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 7);
    allSorted = allSorted.filter(t => new Date(t.date) >= cutoff);
  } else if (period === 'month') {
    const cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 1);
    allSorted = allSorted.filter(t => new Date(t.date) >= cutoff);
  }

  if (ecChartInst) { ecChartInst.destroy(); ecChartInst = null; }

  if (!allSorted.length) {
    ['ec-stat-start','ec-stat-current','ec-stat-peak','ec-stat-mdd'].forEach(id => {
      const el = $(id); if(el) el.textContent = '—';
    });
    const ctx0 = canvas.getContext('2d');
    ctx0.clearRect(0,0,canvas.width,canvas.height);
    ctx0.save(); ctx0.fillStyle = light?'#8890a8':'#4a5068'; ctx0.font='11px "JetBrains Mono",monospace'; ctx0.textAlign='center';
    ctx0.fillText('No trades in this period', canvas.width/2, 80); ctx0.restore();
    return;
  }

  const baseline = acct ? acct.startBal : (ACCOUNTS[0]?.startBal || 25000);
  const profitTarget = acct ? Math.round(baseline*(1+(acct.profitTarget||8)/100)) : Math.round(baseline*1.08);
  const maxLoss      = acct ? Math.round(baseline*(1-(acct.maxDrawdown||8)/100))  : Math.round(baseline*0.92);
  const dailyLossVal = acct ? Math.round(baseline*(1-(acct.dailyLoss||4)/100))    : Math.round(baseline*0.97);

  let running = baseline;
  const data   = [running];
  const labels = ['Start'];
  allSorted.forEach((t,i) => { running += (t.pnl||0); data.push(running); labels.push(`#${i+1}`); });

  const pad  = Math.round((profitTarget - maxLoss) * 0.05);
  const yMin = maxLoss - pad;
  const yMax = profitTarget + pad;

  const refLines = [
    { value: profitTarget, color: '#2ecc8a', label: 'Profit Target' },
    { value: baseline,     color: '#8890a8', label: 'Initial'       },
    { value: dailyLossVal, color: '#f5a623', label: 'Daily Loss'    },
    { value: maxLoss,      color: '#e8504a', label: 'Max Loss'      },
  ];

  const fmt = v => '$'+v.toFixed(2);
  const netPnl = running - baseline;
  const peakBal = Math.max(...data);
  const mddDollar = (() => { let pk=data[0],dd=0; data.forEach(v=>{ if(v>pk)pk=v; if(pk-v>dd)dd=pk-v; }); return dd; })();
  const elStart = $('ec-stat-start'); if(elStart) elStart.textContent = fmt(baseline);
  const elStartPct = $('ec-stat-start-pct'); if(elStartPct) elStartPct.textContent = acct ? acct.phase : '';
  const elCur = $('ec-stat-current'); if(elCur){ elCur.textContent = fmt(running); elCur.style.color = netPnl>=0?'var(--green)':'var(--red)'; }
  const elCurPct = $('ec-stat-current-pct'); if(elCurPct){ const p=(netPnl/baseline*100); elCurPct.textContent=(p>=0?'+':'')+p.toFixed(2)+'%'; elCurPct.style.color=p>=0?'var(--green)':'var(--red)'; }
  const elPeak = $('ec-stat-peak'); if(elPeak) elPeak.textContent = fmt(peakBal);
  const elPeakPct = $('ec-stat-peak-pct'); if(elPeakPct){ const p=((peakBal-baseline)/baseline*100); elPeakPct.textContent=(p>=0?'+':'')+p.toFixed(2)+'% from start'; }
  const elMDD = $('ec-stat-mdd'); if(elMDD){ elMDD.textContent = mddDollar>0?'-'+fmt(mddDollar):'$0.00'; elMDD.style.color=mddDollar>0?'var(--red)':'var(--green)'; }
  const elMDDPct = $('ec-stat-mdd-pct'); if(elMDDPct){ const p=(mddDollar/baseline*100); elMDDPct.textContent=mddDollar>0?'-'+p.toFixed(2)+'% of account':'No drawdown'; }
  const legendEl = $('ec-legend');
  if(legendEl) legendEl.innerHTML = `<div style="display:flex;align-items:center;gap:6px"><div style="width:20px;height:2px;background:#2ecc8a;border-radius:1px"></div><span style="font-size:10px;font-family:var(--font-mono);color:var(--text3)">${acctName||'All Accounts'}</span></div><div style="margin-left:auto;font-size:10px;font-family:var(--font-mono);color:var(--text3)">#1 → #${allSorted.length}  ·  ${allSorted[0].date} → ${allSorted[allSorted.length-1].date}</div>`;

  // Hover card for ec-chart (page 4)
  let ecHoveredLine = null;
  const ecCanvasWrap = canvas.parentElement;
  ecCanvasWrap.style.position = 'relative';

  let ecRefCard = $('ec-ref-hover-card');
  if (!ecRefCard) {
    ecRefCard = document.createElement('div');
    ecRefCard.id = 'ec-ref-hover-card';
    ecRefCard.style.cssText = 'display:none;position:absolute;pointer-events:none;background:var(--bg2);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:10px 14px;font-family:"JetBrains Mono",monospace;font-size:10px;z-index:50;white-space:nowrap;box-shadow:0 8px 32px rgba(0,0,0,.5);min-width:160px';
    ecCanvasWrap.appendChild(ecRefCard);
  }

  canvas.addEventListener('mousemove', function ecHoverMove(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    if (!ecChartInst) return;
    const yScale = ecChartInst.scales.y;
    let found = null;
    refLines.forEach(l => { if (Math.abs(mouseY - yScale.getPixelForValue(l.value)) < 10) found = l; });
    const foundVal = found ? found.value : null;
    if (foundVal !== ecHoveredLine) { ecHoveredLine = foundVal; ecChartInst.draw(); }
    if (found) {
      const currentEquity = data[data.length - 1];
      const diff = found.value - currentEquity;
      const diffStr = (diff >= 0 ? '+' : '-') + '$' + Math.abs(diff).toFixed(2);
      const diffColor = diff >= 0 ? 'var(--green)' : 'var(--red)';
      ecRefCard.innerHTML = `
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
      ecRefCard.style.display = 'block';
      const cardW = ecRefCard.offsetWidth;
      const cardH = ecRefCard.offsetHeight;
      if (cardX + cardW > rect.width - 10) cardX = mouseX - cardW - 14;
      if (cardY + cardH > rect.height - 10) cardY = rect.height - cardH - 10;
      ecRefCard.style.left = cardX + 'px';
      ecRefCard.style.top = cardY + 'px';
    } else {
      ecRefCard.style.display = 'none';
    }
  });
  canvas.addEventListener('mouseleave', function ecHoverLeave() {
    ecHoveredLine = null;
    if (ecRefCard) ecRefCard.style.display = 'none';
    if (ecChartInst) ecChartInst.draw();
  });

  const refLinePlugin = {
    id: 'ecRefLines',
    afterDraw(chart) {
      const { ctx: c, chartArea:{left,right}, scales:{y} } = chart;
      refLines.forEach(({value,color,label}) => {
        const yPos = y.getPixelForValue(value);
        if (yPos < y.top || yPos > y.bottom) return;
        const isHov = ecHoveredLine === value;
        c.save();
        c.setLineDash([3,4]); c.strokeStyle=color; c.lineWidth=isHov?2:1.5; c.globalAlpha=isHov?1:0.6;
        c.beginPath(); c.moveTo(left,yPos); c.lineTo(right,yPos); c.stroke();
        c.setLineDash([]);
        c.font='9px "JetBrains Mono",monospace'; c.fillStyle=color; c.globalAlpha=isHov?1:0.6;
        c.textAlign='right'; c.textBaseline='bottom';
        c.fillText(label+'  $'+value.toFixed(2), right-4, yPos-2);
        c.restore();
      });
    }
  };

  const ctx = canvas.getContext('2d');
  ecChartInst = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label:'Equity', data,
      borderWidth:2, fill:false,
      segment:{ borderColor: c2=>{ const avg=((c2.p0.parsed.y||0)+(c2.p1.parsed.y||0))/2; return avg<baseline?'#8c1a0e':'#0e8c50'; } },
      tension:.4, pointRadius: data.length>40?0:3,
      pointBackgroundColor: data.map(v=>v<baseline?'#8c1a0e':'#0e8c50'),
      pointBorderColor:'#0b0c0f', pointBorderWidth:2, pointHoverRadius:7,
      pointHoverBackgroundColor: data.map(v=>v<baseline?'#e8504a':'#2ecc8a'),
      pointHoverBorderColor:'#ffffff', pointHoverBorderWidth:2
    }]},
    plugins:[refLinePlugin,{
      id:'ecSegFill',
      afterDraw(chart){
        const {ctx:c,chartArea,scales}=chart;
        const pts=chart.getDatasetMeta(0).data;
        if(!pts.length)return;
        c.save(); c.beginPath(); c.rect(chartArea.left,chartArea.top,chartArea.width,chartArea.height); c.clip();
        for(let i=0;i<pts.length-1;i++){
          const avg=(data[i]+data[i+1])/2, col=avg<baseline?'140,26,14':'14,140,80';
          const grad=c.createLinearGradient(0,Math.min(pts[i].y,pts[i+1].y),0,chartArea.bottom);
          grad.addColorStop(0,`rgba(${col},.3)`); grad.addColorStop(1,`rgba(${col},0)`);
          c.beginPath(); c.moveTo(pts[i].x,pts[i].y); c.lineTo(pts[i+1].x,pts[i+1].y);
          c.lineTo(pts[i+1].x,chartArea.bottom); c.lineTo(pts[i].x,chartArea.bottom);
          c.closePath(); c.fillStyle=grad; c.fill();
        }
        c.restore();
      }
    }],
    options:{
      responsive:true, maintainAspectRatio:true,
      plugins:{ legend:{display:false},
        tooltip:{
          backgroundColor:light?'#ffffff':'#111318', titleColor:light?'#0a0b10':'#dde1ef',
          bodyColor:light?'#1a1d2e':'#a0a8be', borderColor:light?'rgba(0,0,0,.12)':'rgba(255,255,255,.1)', borderWidth:1,
          titleFont:{family:'JetBrains Mono',size:11}, bodyFont:{family:'JetBrains Mono',size:11},
          callbacks:{
            label: ctx2=>{ const v=ctx2.raw; if(ctx2.dataIndex===0) return fmt(v); const pnl=v-ctx2.dataset.data[ctx2.dataIndex-1]; return fmt(v)+'  ('+(pnl>=0?'+':'-')+'$'+Math.abs(pnl).toFixed(2)+')'; },
            title: ctx2=>ctx2[0].label==='Start'?'Starting Balance':`Trade ${ctx2[0].label}`
          }
        }
      },
      onClick(e,elements){
        if(!elements.length)return; const idx=elements[0].index; if(idx===0)return;
        const trade=allSorted[idx-1]; if(!trade)return;
        // Sync account into selectedAcct so trade log filters correctly
        if(typeof anCurrentAccount!=='undefined'&&anCurrentAccount&&anCurrentAccount!=='__all__'){
          const mi=ACCOUNTS.findIndex(a=>(a.key||a.phase)===anCurrentAccount);
          if(mi!==-1&&typeof selectAcct==='function') selectAcct(mi);
        }
        _detailOriginView='advanalytics';
        document.querySelector('[data-view="tradelog"]').click();
        setTimeout(()=>{ const row=document.querySelector(`.trade-table tbody tr[data-id="${trade.id}"]`); showDetail(trade,row||document.createElement('tr')); if(row){row.scrollIntoView({behavior:'smooth',block:'center'});row.classList.add('selected-row');} },80);
      },
      onHover:(e,elements)=>{ e.native.target.style.cursor=elements.length&&elements[0].index>0?'pointer':'default'; },
      scales:{
        x:{ grid:{color:light?'rgba(0,0,0,.12)':'rgba(255,255,255,.06)'}, ticks:{color:light?'#0a0b10':(document.documentElement.classList.contains('medium')?'#a0a8be':'#6a7090'),font:{family:'JetBrains Mono',size:9},maxTicksLimit:12} },
        y:{ min:yMin, max:yMax, grid:{color:light?'rgba(0,0,0,.12)':'rgba(255,255,255,.06)'},
          ticks:{color:light?'#0a0b10':(document.documentElement.classList.contains('medium')?'#a0a8be':'#6a7090'),font:{family:'JetBrains Mono',size:9},
            callback:v=>[profitTarget,baseline,dailyLossVal,maxLoss].includes(v)?'$'+v.toFixed(2):'',
            afterBuildTicks:axis=>{axis.ticks=[maxLoss,dailyLossVal,baseline,profitTarget].map(v=>({value:v}));}
          }
        }
      }
    }
  });
  window.ecChartInst = ecChartInst;
}

// toggleDDMode stub
function toggleDDMode() {
  const btnPeak = $('ec-dd-btn-peak');
  const btnInit = $('ec-dd-btn-init');
  const elL = $('ec-mdd-label');
  const isPeak = btnPeak && btnPeak.style.background.includes('purple');
  if (btnPeak) { btnPeak.style.background = isPeak ? 'transparent' : 'var(--purple)'; btnPeak.style.color = isPeak ? 'var(--text3)' : '#fff'; }
  if (btnInit) { btnInit.style.background = isPeak ? 'var(--purple)' : 'transparent'; btnInit.style.color = isPeak ? '#fff' : 'var(--text3)'; }
  if (elL) elL.textContent = isPeak ? 'DD From Start' : 'DD From Peak';
}

let ddChartInst = null;
let ddCurrentPeriod = 'all';
const DD_LIMIT_PCT = 5;

function ddSetPeriod(btn, period) {
  $$('#view-advanalytics .panel:nth-child(2) .pan-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ddCurrentPeriod = period;
  initDrawdownChart(period);
}

function initDrawdownChart(period) {
  const canvas = $('dd-chart');
  if (!canvas) return;
  const startBal = getAccountSize();
  const now = new Date();
  let trades = [...getAnTrades()].sort((a,b) =>
    new Date(a.date+' '+(a.time||'00:00')) - new Date(b.date+' '+(b.time||'00:00'))
  );
  if (period === 'week') {
    const c = new Date(now); c.setDate(c.getDate()-7);
    trades = trades.filter(t => new Date(t.date) >= c);
  } else if (period === 'month') {
    const c = new Date(now); c.setMonth(c.getMonth()-1);
    trades = trades.filter(t => new Date(t.date) >= c);
  }
  if (!trades.length) {
    if (ddChartInst) { ddChartInst.destroy(); ddChartInst = null; }
    ['dd-stat-max','dd-stat-cur','dd-stat-avg','dd-stat-limit','dd-pill-max','dd-pill-cur','dd-pill-avg'].forEach(id => {
      const el = $(id); if (el) el.textContent = '—';
    });
    return;
  }
  let balance = startBal, peak = startBal;
  const ddSeries = [0], balSeries = [startBal], labels = ['Start'];
  let maxDD = 0, ddSum = 0, ddCount = 0;
  trades.forEach(t => {
    balance += t.pnl;
    if (balance > peak) peak = balance;
    const dd = peak > 0 ? ((peak - balance) / peak) * 100 : 0;
    ddSeries.push(parseFloat(dd.toFixed(3)));
    balSeries.push(parseFloat(balance.toFixed(2)));
    labels.push(t.date + (t.time ? ' '+(typeof formatTradeTime==='function'?formatTradeTime(t.time):format24to12Hour(t.time)) : ''));
    if (dd > maxDD) maxDD = dd;
    if (dd > 0) { ddSum += dd; ddCount++; }
  });
  const currentDD = ddSeries[ddSeries.length-1];
  const avgDD = ddCount > 0 ? ddSum/ddCount : 0;
  const setEl = (id, txt, color) => { const el = $(id); if(el){el.textContent=txt; if(color)el.style.color=color;} };
  setEl('dd-pill-max', 'Max '+maxDD.toFixed(1)+'%');
  setEl('dd-pill-cur', 'Now '+currentDD.toFixed(1)+'%');
  setEl('dd-pill-avg', 'Avg '+avgDD.toFixed(1)+'%');
  const ddColor = v => v >= DD_LIMIT_PCT ? 'var(--red)' : v >= DD_LIMIT_PCT*0.6 ? 'var(--amber)' : 'var(--green)';
  setEl('dd-stat-max', maxDD.toFixed(2)+'%', ddColor(maxDD));
  setEl('dd-stat-cur', currentDD.toFixed(2)+'%', ddColor(currentDD));
  setEl('dd-stat-avg', avgDD.toFixed(2)+'%', 'var(--amber)');
  setEl('dd-stat-limit', DD_LIMIT_PCT+'%', 'var(--text3)');
  const isDark = !document.documentElement.classList.contains('light');
  const isMedium = document.documentElement.classList.contains('medium');
  const gridColor = isDark ? (isMedium?'rgba(255,255,255,0.10)':'rgba(255,255,255,0.05)') : 'rgba(0,0,0,0.10)';
  const tickColor = isDark ? (isMedium?'#c0c8de':'rgba(255,255,255,0.3)') : 'rgba(0,0,0,0.6)';
  const annotPlugin = {
    id:'ddAnnot',
    afterDraw(chart) {
      const {ctx:c, chartArea:{left,right}, scales} = chart;
      // Initial balance line — 0% drawdown baseline
      const y0 = scales.y.getPixelForValue(0);
      if (y0 >= scales.y.top && y0 <= scales.y.bottom) {
        c.save();
        c.setLineDash([4, 5]);
        c.strokeStyle = isDark ? (isMedium?'rgba(192,200,222,0.7)':'rgba(136,144,168,0.55)') : 'rgba(30,40,80,0.5)';
        c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(left, y0); c.lineTo(right, y0); c.stroke();
        c.font = "600 9px 'JetBrains Mono', monospace";
        c.fillStyle = isDark ? (isMedium?'rgba(192,200,222,0.9)':'rgba(136,144,168,0.7)') : 'rgba(30,40,80,0.85)';
        c.textAlign = 'right';
        c.fillText('Initial  0%', right - 4, y0 - 4);
        c.setLineDash([]);
        c.restore();
      }
      const yMax = scales.y.getPixelForValue(maxDD);
      c.save();
      c.strokeStyle='rgba(232,80,74,0.7)'; c.lineWidth=1; c.setLineDash([5,4]);
      c.beginPath(); c.moveTo(left,yMax); c.lineTo(right,yMax); c.stroke();
      const yLim = scales.y.getPixelForValue(DD_LIMIT_PCT);
      c.strokeStyle='rgba(245,166,35,0.7)'; c.setLineDash([4,3]);
      c.beginPath(); c.moveTo(left,yLim); c.lineTo(right,yLim); c.stroke();
      c.restore();
    }
  };
  if (ddChartInst) { ddChartInst.destroy(); ddChartInst = null; }
  ddChartInst = new Chart(canvas.getContext('2d'), {
    type: 'line',
    plugins: [annotPlugin],
    data: {
      labels,
      datasets: [{
        label: 'Drawdown %',
        data: ddSeries,
        borderColor: '#e8504a',
        borderWidth: 2,
        pointRadius: ddSeries.map((v,i) => i===0 ? 0 : 3),
        pointBackgroundColor: ddSeries.map(v => v>=DD_LIMIT_PCT ? '#e8504a' : v>=DD_LIMIT_PCT*0.6 ? '#f5a623' : 'rgba(232,80,74,0.5)'),
        pointBorderColor: isDark ? (isMedium?'#1e2029':'#121419') : '#ffffff',
        pointBorderWidth: 1.5,
        pointHoverRadius: 6,
        fill: true,
        backgroundColor: isDark ? 'rgba(232,80,74,0.18)' : 'rgba(232,80,74,0.12)',
        tension: 0.35
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode:'index', intersect:false },
      plugins: {
        legend: { display:false },
        tooltip: {
          enabled: false,
          external(context) {
            const tt = $('dd-tooltip');
            if (!tt) return;
            if (context.tooltip.opacity === 0) { tt.style.display='none'; return; }
            const dp = context.tooltip.dataPoints[0];
            if (!dp) return;
            const idx = dp.dataIndex;
            const dd = dp.raw;
            const trade = idx > 0 ? trades[idx-1] : null;
            const bal = balSeries[idx];
            $('dd-tt-date').textContent = trade
              ? (trade.date+(trade.time?' · '+(typeof formatTradeTime==='function'?formatTradeTime(trade.time):format24to12Hour(trade.time)):'')+(trade.symbol?' · '+trade.symbol:''))
              : 'Starting balance';
            $('dd-tt-dd').textContent = '▼ '+dd.toFixed(2)+'% drawdown';
            $('dd-tt-bal').textContent = '$'+bal.toFixed(2);
            const x = context.tooltip.caretX, y = context.tooltip.caretY;
            const ttW = 200;
            let left = x+12;
            if (left+ttW > canvas.offsetWidth-10) left = x-ttW-12;
            tt.style.display='block'; tt.style.left=left+'px'; tt.style.top=Math.max(0,y-30)+'px';
          }
        }
      },
      scales: {
        x: {
          grid: { color:gridColor, lineWidth:0.5 },
          ticks: {
            color:tickColor, font:{family:"'JetBrains Mono', monospace",size:9},
            maxTicksLimit:8, maxRotation:0,
            callback(val,idx) { if(idx===0)return'Start'; const t=trades[idx-1]; return t?t.date.slice(5):''; }
          }
        },
        y: {
          reverse: true,
          position: 'right',
          min: 0,
          suggestedMax: Math.max(DD_LIMIT_PCT+1, maxDD+1),
          grid: { color:gridColor, lineWidth:0.5 },
          ticks: {
            color:tickColor, font:{family:"'JetBrains Mono', monospace",size:9},
            maxTicksLimit:6,
            callback: v => v.toFixed(1)+'%'
          }
        }
      }
    }
  });
}

// ══════════════════════════════════════════════
// ── ADVANCED ANALYTICS — 03 MONTHLY P&L ──
// ══════════════════════════════════════════════
let mpChartInst = null;
let _mpSelectedMonths = new Set(); // empty = show all

function mpClearFilter() {
  _mpSelectedMonths.clear();
  $('mp-clear-btn').style.display = 'none';
  $$('.mp-chip').forEach(c => {
    c.style.background = 'var(--bg4)';
    c.style.color = 'var(--text2)';
    c.style.borderColor = 'var(--border)';
  });
  initMonthlyPnL();
}

function initMonthlyPnL() {
  const canvas = $('mp-chart');
  if (!canvas) return;

  // Group ALL trades by YYYY-MM first (to build chips)
  const allTrades = [...getAnTrades()].sort((a,b) =>
    new Date(a.date+' '+(a.time||'00:00')) - new Date(b.date+' '+(b.time||'00:00'))
  );

  const allMonthMap = {};
  allTrades.forEach(t => {
    const key = t.date.slice(0, 7);
    if (!allMonthMap[key]) allMonthMap[key] = { win: 0, loss: 0, net: 0, count: 0 };
    if (t.pnl > 0) allMonthMap[key].win  += t.pnl;
    else            allMonthMap[key].loss += t.pnl;
    allMonthMap[key].net   += t.pnl;
    allMonthMap[key].count += 1;
  });
  const allMonthKeys = Object.keys(allMonthMap).sort();
  const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Build filter chips (only once or when account changes)
  const chipsEl = $('mp-month-chips');
  const MP_VISIBLE = 3;
  if (chipsEl && chipsEl.dataset.built !== allMonthKeys.join(',')) {
    chipsEl.dataset.built = allMonthKeys.join(',');
    chipsEl.innerHTML = '';
    let mpExpanded = false;

    function buildChip(key) {
      const [y, mo] = key.split('-');
      const lbl = MONTH_SHORT[parseInt(mo)-1] + " '" + y.slice(2);
      const chip = document.createElement('button');
      chip.className = 'mp-chip';
      chip.dataset.key = key;
      chip.textContent = lbl;
      const isActive = _mpSelectedMonths.has(key);
      chip.style.cssText = `font-size:9.5px;font-family:var(--font-mono);padding:2px 9px;border-radius:5px;cursor:pointer;border:1px solid;transition:all .15s;background:${isActive?'var(--ac-18)':'var(--bg4)'};color:${isActive?'#c0a0ff':'var(--text2)'};border-color:${isActive?'var(--ac-50)':'var(--border)'}`;
      chip.onclick = () => {
        if (_mpSelectedMonths.has(key)) {
          _mpSelectedMonths.delete(key);
          chip.style.background = 'var(--bg4)';
          chip.style.color = 'var(--text2)';
          chip.style.borderColor = 'var(--border)';
        } else {
          _mpSelectedMonths.add(key);
          chip.style.background = 'var(--ac-18)';
          chip.style.color = '#c0a0ff';
          chip.style.borderColor = 'var(--ac-50)';
        }
        const clearBtn = $('mp-clear-btn');
        if (clearBtn) clearBtn.style.display = _mpSelectedMonths.size > 0 ? '' : 'none';
        initMonthlyPnL();
      };
      return chip;
    }

    function renderChips() {
      chipsEl.innerHTML = '';
      const visibleKeys = mpExpanded ? allMonthKeys : allMonthKeys.slice(-MP_VISIBLE);
      visibleKeys.forEach(key => chipsEl.appendChild(buildChip(key)));

      if (allMonthKeys.length > MP_VISIBLE) {
        const remaining = allMonthKeys.length - MP_VISIBLE;
        const expandBtn = document.createElement('button');
        expandBtn.style.cssText = `font-size:9.5px;font-family:var(--font-mono);padding:2px 9px;border-radius:5px;cursor:pointer;border:1px solid;transition:all .15s;background:var(--bg4);color:var(--text3);border-color:var(--border);flex-shrink:0`;
        expandBtn.textContent = mpExpanded ? '↑ Less' : `+${remaining} more`;
        expandBtn.onmouseenter = () => { expandBtn.style.color='var(--text)'; expandBtn.style.borderColor='var(--border2)'; };
        expandBtn.onmouseleave = () => { expandBtn.style.color='var(--text3)'; expandBtn.style.borderColor='var(--border)'; };
        expandBtn.onclick = () => { mpExpanded = !mpExpanded; renderChips(); };
        chipsEl.appendChild(expandBtn);
      }
    }

    renderChips();
  }

  // Apply filter
  const activeKeys = _mpSelectedMonths.size > 0 ? [..._mpSelectedMonths] : allMonthKeys;
  const trades = allTrades.filter(t => activeKeys.includes(t.date.slice(0,7)));

  if (!trades.length) {
    if (mpChartInst) { mpChartInst.destroy(); mpChartInst = null; }
    ['mp-stat-net','mp-stat-win','mp-stat-loss','mp-stat-profmonths',
     'mp-pill-best','mp-pill-worst','mp-pill-months'].forEach(id => {
      const el = $(id); if (el) el.textContent = '—';
    });
    // Show no-data message on canvas
    const ctx0 = canvas.getContext('2d');
    ctx0.clearRect(0, 0, canvas.width, canvas.height);
    const isDarkMsg = !document.documentElement.classList.contains('light');
    ctx0.save();
    ctx0.fillStyle = isDarkMsg ? '#4a5068' : '#8890a8';
    ctx0.font = '11px "JetBrains Mono",monospace';
    ctx0.textAlign = 'center';
    ctx0.fillText('No data for selected month(s)', canvas.width / 2, 110);
    ctx0.restore();
    return;
  }

  const monthMap = {};
  trades.forEach(t => {
    const key = t.date.slice(0, 7); // YYYY-MM
    if (!monthMap[key]) monthMap[key] = { win: 0, loss: 0, net: 0, be: 0, count: 0 };
    if (t.pnl > 0)       monthMap[key].win  += t.pnl;
    else if (t.pnl < 0)  monthMap[key].loss += t.pnl;
    else                 monthMap[key].be   += 1;
    monthMap[key].net   += t.pnl;
    monthMap[key].count += 1;
  });

  const months     = activeKeys.filter(k => monthMap[k]);
  const winData    = months.map(m => parseFloat(monthMap[m].win.toFixed(2)));
  const lossData   = months.map(m => parseFloat(monthMap[m].loss.toFixed(2)));
  const netData    = months.map(m => parseFloat(monthMap[m].net.toFixed(2)));
  const beData     = months.map(m => monthMap[m].be);   // count of BE trades
  const hasBe      = beData.some(v => v > 0);
  const countData  = months.map(m => monthMap[m].count);
  // Show/hide BE legend entry
  const beLegend = $('mp-be-legend');
  if (beLegend) beLegend.style.display = hasBe ? 'flex' : 'none';

  // MoM trend — 3-month rolling average of net
  const trendData = netData.map((_, i) => {
    const slice = netData.slice(Math.max(0, i-2), i+1);
    return parseFloat((slice.reduce((s,v) => s+v, 0) / slice.length).toFixed(2));
  });

  // Stats
  const totalNet   = netData.reduce((s,v) => s+v, 0);
  const totalWin   = winData.reduce((s,v) => s+v, 0);
  const totalLoss  = lossData.reduce((s,v) => s+v, 0);
  const profMonths = netData.filter(v => v > 0).length;
  const bestMonth  = Math.max(...netData);
  const worstMonth = Math.min(...netData);
  const bestIdx    = netData.indexOf(bestMonth);
  const worstIdx   = netData.indexOf(worstMonth);

  const fmt = v => (v >= 0 ? '+' : '') + '$' + Math.abs(v).toFixed(2);
  const fmtFull = v => (v >= 0 ? '+' : '-') + '$' + Math.abs(v).toFixed(2);

  const setEl = (id, txt, color) => { const el = $(id); if(el){el.textContent=txt; if(color)el.style.color=color;} };
  setEl('mp-pill-best',  'Best '  + fmt(bestMonth),  'var(--green)');
  setEl('mp-pill-worst', 'Worst ' + fmt(worstMonth), 'var(--red)');
  setEl('mp-pill-months', months.length + ' month' + (months.length !== 1 ? 's' : ''));
  setEl('mp-stat-net',   fmtFull(totalNet),  totalNet >= 0 ? 'var(--green)' : 'var(--red)');
  setEl('mp-stat-win',   '+$' + totalWin.toFixed(2), 'var(--green)');
  setEl('mp-stat-loss',  '-$' + Math.abs(totalLoss).toFixed(2), 'var(--red)');
  setEl('mp-stat-profmonths', profMonths + ' / ' + months.length, 'var(--purple)');

  const isDark  = !document.documentElement.classList.contains('light');
  const isMed0  = document.documentElement.classList.contains('medium');
  const gridCol = isDark ? (isMed0?'rgba(255,255,255,0.10)':'rgba(255,255,255,0.05)') : 'rgba(0,0,0,0.10)';
  const tickCol = isDark ? (isMed0?'#c0c8de':'rgba(255,255,255,0.3)') : 'rgba(0,0,0,0.6)';

  // Format month labels nicely: "Mar 26"
  const labels = months.map(m => {
    const [y, mo] = m.split('-');
    return MONTH_SHORT[parseInt(mo)-1] + " '" + y.slice(2);
  });

  if (mpChartInst) { mpChartInst.destroy(); mpChartInst = null; }

  const mpZeroLine = {
    id: 'mpZeroLine',
    afterDraw(chart) {
      const { ctx: c, chartArea: { left, right }, scales: { y } } = chart;
      const zeroY = y.getPixelForValue(0);
      if (zeroY < y.top || zeroY > y.bottom) return;
      c.save();
      c.beginPath();
      c.moveTo(left, zeroY);
      c.lineTo(right, zeroY);
      c.strokeStyle = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)';
      c.lineWidth = 1.5;
      c.setLineDash([4, 4]);
      c.stroke();
      c.setLineDash([]);
      c.font = '8px "JetBrains Mono",monospace';
      c.fillStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)';
      c.textAlign = 'left';
      c.textBaseline = 'bottom';
      c.fillText('$0', left + 4, zeroY - 3);
      c.restore();
    }
  };

  mpChartInst = new Chart(canvas.getContext('2d'), {
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Gross Win',
          data: winData,
          backgroundColor: isDark ? 'rgba(46,204,138,0.75)' : 'rgba(46,204,138,0.8)',
          borderColor: 'rgba(46,204,138,0)',
          borderRadius: 4,
          order: 2
        },
        {
          type: 'bar',
          label: 'Gross Loss',
          data: lossData,
          backgroundColor: isDark ? 'rgba(232,80,74,0.75)' : 'rgba(232,80,74,0.8)',
          borderColor: 'rgba(232,80,74,0)',
          borderRadius: 4,
          order: 2
        },
        ...(hasBe ? [{
          type: 'bar',
          label: 'BE Trades',
          data: beData.map(v => v > 0 ? v : null),
          backgroundColor: isDark ? 'rgba(160,168,190,0.55)' : 'rgba(120,130,155,0.6)',
          borderColor: 'rgba(160,168,190,0)',
          borderRadius: 4,
          order: 2,
          yAxisID: 'y',
        }] : [])
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: true },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: false,
          external(context) {
            const tt = $('mp-tooltip');
            if (!tt) return;
            if (context.tooltip.opacity === 0) { tt.style.display = 'none'; return; }
            const dp = context.tooltip.dataPoints[0];
            if (!dp) return;
            const idx = dp.dataIndex;
            const dsIdx = dp.datasetIndex;
            const dsLabel = dp.dataset.label;
            const val = dp.raw;

            // Per-bar label and color
            let barLabel, barColor, barValStr;
            if (dsIdx === 0) {
              barLabel = 'Gross Win';
              barColor = 'var(--green)';
              barValStr = '+$' + val.toFixed(2);
            } else if (dsIdx === 1) {
              barLabel = 'Gross Loss';
              barColor = 'var(--red)';
              barValStr = '-$' + Math.abs(val).toFixed(2);
            } else {
              barLabel = 'Net P&L';
              barColor = val >= 0 ? 'var(--blue)' : 'var(--red)';
              barValStr = (val >= 0 ? '+' : '') + '$' + val.toFixed(2);
            }

            const net = netData[idx];
            tt.innerHTML = `
              <div style="color:var(--text3);margin-bottom:6px;font-size:9px;letter-spacing:.08em;text-transform:uppercase">${labels[idx]}</div>
              <div style="color:${barColor};font-weight:700;font-size:13px;margin-bottom:6px">${barValStr}</div>
              <div style="border-top:1px solid var(--border);padding-top:6px;display:flex;flex-direction:column;gap:3px">
                <div style="display:flex;justify-content:space-between;gap:14px"><span style="color:var(--text3)">Win</span><span style="color:var(--green)">+$${winData[idx].toFixed(2)}</span></div>
                <div style="display:flex;justify-content:space-between;gap:14px"><span style="color:var(--text3)">Loss</span><span style="color:var(--red)">-$${Math.abs(lossData[idx]).toFixed(2)}</span></div>
                <div style="display:flex;justify-content:space-between;gap:14px"><span style="color:var(--text3)">Net</span><span style="color:${net>=0?'var(--green)':'var(--red)'};font-weight:600">${(net>=0?'+':'') + '$'+net.toFixed(2)}</span></div>
                <div style="display:flex;justify-content:space-between;gap:14px"><span style="color:var(--text3)">Trades</span><span style="color:var(--text)">${countData[idx]}</span></div>
              </div>`;
            const rect = canvas.getBoundingClientRect();
            const wrapRect = tt.parentElement.getBoundingClientRect();
            const mx = (context.chart._lastEvent?.native?.clientX ?? context.tooltip.caretX + rect.left);
            const my = (context.chart._lastEvent?.native?.clientY ?? context.tooltip.caretY + rect.top);
            const relX = mx - wrapRect.left;
            const relY = my - wrapRect.top;
            tt.style.display = 'block';
            const ttW = tt.offsetWidth || 185;
            const ttH = tt.offsetHeight || 120;
            let left = relX + 14;
            let top  = relY - ttH / 2;
            if (left + ttW > wrapRect.width - 10) left = relX - ttW - 14;
            if (top < 4) top = 4;
            if (top + ttH > wrapRect.height - 4) top = wrapRect.height - ttH - 4;
            tt.style.left = left + 'px';
            tt.style.top  = top + 'px';
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridCol, lineWidth: 0.5 },
          ticks: { color: tickCol, font: { family: "'JetBrains Mono', monospace", size: 9 }, maxRotation: 0 }
        },
        y: {
          position: 'right',
          grid: { color: gridCol, lineWidth: 0.5 },
          ticks: {
            color: tickCol,
            font: { family: "'JetBrains Mono', monospace", size: 9 },
            maxTicksLimit: 6,
            callback: v => (v >= 0 ? '+' : '') + '$' + (Math.abs(v) >= 1000 ? (v/1000).toFixed(1)+'k' : v.toFixed(0))
          }
        }
      }
    },
    plugins: [mpZeroLine]
  });

  // Click a bar → jump to Trade Log filtered to that month + account
  canvas.addEventListener('click', function(e) {
    if (!mpChartInst) return;
    const pts = mpChartInst.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
    if (!pts.length) return;
    const monthKey = activeKeys[pts[0].index]; // e.g. "2026-03"
    if (!monthKey) return;
    // Sync account
    if (typeof anCurrentAccount !== 'undefined' && anCurrentAccount && anCurrentAccount !== '__all__') {
      const mi = ACCOUNTS.findIndex(a => (a.key || a.phase) === anCurrentAccount);
      if (mi !== -1 && typeof selectAcct === 'function') selectAcct(mi);
    }
    // Filter to this month's trades for this account
    const ids = (typeof getAnTrades === 'function' ? getAnTrades() : TRADES)
      .filter(t => t.date.slice(0, 7) === monthKey)
      .map(t => String(t.id));
    if (!ids.length) return;
    window._streakIdFilter = ids;
    window._symbolQuickFilter = null;
    window._sessionQuickFilter = null;
    _detailOriginView = 'advanalytics';
    const nav = document.querySelector('.nav-item[data-view="tradelog"]');
    if (nav) nav.click();
    setTimeout(() => { if (typeof applyFilters === 'function') applyFilters(); }, 60);
  });
}

// ══════════════════════════════════════════════
// ── ADVANCED ANALYTICS — 04 R-MULTIPLE ──
// ══════════════════════════════════════════════
let rmChartInst = null;

// ── R-Multiple symbol filter ──
const _rmSymFilters = {}; // per-account: { [acctName]: Set }
function getRmSymFilter() {
  const k = anCurrentAccount || '__all__';
  if (!_rmSymFilters[k]) _rmSymFilters[k] = new Set();
  return _rmSymFilters[k];
}
let rmSymFilter = getRmSymFilter(); // legacy alias — reassigned on account switch

function toggleRmSymFilter() {
  const dd = $('rm-sym-dd');
  const btn = $('rm-sym-btn');
  const isOpen = dd.style.display === 'block';
  if (isOpen) { dd.style.display = 'none'; return; }

  // Build symbol list from trades
  const syms = [...new Set(TRADES.filter(t => t.sl).map(t => t.symbol))].sort();
  const list = $('rm-sym-list');
  list.innerHTML = '';

  // All option
  const allEl = document.createElement('div');
  allEl.style.cssText = 'padding:5px 10px;border-radius:5px;cursor:pointer;font-size:11px;font-family:JetBrains Mono,monospace;color:var(--text2);display:flex;align-items:center;gap:8px;transition:background .12s';
  allEl.onmouseenter = () => allEl.style.background = 'var(--bg3)';
  allEl.onmouseleave = () => allEl.style.background = 'transparent';
  const allActive = rmSymFilter.size === 0;
  allEl.innerHTML = `<span style="width:12px;height:12px;border-radius:3px;border:1px solid var(--border2);background:${allActive?'var(--purple)':'transparent'};display:inline-block;flex-shrink:0"></span>All Pairs`;
  allEl.onclick = () => { rmSymFilter.clear(); updateRmSymLabel(); dd.style.display='none'; initRMultiple(); };
  list.appendChild(allEl);

  syms.forEach(sym => {
    const el = document.createElement('div');
    el.style.cssText = 'padding:5px 10px;border-radius:5px;cursor:pointer;font-size:11px;font-family:JetBrains Mono,monospace;color:var(--text2);display:flex;align-items:center;gap:8px;transition:background .12s';
    el.onmouseenter = () => el.style.background = 'var(--bg3)';
    el.onmouseleave = () => el.style.background = 'transparent';
    const active = rmSymFilter.has(sym);
    el.innerHTML = `<span style="width:12px;height:12px;border-radius:3px;border:1px solid var(--border2);background:${active?'var(--purple)':'transparent'};display:inline-block;flex-shrink:0" id="rm-sym-check-${sym.replace('/','_')}"></span>${sym}`;
    el.onclick = () => {
      if (rmSymFilter.has(sym)) rmSymFilter.delete(sym); else rmSymFilter.add(sym);
      const chk = $('rm-sym-check-'+sym.replace('/','_'));
      if (chk) chk.style.background = rmSymFilter.has(sym) ? 'var(--purple)' : 'transparent';
      updateRmSymLabel();
      initRMultiple();
    };
    list.appendChild(el);
  });

  dd.style.display = 'block';
  setTimeout(() => document.addEventListener('click', closeRmSymOutside), 10);
}

function closeRmSymOutside(e) {
  const wrap = $('rm-sym-wrap');
  if (wrap && !wrap.contains(e.target)) {
    $('rm-sym-dd').style.display = 'none';
    document.removeEventListener('click', closeRmSymOutside);
  }
}

function updateRmSymLabel() {
  const lbl = $('rm-sym-label');
  if (!lbl) return;
  lbl.textContent = rmSymFilter.size === 0 ? 'All Pairs' : rmSymFilter.size === 1 ? [...rmSymFilter][0] : rmSymFilter.size + ' Pairs';
}

function initRMultiple() {
  const canvas = $('rm-chart');
  if (!canvas) return;

  // Always use the current account's symbol filter
  rmSymFilter = getRmSymFilter();

  // R = pnl / dollarRisk
  // dollarRisk = (|entry-sl| / |entry-exit|) * |pnl|
  // This keeps R in consistent dollar-relative units regardless of instrument
  let noSL = 0;
  const rValues = [];

  const anTrades = getAnTrades();
  anTrades.forEach(t => {
    // Apply symbol filter
    if (rmSymFilter.size > 0 && !rmSymFilter.has(t.symbol)) return;
    const sl    = parseFloat(t.sl)    || 0;
    const entry = parseFloat(t.entry) || 0;
    const exit  = parseFloat(t.exit)  || 0;
    if (!sl || !entry || !exit) { noSL++; return; }
    const slDist   = Math.abs(entry - sl);
    const exitDist = Math.abs(entry - exit);
    if (slDist < 0.000001 || exitDist < 0.000001) { noSL++; return; }
    const dollarRisk = (slDist / exitDist) * Math.abs(t.pnl);
    if (dollarRisk < 0.01) { noSL++; return; }
    const r = parseFloat((t.pnl / dollarRisk).toFixed(2));
    rValues.push({ r, trade: t });
  });

  const setEl = (id, txt, color) => { const el = $(id); if(el){el.textContent=txt; if(color)el.style.color=color;} };

  if (!rValues.length) {
    if (rmChartInst) { rmChartInst.destroy(); rmChartInst = null; }
    ['rm-stat-avg','rm-stat-exp','rm-stat-best','rm-stat-worst','rm-stat-nosl',
     'rm-pill-avg','rm-pill-exp','rm-pill-trades'].forEach(id => { setEl(id,'—'); });
    return;
  }

  const rs     = rValues.map(v => v.r);
  const avgR   = rs.reduce((s,v) => s+v, 0) / rs.length;
  const bestR  = Math.max(...rs);
  const worstR = Math.min(...rs);
  const wins   = rs.filter(v => v > 0);
  const losses = rs.filter(v => v <= 0);
  const winRate   = wins.length / rs.length;
  const avgWin    = wins.length   ? wins.reduce((s,v)=>s+v,0)/wins.length     : 0;
  const avgLoss   = losses.length ? Math.abs(losses.reduce((s,v)=>s+v,0)/losses.length) : 0;
  // Expectancy = (winRate × avgWin) - (lossRate × avgLoss)
  const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);

  setEl('rm-pill-avg',    'Avg ' + avgR.toFixed(2) + 'R',         avgR >= 0 ? 'var(--green)' : 'var(--red)');
  setEl('rm-pill-exp',    'Exp ' + expectancy.toFixed(2) + 'R',   expectancy >= 0 ? 'var(--green)' : 'var(--red)');
  setEl('rm-pill-trades', rs.length + ' trades');
  setEl('rm-stat-avg',    avgR.toFixed(2) + 'R',    avgR >= 0 ? 'var(--green)' : 'var(--red)');
  setEl('rm-stat-exp',    expectancy.toFixed(2) + 'R', expectancy >= 0 ? 'var(--green)' : 'var(--red)');
  setEl('rm-stat-best',   '+' + bestR.toFixed(2) + 'R',  'var(--green)');
  setEl('rm-stat-worst',  worstR.toFixed(2) + 'R',       'var(--red)');
  setEl('rm-stat-nosl',   noSL + ' trade' + (noSL!==1?'s':''));

  // Build histogram in 0.5R buckets, clamped to ±6R max range
  const bucketSize = 0.5;
  const CLAMP = 6;
  const clampedRs  = rs.map(v => Math.max(-CLAMP, Math.min(CLAMP, v)));
  const minBucket  = Math.floor(Math.min(...clampedRs) / bucketSize);
  const maxBucket  = Math.ceil (Math.max(...clampedRs) / bucketSize);
  const numBuckets = maxBucket - minBucket;
  if (numBuckets <= 0 || numBuckets > 30) return; // hard safety guard
  const buckets = Array.from({ length: numBuckets }, (_, i) => ({
    lo: parseFloat(((minBucket + i)     * bucketSize).toFixed(2)),
    hi: parseFloat(((minBucket + i + 1) * bucketSize).toFixed(2)),
    count: 0, trades: []
  }));
  rValues.forEach(({ r, trade }) => {
    const cr  = Math.max(-CLAMP, Math.min(CLAMP, r));
    const idx = buckets.findIndex(b => cr >= b.lo && cr < b.hi);
    if (idx !== -1) { buckets[idx].count++; buckets[idx].trades.push(trade); }
  });

  const labels   = buckets.map(b => (b.lo >= 0 ? '+' : '') + b.lo.toFixed(1) + 'R');
  const counts   = buckets.map(b => b.count);
  const isDark   = !document.documentElement.classList.contains('light');
  const isMed1   = document.documentElement.classList.contains('medium');
  const gridCol  = isDark ? (isMed1?'rgba(255,255,255,0.10)':'rgba(255,255,255,0.05)') : 'rgba(0,0,0,0.10)';
  const tickCol  = isDark ? (isMed1?'#c0c8de':'rgba(255,255,255,0.3)') : 'rgba(0,0,0,0.6)';

  const colors = buckets.map(b =>
    b.lo >= 0
      ? (isDark ? 'rgba(46,204,138,0.75)' : 'rgba(46,204,138,0.85)')
      : (isDark ? 'rgba(232,80,74,0.75)'  : 'rgba(232,80,74,0.85)')
  );

  if (rmChartInst) { rmChartInst.destroy(); rmChartInst = null; }

  // ── Horizontal bar plot rendered directly on canvas ──
  const canvasEl = canvas;
  const dpr = window.devicePixelRatio || 1;
  const W = canvasEl.parentElement.offsetWidth - 48;
  const ROW_H = 28;
  const PAD_L = 80, PAD_R = 60, PAD_T = 16, PAD_B = 24;
  const H = PAD_T + rs.length * ROW_H + PAD_B;
  canvasEl.style.width  = W + 'px';
  canvasEl.width  = W * dpr;
  const c = canvasEl.getContext('2d');

  const plotW = W - PAD_L - PAD_R;

  // Sort trades by R value descending, keep best 5 (positive only) and worst 5 (negative only)
  const allSorted = [...rValues].sort((a, b) => b.r - a.r);
  const best5  = allSorted.filter(v => v.r > 0).slice(0, 5);
  const worst5Sorted = allSorted.filter(v => v.r <= 0).slice(-5).sort((a, b) => a.r - b.r);
  const sorted = [...best5, ...worst5Sorted];
  const allR = sorted.map(v => v.r);
  const maxAbs = Math.max(...allR.map(Math.abs), 1);
  const rToW = r => (Math.abs(r) / maxAbs) * (plotW / 2);
  const midX = PAD_L + plotW / 2;

  // Resize canvas to fit only the rendered rows (not all trades)
  const H2 = PAD_T + sorted.length * ROW_H + PAD_B;
  canvasEl.style.height = H2 + 'px';
  canvasEl.height = H2 * dpr;
  c.scale(dpr, dpr);

  c.clearRect(0, 0, W, H2);

  // Center zero line
  c.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  c.lineWidth = 1;
  c.beginPath(); c.moveTo(midX, PAD_T - 8); c.lineTo(midX, PAD_T + sorted.length * ROW_H + 4); c.stroke();

  // Header labels
  c.font = "9px 'JetBrains Mono', monospace";
  c.fillStyle = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)';
  c.textAlign = 'center';
  c.fillText('0R', midX, PAD_T - 2);

  // Best 5 / Worst 5 section labels
  c.font = "8px 'JetBrains Mono', monospace";
  c.fillStyle = 'rgba(46,204,138,0.5)';
  c.textAlign = 'left';
  c.fillText('TOP 5', PAD_L - 58, PAD_T + 8);

  sorted.forEach((rv, i) => {
    const { r, trade } = rv;
    const isWin = r > 0;
    const y = PAD_T + i * ROW_H;

    // Separator between best 5 and worst 5
    if (i === best5.length) {
      const sepY = y - 5;
      c.strokeStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
      c.lineWidth = 1;
      c.setLineDash([4, 4]);
      c.beginPath(); c.moveTo(PAD_L - 60, sepY); c.lineTo(W - PAD_R + 60, sepY); c.stroke();
      c.setLineDash([]);
      c.font = "8px 'JetBrains Mono', monospace";
      c.fillStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
      c.textAlign = 'center';
      c.fillText('· · · WORST 5 · · ·', W / 2, sepY - 3);
    }
    const barW = rToW(r);
    const barX = r >= 0 ? midX : midX - barW;
    const barH = ROW_H - 6;

    // Subtle row bg
    if (i % 2 === 0) {
      c.fillStyle = isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.02)';
      c.fillRect(0, y, W, ROW_H);
    }

    // Bar
    const grad = c.createLinearGradient(barX, 0, barX + barW, 0);
    if (isWin) {
      grad.addColorStop(0, 'rgba(46,204,138,0.3)');
      grad.addColorStop(1, 'rgba(46,204,138,0.85)');
    } else {
      grad.addColorStop(0, 'rgba(232,80,74,0.85)');
      grad.addColorStop(1, 'rgba(232,80,74,0.3)');
    }
    c.fillStyle = grad;
    // Rounded bar
    const bx = barX, by = y + 3, bw = Math.max(barW, 2), bh = barH;
    const rad = 4;
    c.beginPath();
    if (isWin) {
      c.moveTo(bx, by + rad); c.arcTo(bx, by, bx + rad, by, rad);
      c.lineTo(bx + bw - rad, by); c.arcTo(bx + bw, by, bx + bw, by + rad, rad);
      c.lineTo(bx + bw, by + bh - rad); c.arcTo(bx + bw, by + bh, bx + bw - rad, by + bh, rad);
      c.lineTo(bx + rad, by + bh); c.arcTo(bx, by + bh, bx, by + bh - rad, rad);
    } else {
      c.moveTo(bx + rad, by); c.arcTo(bx + bw, by, bx + bw, by + rad, rad);
      c.lineTo(bx + bw, by + bh - rad); c.arcTo(bx + bw, by + bh, bx + bw - rad, by + bh, rad);
      c.lineTo(bx + rad, by + bh); c.arcTo(bx, by + bh, bx, by + bh - rad, rad);
      c.lineTo(bx, by + rad); c.arcTo(bx, by, bx + rad, by, rad);
    }
    c.closePath(); c.fill();

    // Trade label (symbol) on left
    c.textAlign = 'right';
    c.font = "10px 'JetBrains Mono', monospace";
    c.fillStyle = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
    c.fillText((trade?.symbol || '—').slice(0, 7), PAD_L - 8, y + ROW_H / 2 + 3.5);

    // R value on right of bar
    c.textAlign = 'left';
    c.font = "bold 10px 'JetBrains Mono', monospace";
    c.fillStyle = isWin ? 'rgba(46,204,138,0.9)' : 'rgba(232,80,74,0.9)';
    const rLabel = (r >= 0 ? '+' : '') + r.toFixed(2) + 'R';
    const rLabelX = isWin ? midX + barW + 6 : midX - barW - 6;
    c.textAlign = isWin ? 'left' : 'right';
    c.fillText(rLabel, rLabelX, y + ROW_H / 2 + 3.5);
  });

  // Hover tooltip — only when over the actual bar
  const tt = $('rm-tooltip');
  canvasEl.onmousemove = (e) => {
    const rect = canvasEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const idx = Math.floor((my - PAD_T) / ROW_H);
    if (idx >= 0 && idx < sorted.length) {
      const { r, trade } = sorted[idx];
      const barW = rToW(r);
      const barX = r >= 0 ? midX : midX - barW;
      const barEndX = r >= 0 ? midX + barW : midX;
      const barY = PAD_T + idx * ROW_H + 3;
      const barH = ROW_H - 6;
      // Only show if mouse is within bar bounds
      if (mx >= barX && mx <= barEndX && my >= barY && my <= barY + barH) {
        tt.style.display = 'block';
        $('rm-tt-range').textContent = (trade?.symbol || '') + (trade?.date ? ' · ' + trade.date : '');
        $('rm-tt-count').textContent = (r >= 0 ? '+' : '') + r.toFixed(2) + 'R';
        $('rm-tt-pct').textContent = trade?.pnl != null ? (trade.pnl >= 0 ? '+' : '') + '$' + trade.pnl.toFixed(2) : '';
        let left = mx + 12;
        if (left + 190 > W - 10) left = mx - 202;
        tt.style.left = left + 'px';
        tt.style.top = Math.max(0, my - 30) + 'px';
        canvasEl.style.cursor = 'pointer';
        return;
      }
    }
    tt.style.display = 'none';
    canvasEl.style.cursor = 'default';
  };
  canvasEl.onmouseleave = () => { if (tt) tt.style.display = 'none'; canvasEl.style.cursor = 'default'; };

  canvasEl.onclick = (e) => {
    const rect = canvasEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const idx = Math.floor((my - PAD_T) / ROW_H);
    if (idx < 0 || idx >= sorted.length) return;
    const { r, trade } = sorted[idx];
    const barW = rToW(r);
    const barX = r >= 0 ? midX : midX - barW;
    const barEndX = r >= 0 ? midX + barW : midX;
    const barY = PAD_T + idx * ROW_H + 3;
    const barH = ROW_H - 6;
    if (mx < barX || mx > barEndX || my < barY || my > barY + barH) return;
    if (!trade) return;
    _detailOriginView = document.querySelector('.nav-item.active')?.dataset?.view || null;
    document.querySelector('[data-view="tradelog"]').click();
    setTimeout(() => {
      const row = document.querySelector(`.trade-table tbody tr[data-id="${trade.id}"]`);
      showDetail(trade, row || document.createElement('tr'));
      if (row) { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); row.classList.add('selected-row'); }
    }, 80);
  };
}

// ══════════════════════════════════════════════
// ── ADVANCED ANALYTICS — 05 SYMBOL BREAKDOWN ──
// ══════════════════════════════════════════════
let sbChartInst = null;

function initSymbolBreakdown() {
  const canvas = $('sb-chart');
  const tbody  = $('sb-tbody');
  if (!canvas || !tbody) return;

  const anTrades = getAnTrades();
  if (!anTrades.length) {
    if (sbChartInst) { sbChartInst.destroy(); sbChartInst = null; }
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3);font-size:11px">No trades yet</td></tr>';
    return;
  }

  // Aggregate by symbol
  const map = {};
  anTrades.forEach(t => {
    const sym = (t.symbol || 'Unknown').toUpperCase();
    if (!map[sym]) map[sym] = { trades: 0, wins: 0, net: 0, best: -Infinity, pnls: [] };
    map[sym].trades++;
    map[sym].net += t.pnl;
    map[sym].pnls.push(t.pnl);
    if (t.pnl > 0) map[sym].wins++;
    if (t.pnl > map[sym].best) map[sym].best = t.pnl;
  });

  // Sort by net P&L descending
  const symbols = Object.keys(map).sort((a, b) => map[b].net - map[a].net);
  const nets    = symbols.map(s => parseFloat(map[s].net.toFixed(2)));
  const bestSym  = symbols[0];
  const worstSym = symbols[symbols.length - 1];

  // Pills
  const setEl = (id, txt, color) => { const el = $(id); if(el){el.textContent=txt; if(color)el.style.color=color;} };
  setEl('sb-pill-symbols', symbols.length + ' symbol' + (symbols.length !== 1 ? 's' : ''));
  setEl('sb-pill-best',  'Best ' + bestSym,  'var(--green)');
  setEl('sb-pill-worst', 'Worst ' + worstSym, 'var(--red)');

  const isDark  = !document.documentElement.classList.contains('light');
  const isMed2  = document.documentElement.classList.contains('medium');
  const gridCol = isDark ? (isMed2?'rgba(255,255,255,0.10)':'rgba(255,255,255,0.05)') : 'rgba(0,0,0,0.10)';
  const tickCol = isDark ? (isMed2?'#c0c8de':'rgba(255,255,255,0.3)') : 'rgba(0,0,0,0.6)';

  // Palette — cycle through accent colors
  const palette = ['#6b1fd4','#2ecc8a','#4d8ef0','#f5a623','#e8504a','#a97de8','#50d8c8','#f07850'];
  const barColors = symbols.map((_, i) =>
    nets[i] >= 0
      ? (isDark ? 'rgba(46,204,138,0.75)' : 'rgba(46,204,138,0.85)')
      : (isDark ? 'rgba(232,80,74,0.75)'  : 'rgba(232,80,74,0.85)')
  );

  if (sbChartInst) { sbChartInst.destroy(); sbChartInst = null; }

  sbChartInst = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: symbols,
      datasets: [{
        label: 'Net P&L',
        data: nets,
        backgroundColor: barColors,
        borderRadius: 5,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: true,
      onHover(e, elements) {
        e.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
      },
      onClick(e, elements) {
        if (elements.length > 0) {
          const idx = elements[0].index;
          filterTradesBySymbol(symbols[idx]);
        }
      },
      interaction: { mode: 'nearest', intersect: true },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: false,
          external(context) {
            const tt = $('sb-tooltip');
            if (!tt) return;
            if (context.tooltip.opacity === 0) { tt.style.display='none'; return; }
            const idx = context.tooltip.dataPoints[0]?.dataIndex;
            if (idx === undefined) return;
            const sym  = symbols[idx];
            const d    = map[sym];
            const net  = nets[idx];
            const wr   = ((d.wins / d.trades) * 100).toFixed(0);
            const avg  = (d.net / d.trades).toFixed(2);
            $('sb-tt-sym').textContent = sym;
            $('sb-tt-sym').style.color = net >= 0 ? 'var(--green)' : 'var(--red)';
            $('sb-tt-net').textContent  = (net >= 0 ? '+' : '') + '$' + net.toFixed(2);
            $('sb-tt-net').style.color  = net >= 0 ? 'var(--green)' : 'var(--red)';
            $('sb-tt-wr').textContent   = wr + '%';
            $('sb-tt-ct').textContent   = d.trades + ' trade' + (d.trades !== 1 ? 's' : '');
            const rect = canvas.getBoundingClientRect();
            const wrapRect = tt.parentElement.getBoundingClientRect();
            const mx = context.chart._lastEvent?.native?.clientX ?? (context.tooltip.caretX + rect.left);
            const my = context.chart._lastEvent?.native?.clientY ?? (context.tooltip.caretY + rect.top);
            const relX = mx - wrapRect.left;
            const relY = my - wrapRect.top;
            tt.style.display = 'block';
            const ttW = tt.offsetWidth || 180;
            const ttH = tt.offsetHeight || 100;
            let left = relX + 14;
            let top  = relY - ttH / 2;
            if (left + ttW > wrapRect.width - 10) left = relX - ttW - 14;
            if (top < 4) top = 4;
            if (top + ttH > wrapRect.height - 4) top = wrapRect.height - ttH - 4;
            tt.style.left = left + 'px';
            tt.style.top  = top  + 'px';
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridCol, lineWidth: 0.5 },
          ticks: {
            color: tickCol, font: { family: "'JetBrains Mono', monospace", size: 9 },
            callback: v => (v >= 0 ? '+' : '') + '$' + (Math.abs(v) >= 1000 ? (v/1000).toFixed(1)+'k' : v.toFixed(0))
          }
        },
        y: {
          grid: { display: false },
          ticks: { color: tickCol, font: { family: "'JetBrains Mono', monospace", size: 10 } }
        }
      }
    }
  });

  // Render stats table
  const fmtD = v => (v >= 0 ? '+' : '') + '$' + Math.abs(v).toFixed(2);
  tbody.innerHTML = symbols.map((sym, i) => {
    const d   = map[sym];
    const net = nets[i];
    const wr  = ((d.wins / d.trades) * 100).toFixed(0);
    const avg = d.net / d.trades;
    const wrColor  = parseInt(wr) >= 50 ? 'var(--green)' : 'var(--red)';
    const netColor = net >= 0 ? 'var(--green)' : 'var(--red)';
    const dot = net >= 0
      ? `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--green);margin-right:6px;flex-shrink:0"></span>`
      : `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--red);margin-right:6px;flex-shrink:0"></span>`;
    return `<tr style="border-bottom:1px solid var(--border);transition:background .12s;cursor:pointer" onclick="filterTradesBySymbol('${sym}')" title="View ${sym} trades in Trade Log" onmouseenter="this.style.background='var(--bg4)'" onmouseleave="this.style.background=''">
      <td style="padding:7px 10px 7px 0;color:var(--text);font-weight:600;display:flex;align-items:center">${dot}${sym}</td>
      <td style="padding:7px 10px;text-align:right;color:var(--text2)">${d.trades}</td>
      <td style="padding:7px 10px;text-align:right;color:${wrColor};font-weight:600">${wr}%</td>
      <td style="padding:7px 10px;text-align:right;color:${netColor};font-weight:600">${fmtD(net)}</td>
      <td style="padding:7px 10px;text-align:right;color:${avg>=0?'var(--green)':'var(--red)'}">${fmtD(avg)}</td>
      <td style="padding:7px 0 7px 10px;text-align:right;color:var(--green)">+$${d.best.toFixed(2)}</td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════════
// ── ADVANCED ANALYTICS — 06 WIN/LOSS STREAKS ──
// ══════════════════════════════════════════════
function initStreaks() {
  const timeline = $('st-timeline');
  const streakList = $('st-streaks');
  if (!timeline || !streakList) return;

  const setEl = (id, txt, color) => { const el = $(id); if(el){el.textContent=txt; if(color)el.style.color=color;} };

  const anTrades = getAnTrades();
  if (!anTrades.length) {
    timeline.innerHTML = '<span style="color:var(--text3);font-size:11px;font-family:\'JetBrains Mono\',monospace">No trades yet</span>';
    streakList.innerHTML = '';
    ['st-stat-bestw','st-stat-bestl','st-stat-cur','st-stat-avg','st-pill-win','st-pill-loss','st-pill-cur'].forEach(id => setEl(id,'—'));
    return;
  }

  // Sort trades chronologically
  const trades = [...anTrades].sort((a,b) =>
    new Date(a.date+' '+(a.time||'00:00')) - new Date(b.date+' '+(b.time||'00:00'))
  );

  // Build streak segments
  const streaks = [];
  let cur = { type: trades[0].pnl >= 0 ? 'W' : 'L', trades: [trades[0]] };
  for (let i = 1; i < trades.length; i++) {
    const t    = trades[i];
    const type = t.pnl >= 0 ? 'W' : 'L';
    if (type === cur.type) {
      cur.trades.push(t);
    } else {
      streaks.push(cur);
      cur = { type, trades: [t] };
    }
  }
  streaks.push(cur);

  const winStreaks  = streaks.filter(s => s.type === 'W').map(s => s.trades.length);
  const lossStreaks = streaks.filter(s => s.type === 'L').map(s => s.trades.length);
  const bestWin     = winStreaks.length  ? Math.max(...winStreaks)  : 0;
  const worstLoss   = lossStreaks.length ? Math.max(...lossStreaks) : 0;
  const curStreak   = streaks[streaks.length - 1];
  const allLengths  = streaks.map(s => s.trades.length);
  const avgLen      = (allLengths.reduce((s,v) => s+v, 0) / allLengths.length).toFixed(1);

  // Stats
  setEl('st-stat-bestw', bestWin + ' trade' + (bestWin !== 1 ? 's' : ''),  'var(--green)');
  setEl('st-stat-bestl', worstLoss + ' trade' + (worstLoss !== 1 ? 's' : ''), 'var(--red)');
  const curLabel = curStreak.trades.length + (curStreak.type === 'W' ? ' W' : ' L');
  setEl('st-stat-cur', curLabel, curStreak.type === 'W' ? 'var(--green)' : 'var(--red)');
  setEl('st-stat-avg', avgLen);
  setEl('st-pill-win',  'Best W ' + bestWin,   'var(--green)');
  setEl('st-pill-loss', 'Worst L ' + worstLoss, 'var(--red)');
  setEl('st-pill-cur',  'Now ' + curLabel, curStreak.type === 'W' ? 'var(--green)' : 'var(--red)');

  // --- Timeline bars ---
  const allPnls   = trades.map(t => Math.abs(t.pnl));
  const maxPnl    = Math.max(...allPnls) || 1;
  const MIN_H = 14, MAX_H = 56;

  timeline.innerHTML = trades.map((t, i) => {
    const isWin  = t.pnl >= 0;
    const h      = Math.round(MIN_H + ((Math.abs(t.pnl) / maxPnl) * (MAX_H - MIN_H)));
    const color  = isWin ? 'var(--green)' : 'var(--red)';
    const bgAlpha = isWin ? '0.75' : '0.75';
    const pnlStr = (t.pnl >= 0 ? '+' : '') + '$' + t.pnl.toFixed(2);
    const tip    = `${t.date}${t.time?' '+(typeof formatTradeTime==='function'?formatTradeTime(t.time):format24to12Hour(t.time)):''} · ${t.symbol||''} · ${pnlStr}`;
    return `<div title="${tip}" data-trade-id="${t.id}" style="width:10px;height:${h}px;border-radius:2px;background:${color};opacity:${bgAlpha};cursor:pointer;flex-shrink:0;transition:opacity .15s,transform .1s" onmouseenter="this.style.opacity='1';this.style.transform='scaleY(1.1)';showStTip(event,'${tip}')" onmouseleave="this.style.opacity='${bgAlpha}';this.style.transform='';hideStTip()" onclick="(function(id){_detailOriginView='advanalytics';document.querySelector('[data-view=\\'tradelog\\']').click();setTimeout(()=>{const row=document.querySelector('.trade-table tbody tr[data-id=\\''+id+'\\']');const trade=TRADES.find(t=>String(t.id)===String(id));if(trade)showDetail(trade,row||document.createElement('tr'));if(row){row.scrollIntoView({behavior:'smooth',block:'center'});row.classList.add('selected-row');}},80);}('${t.id}'))"></div>`;
  }).join('');

  // --- Streak badges ---
  streakList.innerHTML = streaks.map((s, i) => {
    const isW    = s.type === 'W';
    const net    = s.trades.reduce((sum, t) => sum + t.pnl, 0);
    const netStr = (net >= 0 ? '+' : '') + '$' + net.toFixed(2);
    const bg     = isW ? 'var(--green2)' : 'var(--red2)';
    const color  = isW ? 'var(--green)'  : 'var(--red)';
    const border = isW ? 'rgba(46,204,138,.25)' : 'rgba(232,80,74,.25)';
    const icon   = isW ? '▲' : '▼';
    const isCur  = i === streaks.length - 1;
    const ids    = s.trades.map(t => t.id).join(',');
    return `<div title="View these ${s.trades.length} trades in Trade Log" style="display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:6px;background:${bg};border:1px solid ${border};cursor:pointer;transition:opacity .15s" onmouseenter="this.style.opacity='.8'" onmouseleave="this.style.opacity='1'" onclick="(function(ids){const idArr=ids.split(',');window._streakIdFilter=idArr;window._symbolQuickFilter=null;_detailOriginView='advanalytics';document.querySelector('[data-view=\\'tradelog\\']').click();setTimeout(()=>{applyFilters();const firstId=idArr[0];const row=document.querySelector('.trade-table tbody tr[data-id=\\''+firstId+'\\']');const trade=TRADES.find(t=>String(t.id)===String(firstId));if(trade)showDetail(trade,row||document.createElement('tr'));if(row){row.scrollIntoView({behavior:'smooth',block:'center'});row.classList.add('selected-row');}},80);}('${ids}'))">
      <span style="color:${color};font-size:10px">${icon}</span>
      <span style="font-family:var(--font-mono);font-size:11px;font-weight:700;color:${color}">${s.trades.length}${s.type}</span>
      <span style="font-family:var(--font-mono);font-size:10px;color:var(--text3)">${netStr}</span>
      <span style="font-family:var(--font-mono);font-size:9px;color:var(--text3);margin-left:2px">↗</span>
    </div>`;
  }).join('');
}

// Streak timeline tooltip helpers
(function() {
  let stTipEl = null;
  window.showStTip = function(e, text) {
    if (!stTipEl) {
      stTipEl = document.createElement('div');
      stTipEl.style.cssText = 'position:fixed;pointer-events:none;background:var(--bg2);border:1px solid var(--ac-30);border-radius:8px;padding:6px 10px;font-family:\'JetBrains Mono\',monospace;font-size:10px;color:var(--text);z-index:9999;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.4)';
      document.body.appendChild(stTipEl);
    }
    stTipEl.textContent = text;
    stTipEl.style.display = 'block';
    stTipEl.style.left = (e.clientX + 12) + 'px';
    stTipEl.style.top  = (e.clientY - 30) + 'px';
  };
  window.hideStTip = function() {
    if (stTipEl) stTipEl.style.display = 'none';
  };
})();
