// ═══ Settings Module ═══

// ══ ADD ACCOUNT MODAL ══
let aaSelectedStage   = 'eval';
let aaSelectedDDType  = 'trailing';
let aaPhaseChecked    = false;
let aaSelectedPhaseNum = null;

function updateAaFirmLogo(firmName) {
  const wrap = $('aa-firm-logo');
  if (!wrap) return;
  if (!firmName || firmName.length < 2) {
    wrap.innerHTML = '<span style="font-size:16px;color:var(--text3)"><svg width=12 height=12 viewBox="0 0 16 16" fill=none><rect x="2" y="2" width="12" height="13" rx="1" stroke=currentColor stroke-width=1.3 fill=none/><line x1="5" y1="6" x2="7" y2="6" stroke=currentColor stroke-width=1.2 stroke-linecap=round/><line x1="9" y1="6" x2="11" y2="6" stroke=currentColor stroke-width=1.2 stroke-linecap=round/><line x1="5" y1="9" x2="7" y2="9" stroke=currentColor stroke-width=1.2 stroke-linecap=round/><line x1="9" y1="9" x2="11" y2="9" stroke=currentColor stroke-width=1.2 stroke-linecap=round/><rect x="6" y="11" width="4" height="4" stroke=currentColor stroke-width=1.2 fill=none/></svg></span>';
    wrap.style.cssText = 'width:32px;height:32px;border-radius:8px;background:var(--bg4);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;transition:all .2s';
    return;
  }
  const logoUrl = getFirmLogo(firmName);
  const letter  = firmName.charAt(0).toUpperCase();
  if (logoUrl) {
    // Use DOM — no inline onerror template literal
    const img = document.createElement('img');
    img.src   = logoUrl;
    img.alt   = letter;
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;padding:3px';
    img.onerror = () => {
      wrap.innerHTML = '';
      const sp = document.createElement('span');
      sp.textContent = letter;
      sp.style.cssText = 'font-size:14px;font-weight:700;color:#fff;font-family:var(--font-display)';
      wrap.appendChild(sp);
      wrap.style.background = 'linear-gradient(135deg,'+getComputedStyle(document.documentElement).getPropertyValue('--purple').trim()+',#4d8ef0)';
    };
    wrap.innerHTML = '';
    wrap.appendChild(img);
    wrap.style.background = 'var(--bg3)';
    wrap.style.borderColor = 'var(--ac-30)';
  } else {
    wrap.innerHTML = '';
    const sp = document.createElement('span');
    sp.textContent = letter;
    sp.style.cssText = 'font-size:14px;font-weight:700;color:#fff;font-family:var(--font-display)';
    wrap.appendChild(sp);
    wrap.style.background = 'linear-gradient(135deg,'+getComputedStyle(document.documentElement).getPropertyValue('--purple').trim()+',#4d8ef0)';
    wrap.style.borderColor = 'var(--ac-30)';
  }
}

function openLegacyAddAccountModal() {
  closeAcctDropdown();
  ['aa-firm','aa-size'].forEach(id => { const el=$(id); if(el) el.value=''; });
  updateAaFirmLogo('');
  $('aa-maxdd').value  = '8';
  $('aa-daily').value  = '4';
  $('aa-profit').value = '8';
  $('aa-error').style.display = 'none';
  aaSelectedStage = 'eval';
  $('aa-stage-eval').classList.add('aa-pill-active');
  $('aa-stage-funded').classList.remove('aa-pill-active');
  $('aa-phase-row').style.display = '';
  const profitCol = $('aa-profit-col');
  if (profitCol) profitCol.style.display = '';
  aaPhaseChecked = false;
  aaSelectedPhaseNum = null;
  const cb = $('aa-phase-checkbox');
  cb.style.background = 'transparent';
  cb.style.borderColor = 'var(--ac-40)';
  cb.innerHTML = '';
  $('aa-phase-num-row').style.display = 'none';
  $$('#aa-phase-num-pills .aa-pill').forEach(p => p.classList.remove('aa-pill-active'));
  aaSelectedDDType = 'trailing';
  $('aa-dd-trailing').classList.add('aa-pill-active');
  $('aa-dd-static').classList.remove('aa-pill-active');
  $('add-account-overlay').style.display = 'flex';
  setTimeout(() => $('aa-firm').focus(), 50);
}

function closeLegacyAddAccountModal() {
  $('add-account-overlay').style.display = 'none';
}

