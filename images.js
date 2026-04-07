// ═══ Trade Image / Screenshot Module ═══
// Ensure app.js helpers are available
if (typeof $ === 'undefined') {
  console.warn('images.js: $ helper not yet available, will be available after app.js loads');
}

// ══════════════════════════════════════════════════════════
//  TRADE IMAGES SYSTEM
// ══════════════════════════════════════════════════════════

const TRADE_IMGS_KEY = 'et-trade-images'; // { tradeId: [{id, label, data}] }
let _lbImages = [];
let _lbIndex  = 0;
let _currentImgTradeId = null;

function loadTradeImages(tradeId) {
  try {
    const all = JSON.parse(localStorage.getItem(TRADE_IMGS_KEY) || '{}');
    return all[String(tradeId)] || [];
  } catch(e) { return []; }
}

function saveTradeImages(tradeId, imgs) {
  try {
    const all = JSON.parse(localStorage.getItem(TRADE_IMGS_KEY) || '{}');
    if (imgs.length === 0) delete all[String(tradeId)];
    else all[String(tradeId)] = imgs;
    localStorage.setItem(TRADE_IMGS_KEY, JSON.stringify(all));
    // Sync to Supabase if signed in
    if (window.SB && window.TRADES) {
      window.SB.getUser().then(user => {
        if (!user) return;
        const trade = window.TRADES.find(t => t.id === tradeId || t.legacy_id === tradeId);
        if (trade && trade._uuid) {
          window.SB.saveTradeImages(trade._uuid, imgs).catch(e => console.warn('SB sync images:', e));
        }
      });
    }
    return true;
  } catch(e) {
    // Storage quota exceeded — try saving without the last image
    showToast('Storage full — image too large or too many images', 'error', '', 3000);
    return false;
  }
}

function renderTradeImages(tradeId) {
  if (tradeId !== undefined && tradeId !== null) _currentImgTradeId = tradeId;
  const section = $('detail-img-section');
  if (!section) {
    // Panel may have re-rendered — retry once after a frame
    if (tradeId !== undefined) requestAnimationFrame(() => renderTradeImages(tradeId));
    return;
  }
  const imgs = loadTradeImages(tradeId ?? _currentImgTradeId);
  if (!imgs) return;
  _lbImages = imgs;

  let html = '<div class="trade-img-gallery">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">';
  html += '<div class="dg-label">Screenshots</div>';
  if (imgs.length > 0) {
    html += '<span style="font-size:9px;color:var(--text3);font-family:var(--font-mono)">' + imgs.length + ' image' + (imgs.length!==1?'s':'') + '</span>';
  }
  html += '</div>';

  if (imgs.length > 0) {
    html += '<div class="trade-img-grid">';
    imgs.forEach((img, i) => {
      const labelText = img.label ? img.label.replace(/</g,'&lt;').replace(/>/g,'&gt;') : '';
      const labelDisplay = labelText || '<span style="opacity:0.45;font-style:italic">Add label…</span>';
      html += '<div class="trade-img-thumb" data-idx="' + i + '">'
        + '<img src="' + img.data + '" alt="' + (img.label||'Chart') + '" loading="lazy">'
        + '<div class="img-label" title="Click to add label">'
        + labelDisplay
        + '</div>'
        + '<div class="img-del-btn" title="Remove"><svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></div>'
        + '</div>';
    });
    html += '</div>';
  }

  // Add button — always shown
  html += '<div class="trade-img-add" id="trade-img-add-btn">'
    + '<span style="font-size:22px; color:var(--text3);display:flex"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="4.5" width="13" height="9.5" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="8" cy="9.5" r="2.5" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M5.5 4.5L6.5 2.5h3l1 2" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" fill="none"/></svg></span>'
    + '<span>Click to add screenshot · drag &amp; drop · paste (Ctrl+V)</span>'
    + '<span style="font-size:9px;color:var(--text4);font-family:var(--font-mono)">JPG, PNG, WebP · multiple supported</span>'
    + '</div>';

  html += '</div>';
  section.innerHTML = html;

  // Wire add button
  const addBtn = section.querySelector('#trade-img-add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', triggerTradeImgUpload);
    addBtn.addEventListener('dragover', e => { e.preventDefault(); addBtn.classList.add('drag-over'); });
    addBtn.addEventListener('dragleave', () => addBtn.classList.remove('drag-over'));
    addBtn.addEventListener('drop', e => { addBtn.classList.remove('drag-over'); handleTradeImgDrop(e); });
  }

  // Wire thumb clicks via addEventListener — no inline onclick needed
  section.querySelectorAll('.trade-img-thumb').forEach(thumb => {
    const idx = parseInt(thumb.dataset.idx);
    // Main thumb click → lightbox
    thumb.addEventListener('click', () => openLightbox(idx));
    // Label click → rename (capture phase so it fires before the thumb's lightbox handler)
    const lbl = thumb.querySelector('.img-label');
    if (lbl) lbl.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); renameTradeImage(idx); }, true);
    // Delete btn (capture phase)
    const del = thumb.querySelector('.img-del-btn');
    if (del) del.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); deleteTradeImage(idx); }, true);
  });

  // Wire paste on panel
  const panel = $('detail-panel');
  if (panel && !panel._imgPasteWired) {
    panel._imgPasteWired = true;
    document.addEventListener('paste', handleTradeImgPaste);
  }
}

function triggerTradeImgUpload() {
  const inp = $('trade-img-file-input');
  if (!inp) return;
  // Prevent outside-click handler from closing panel while picker is open
  window._imgPickerOpen = true;
  inp.value = '';
  inp.click();
  // Clear the flag once focus returns (picker closed)
  window.addEventListener('focus', function _clearPicker() {
    setTimeout(() => { window._imgPickerOpen = false; }, 300);
    window.removeEventListener('focus', _clearPicker);
  });
  // Also clear after a timeout in case focus event doesn't fire
  setTimeout(() => { window._imgPickerOpen = false; }, 5000);
}

function handleTradeImgUpload(input) {
  if (!_currentImgTradeId) {
    showToast('No trade selected — reopen the trade detail', 'error', '', 3000);
    return;
  }
  const files = Array.from(input.files);
  if (!files.length) return;
  processImgFiles(files);
}

function handleTradeImgDrop(e) {
  e.preventDefault();
  e.currentTarget.style.borderColor = 'var(--ac-35)';
  if (!_currentImgTradeId) return;
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  processImgFiles(files);
}

function handleTradeImgPaste(e) {
  // Only trigger when detail panel is open
  const panel = $('detail-panel');
  if (!panel || !panel.classList.contains('open') || !_currentImgTradeId) return;
  const items = Array.from(e.clipboardData?.items || []);
  const imgItems = items.filter(it => it.type.startsWith('image/'));
  if (!imgItems.length) return;
  e.preventDefault();
  imgItems.forEach(it => {
    const file = it.getAsFile();
    if (file) processImgFiles([file]);
  });
}

// ── Timeframe picker state ──────────────────────────────────
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
let _tfQueue   = [];   // [{dataUrl, file, fi}] pending picker
let _tfTradeId = null;
let _tfTotal   = 0;
let _tfDone    = 0;

function processImgFiles(files) {
  if (!files.length || !_currentImgTradeId) return;
  _tfTradeId = _currentImgTradeId;
  _tfQueue   = [];
  _tfDone    = 0;
  _tfTotal   = files.length;

  // Read all files first, then show picker one by one
  let readDone = 0;
  files.forEach((file, fi) => {
    const reader = new FileReader();
    reader.onerror = () => {
      readDone++;
      _tfTotal--;
      if (readDone === files.length) _tfPickerNext();
      showToast('Could not read image file', 'error', '');
    };
    reader.onload = ev => {
      const dataUrl = ev.target.result;
      if (dataUrl && dataUrl.startsWith('data:image')) {
        _tfQueue.push({ dataUrl, file, fi });
      } else {
        _tfTotal--;
      }
      readDone++;
      if (readDone === files.length) _tfPickerNext();
    };
    reader.readAsDataURL(file);
  });
}

function _tfPickerNext() {
  if (!_tfQueue.length) {
    // all done — release the panel lock
    window._imgPickerOpen = false;
    renderTradeImages(_tfTradeId);
    if (_tfDone > 0) showToast(_tfDone + ' screenshot' + (_tfDone!==1?'s':'') + ' added', 'success', '', 1800);
    return;
  }
  const item = _tfQueue[0];
  _showTfPicker(item.file.name, tf => {
    _tfQueue.shift();
    const imgs  = loadTradeImages(_tfTradeId);
    imgs.push({ id: Date.now() + Math.random(), label: tf, data: item.dataUrl });
    saveTradeImages(_tfTradeId, imgs);
    _tfDone++;
    _tfPickerNext();
  });
}