function aaSelectStage(stage) {
  aaSelectedStage = stage;
  $('aa-stage-eval').classList.toggle('aa-pill-active', stage === 'eval');
  $('aa-stage-funded').classList.toggle('aa-pill-active', stage === 'funded');
  // Phase row only for eval
  $('aa-phase-row').style.display = stage === 'funded' ? 'none' : '';
  // Profit target only for eval
  const profitCol = $('aa-profit-col');
  if (profitCol) profitCol.style.display = stage === 'funded' ? 'none' : '';
  if (stage === 'funded') {
    aaPhaseChecked = false;
    $('aa-phase-num-row').style.display = 'none';
    const cb = $('aa-phase-checkbox');
    cb.style.background = 'transparent';
    cb.style.borderColor = 'var(--ac-40)';
    cb.innerHTML = '';
  }
}

function aaTogglePhase() {
  aaPhaseChecked = !aaPhaseChecked;
  const cb = $('aa-phase-checkbox');
  if (aaPhaseChecked) {
    cb.style.background = 'var(--purple)';
    cb.style.borderColor = 'var(--purple)';
    cb.innerHTML = '<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M1.5 6l3 3 6-6" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    $('aa-phase-num-row').style.display = '';
  } else {
    cb.style.background = 'transparent';
    cb.style.borderColor = 'var(--ac-40)';
    cb.innerHTML = '';
    $('aa-phase-num-row').style.display = 'none';
    aaSelectedPhaseNum = null;
    $$('#aa-phase-num-pills .aa-pill').forEach(p => p.classList.remove('aa-pill-active'));
  }
}

function aaSelectPhaseNum(btn, num) {
  $$('#aa-phase-num-pills .aa-pill').forEach(p => p.classList.remove('aa-pill-active'));
  btn.classList.add('aa-pill-active');
  aaSelectedPhaseNum = num;
}

function aaSelectDDType(type) {
  aaSelectedDDType = type;
  $('aa-dd-trailing').classList.toggle('aa-pill-active', type === 'trailing');
  $('aa-dd-static').classList.toggle('aa-pill-active', type === 'static');
}

function showAaError(msg) {
  const el = $('aa-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function confirmLegacyNewAccount() {
  const firm   = $('aa-firm').value.trim().toUpperCase();
  const size   = parseFloat($('aa-size').value);
  const maxdd  = parseFloat($('aa-maxdd').value);
  const daily  = parseFloat($('aa-daily').value);
  const profitInput = $('aa-profit');
  const profit = profitInput ? parseFloat(profitInput.value) || 0 : 0;
  $('aa-error').style.display = 'none';
  if (!firm)             { showAaError('Firm name is required.'); return; }
  if (!size || size < 1) { showAaError('Account size must be a positive number.'); return; }
  if (aaPhaseChecked && !aaSelectedPhaseNum) { showAaError('Please select a phase number.'); return; }
  if (!maxdd  || maxdd  <= 0 || maxdd  > 100) { showAaError('Max drawdown must be 1-100%.'); return; }
  if (!daily  || daily  <= 0 || daily  > 100) { showAaError('Daily loss must be 1-100%.'); return; }
  if (aaSelectedStage === 'eval' && (!profit || profit <= 0 || profit > 100)) { showAaError('Profit target must be 1-100%.'); return; }
  let phase = '';
  if (aaSelectedStage === 'funded') { phase = 'Funded'; }
  else if (aaPhaseChecked && aaSelectedPhaseNum) { phase = 'Phase ' + aaSelectedPhaseNum + ' Eval'; }
  else { phase = 'Eval'; }
  const type = aaSelectedStage === 'funded' ? 'LIVE' : 'DEMO';
  const newAcct = {
    id: ACCOUNTS.length + 1, firm, phase, key: phase,
    balance: '$' + size.toFixed(2),
    type, active: true, startBal: size,
    maxDrawdown: maxdd, dailyLoss: daily, profitTarget: aaSelectedStage === 'funded' ? 0 : profit, ddType: aaSelectedDDType,
  };
  ACCOUNTS.push(newAcct);
  saveAccounts();

  // ── Sync the Add Trade modal account list ──
  if (typeof syncTradeModalAccountList === 'function') {
    syncTradeModalAccountList();
  }

  // ── Sync analytics account bars ──
  const newAcctBarHtml = buildAnAccountBar();
  const barP3 = $('an-acct-bar-p3');
  const barP4 = $('an-acct-bar-p4');
  if (barP3) barP3.innerHTML = newAcctBarHtml;
  if (barP4) barP4.innerHTML = newAcctBarHtml;
  closeLegacyAddAccountModal();
  if (typeof renderAccountsPage === 'function') renderAccountsPage();
  selectAcct(ACCOUNTS.length - 1);
  // Re-open dropdown so user sees the new account
  setTimeout(() => {
    acctOpen = true;
    const dd = $('acct-dropdown');
    const arrow = $('acct-arrow');
    if (dd) dd.style.display = 'block';
    if (arrow) arrow.style.transform = 'rotate(180deg)';
    renderAcctList();
  }, 50);
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && $('add-account-overlay').style.display === 'flex') {
    closeLegacyAddAccountModal();
  }
});