function _showTfPicker(filename, callback) {
  const overlay = $('tf-picker-overlay');
  const grid    = $('tf-picker-grid');
  const fnLabel = $('tf-picker-filename');
  if (!overlay || !grid) { callback(''); return; }

  fnLabel.textContent = filename || '';
  overlay.style.display = 'flex';

  // Build grid buttons
  grid.innerHTML = '';
  TF_LIST.forEach(tf => {
    const btn = document.createElement('button');
    btn.textContent = tf.label;
    btn.style.cssText = 'padding:10px 6px;border-radius:8px;background:var(--bg4);border:1px solid var(--border2);color:var(--text2);font-family:var(--font-mono);font-size:11px;cursor:pointer;transition:all .15s;font-weight:500;letter-spacing:.02em';
    btn.onmouseenter = () => { btn.style.background='var(--ac-18)'; btn.style.borderColor='var(--ac-50)'; btn.style.color='#b891f5'; };
    btn.onmouseleave = () => { btn.style.background='var(--bg4)'; btn.style.borderColor='var(--border2)'; btn.style.color='var(--text2)'; };
    btn.onclick = () => { overlay.style.display='none'; callback(tf.value); };
    grid.appendChild(btn);
  });

  // Keep detail panel open while picker is visible
  window._imgPickerOpen = true;
  // Store callback for Skip button
  overlay._tfCallback = callback;
}

function tfPickerSkip() {
  const overlay = $('tf-picker-overlay');
  if (!overlay) return;
  overlay.style.display = 'none';
  window._imgPickerOpen = false;
  if (typeof overlay._tfCallback === 'function') {
    overlay._tfCallback('');
    overlay._tfCallback = null;
  }
}

function guessImgLabel(existingCount, filename) {
  if (filename) {
    const f = filename.toLowerCase();
    // Timeframe detection from filename
    if (/(|_)1m(|_|chart|tf)/i.test(f) || /1.?min/i.test(f) || /m1(|_)/i.test(f))   return '1M Chart';
    if (/(|_)3m(|_|chart|tf)/i.test(f) || /3.?min/i.test(f))                            return '3M Chart';
    if (/(|_)5m(|_|chart|tf)/i.test(f) || /5.?min/i.test(f) || /m5(|_)/i.test(f))   return '5M Chart';
    if (/(|_)15m(|_|chart|tf)/i.test(f)|| /15.?min/i.test(f)||/m15(|_)/i.test(f))   return '15M Chart';
    if (/(|_)30m(|_|chart|tf)/i.test(f)|| /30.?min/i.test(f)||/m30(|_)/i.test(f))   return '30M Chart';
    if (/(|_)1h(|_|chart|tf)/i.test(f) || /1.?hour/i.test(f)|| /h1(|_)/i.test(f))   return '1H Chart';
    if (/(|_)2h(|_|chart|tf)/i.test(f) || /h2(|_)/i.test(f))                         return '2H Chart';
    if (/(|_)4h(|_|chart|tf)/i.test(f) || /4.?hour/i.test(f)|| /h4(|_)/i.test(f))   return '4H Chart';
    if (/(|_)d1(|_|chart|tf)/i.test(f) || /daily/i.test(f)  || /1d(|_)/i.test(f))   return 'Daily Chart';
    if (/(|_)w1(|_|chart|tf)/i.test(f) || /weekly/i.test(f) || /1w(|_)/i.test(f))   return 'Weekly Chart';
    if (/entry/i.test(f))                                                                    return 'Entry';
    if (/exit/i.test(f))                                                                     return 'Exit';
    if (/htf/i.test(f))                                                                      return 'HTF';
    if (/ltf/i.test(f))                                                                      return 'LTF';
  }
  // No match — return empty so the user can label it themselves
  return '';
}

function renameTradeImage(index) {
  if (!_currentImgTradeId) return;
  const imgs = loadTradeImages(_currentImgTradeId);
  if (!imgs[index]) return;
  const current = imgs[index].label || '';
  
  // Show timeframe picker for this specific image
  const overlay = $('tf-picker-overlay');
  const grid    = $('tf-picker-grid');
  const fnLabel = $('tf-picker-filename');
  if (!overlay || !grid) return;

  fnLabel.textContent = 'Rename/assign label';
  overlay.style.display = 'flex';

  // Build grid buttons
  grid.innerHTML = '';
  TF_LIST.forEach(tf => {
    const btn = document.createElement('button');
    btn.textContent = tf.label;
    btn.style.cssText = 'padding:10px 6px;border-radius:8px;background:var(--bg4);border:1px solid var(--border2);color:var(--text2);font-family:var(--font-mono);font-size:11px;cursor:pointer;transition:all .15s;font-weight:500;letter-spacing:.02em';
    btn.onmouseenter = () => { btn.style.background='var(--ac-18)'; btn.style.borderColor='var(--ac-50)'; btn.style.color='#b891f5'; };
    btn.onmouseleave = () => { btn.style.background='var(--bg4)'; btn.style.borderColor='var(--border2)'; btn.style.color='var(--text2)'; };
    btn.onclick = () => {
      overlay.style.display='none';
      const allImgs = loadTradeImages(_currentImgTradeId);
      allImgs[index].label = tf.value;
      saveTradeImages(_currentImgTradeId, allImgs);
      renderTradeImages(_currentImgTradeId);
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

function deleteTradeImage(index) {
  if (!_currentImgTradeId) return;
  const imgs = loadTradeImages(_currentImgTradeId);
  imgs.splice(index, 1);
  saveTradeImages(_currentImgTradeId, imgs);
  renderTradeImages(_currentImgTradeId);
  showToast('Screenshot removed', 'info', '', 1400);
}

// ── Lightbox ────────────────────────────────────────────────
function openLightbox(index) {
  const imgs = loadTradeImages(_currentImgTradeId);
  if (!imgs.length) return;
  _lbImages = imgs;
  _lbIndex  = index;
  renderLightbox();
  const lb = $('trade-img-lightbox');
  lb.style.display = 'flex';
  // Trigger fade-in after display change
  requestAnimationFrame(() => {
    lb.style.opacity = '1';
  });
  document.addEventListener('keydown', lbKeyHandler);
  
  // Close on background click
  lb.onclick = (e) => {
    if (e.target === lb) closeLightbox();
  };
  
  // Show navigation hint as toast
  showToast('← → to navigate · ESC to close', 'info', '', 4000);
}

function closeLightbox() {
  const lb = $('trade-img-lightbox');
  lb.style.opacity = '0';
  setTimeout(() => {
    lb.style.display = 'none';
  }, 250);
  document.removeEventListener('keydown', lbKeyHandler);
}

function renderLightbox() {
  const img   = _lbImages[_lbIndex];
  const total = _lbImages.length;
  $('lb-img').src = img.data;
  $('trade-img-lightbox-label').textContent = (img.label || 'Chart ' + (_lbIndex+1));
  $('lb-counter').textContent = (_lbIndex+1) + ' / ' + total;
  
  const prevBtn = $('lb-prev');
  const nextBtn = $('lb-next');
  
  // Hide buttons if only one image
  if (total === 1) {
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
  } else {
    prevBtn.style.display = 'flex';
    nextBtn.style.display = 'flex';
    
    prevBtn.disabled = _lbIndex === 0;
    nextBtn.disabled = _lbIndex >= total-1;
    
    // Style disabled buttons
    if (prevBtn.disabled) {
      prevBtn.style.opacity = '0.3';
      prevBtn.style.cursor = 'not-allowed';
    } else {
      prevBtn.style.opacity = '1';
      prevBtn.style.cursor = 'pointer';
    }
    
    if (nextBtn.disabled) {
      nextBtn.style.opacity = '0.3';
      nextBtn.style.cursor = 'not-allowed';
    } else {
      nextBtn.style.opacity = '1';
      nextBtn.style.cursor = 'pointer';
    }
  }
}

function lbNav(dir) {
  _lbIndex = Math.max(0, Math.min(_lbImages.length-1, _lbIndex + dir));
  renderLightbox();
}

function lbKeyHandler(e) {
  if (e.key === 'ArrowLeft')  lbNav(-1);
  if (e.key === 'ArrowRight') lbNav(1);
  if (e.key === 'Escape')     closeLightbox();
}

// Clear paste wiring when panel closes
const _origCloseDetail = window.closeDetail;
window.closeDetail = function() {
  _currentImgTradeId = null;
  _origCloseDetail && _origCloseDetail.apply(this, arguments);
};
