// ═══ TRADE IMPORT SYSTEM ═══

// ── State variables for import modal ──
let _importFormat = 'csv';
let _importFile = null;
let _importedTrades = [];
let _importTargetAccount = '';
const _AUTO_IMPORT_STORAGE_KEY = 'etBrokerAutoImportConnections';
let _brokerConnections = [];
let _brokerPollTimers = {};

// ── Open/Close Import Modal ──
function openImportModal() {
  $('import-modal-overlay').style.display = 'flex';

  // Only do a full reset if there's no previously loaded file
  const hasExistingData = _importFile !== null && _importedTrades.length > 0;

  if (!hasExistingData) {
    _importFormat = 'csv';
    _importFile = null;
    _importedTrades = [];
    _importTargetAccount = '';

    const fileInput = $('import-file-input');
    if (fileInput) fileInput.value = '';

    $$('.import-format-btn').forEach(btn => {
      btn.style.background = 'transparent';
      btn.style.borderColor = 'var(--ac-40)';
      btn.style.color = 'var(--text2)';
    });

    const csvBtn = $('import-format-buttons').querySelector('[data-format="csv"]');
    if (csvBtn) {
      csvBtn.style.background = 'var(--ac-18)';
      csvBtn.style.borderColor = 'var(--purple)';
      csvBtn.style.color = 'var(--text)';
    }

    $('import-file-name').style.display = 'none';
    $('import-preview').style.display = 'none';
    $('import-error').style.display = 'none';
    $('import-submit-btn').disabled = true;
  } else {
    // Re-opened after cancel with existing data — restore preview & enable button
    showImportPreview(_importedTrades);
    $('import-submit-btn').disabled = false;
    $('import-error').style.display = 'none';
  }

  const accountSelect = $('import-target-account');
  accountSelect.innerHTML = '<option value="">Select account to import into...</option>';
  if (Array.isArray(ACCOUNTS)) {
    ACCOUNTS.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.phase || a.key || '';
      opt.textContent = `${a.firm || 'Account'} - ${a.phase || a.key || ''}`;
      accountSelect.appendChild(opt);
    });
  }

  populateBrokerAccountOptions();
  renderBrokerConnections();

  const tzSel = $('import-source-timezone');
  if (tzSel) {
    populateImportTimezoneOptions();
    const saved = localStorage.getItem('etImportSourceTimezone') || 'UTC+00:00';
    tzSel.value = saved;
  }

  setTimeout(() => adjustContrastForBackgroundShift(), 50);
}

function closeImportModal() {
  $('import-modal-overlay').style.display = 'none';
  // NOTE: intentionally keep _importedTrades and _importFile so that
  // if the user closes and re-opens the modal (e.g. to add an account first)
  // their uploaded file and parsed trades are still available.
  // They are cleared only when openImportModal() finishes a fresh open
  // without a previous file, or after a successful import.
}

// ── Format Selection ──
function setImportFormat(format) {
  _importFormat = format;
  $$('.import-format-btn').forEach(btn => {
    btn.style.background = 'transparent';
    btn.style.borderColor = 'var(--ac-40)';
    btn.style.color = 'var(--text2)';
  });

  const selected = $('import-format-buttons').querySelector(`[data-format="${format}"]`);
  if (selected) {
    selected.style.background = 'var(--ac-18)';
    selected.style.borderColor = 'var(--purple)';
    selected.style.color = 'var(--text)';
  }
}

// ── File Input Handling ──
function importFileClick() {
  const fileInput = $('import-file-input');
  if (!fileInput) return;
  // Clear current value so picking the same file again still fires onchange.
  fileInput.value = '';
  fileInput.click();
}

function handleImportDrop(e) {
  const files = e.dataTransfer ? e.dataTransfer.files : null;
  if (files && files.length > 0) {
    handleImportFile({ files: files });
  }
}

function handleImportFile(input) {
  if (!input.files || input.files.length === 0) return;

  const file = input.files[0];
  if (file.size > 5 * 1024 * 1024) {
    showImportError('File too large (max 5MB)');
    return;
  }

  _importFile = file;
  $('import-file-name').textContent = `✓ ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  $('import-file-name').style.display = '';

  parseImportFile();
}

// ── Parsing entry point ──
function parseImportFile() {
  if (!_importFile) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target.result;
      let trades = [];

      if (_importFormat === 'json') {
        trades = parseJSON(content);
      } else {
        trades = parseCSV(content, _importFormat);
      }

      if (!trades.length) {
        showImportError('No valid trades found in file');
        return;
      }

      _importedTrades = trades;
      showImportPreview(trades);
      $('import-submit-btn').disabled = false;
      $('import-error').style.display = 'none';
    } catch (err) {
      showImportError(`Parse error: ${err.message}`);
    }
  };
  reader.readAsText(_importFile);
}

// ── Parse JSON ──
function parseJSON(content) {
  const data = JSON.parse(content);
  const rows = Array.isArray(data) ? data : (data.trades || []);

  return rows.map((t, idx) => {
    const symbol = (t.symbol || t.Symbol || t.pair || t.Pair || 'UNKNOWN').toUpperCase();
    const normDate = normalizeDate(t.date || t.Date || '');
    const normTime = normalizeTime(t.time || t.Time || t.entryTime || '');
    const dtNorm = normalizeImportedDateTime(normDate, normTime);
    return {
      id: t.id || nextTradeId() + idx,
      date: dtNorm.date,
      time: dtNorm.time,
      symbol,
      type: detectInstrumentType(symbol),
      dir: normalizeDir(t.direction || t.Direction || t.dir || t.Dir || t.side || t.Side || 'long'),
      entry: parseNumber(t.entry || t.Entry || t.entryPrice || t.open || t.openPrice),
      exit: parseNumber(t.exit || t.Exit || t.exitPrice || t.close || t.closePrice),
      size: parseNumber(t.size || t.Size || t.volume || t.Volume || 1, 1),
      pnl: parseNumber(t.pnl || t.PnL || t.profit || t.Profit || 0),
      comm: parseNumber(t.comm || t.commission || t.Commission || 0),
      sl: t.stoploss || t.stopLoss || t.sl ? parseNumber(t.stoploss || t.stopLoss || t.sl) : null,
      tp: t.takeprofit || t.takeProfit || t.tp ? parseNumber(t.takeprofit || t.takeProfit || t.tp) : null,
      setup: t.setup || t.Setup || 'Imported',
      model: t.model || t.Model || '',
      session: t.session || t.Session || (typeof inferSessionFromTradingTime === 'function' ? inferSessionFromTradingTime(dtNorm.sessionTime) : (typeof inferSessionFromESTTime === 'function' ? inferSessionFromESTTime(dtNorm.sessionTime) : '')),
      notes: t.notes || t.Notes || t.comment || '',
      rating: parseInt(t.rating || t.Rating || 0, 10) || 0,
      emotions: Array.isArray(t.emotions) ? t.emotions : [],
      account: $('import-target-account').value || ''
    };
  }).filter(t => t.date && t.symbol && t.entry > 0);
}

// ── Parse CSV ──
function parseCSV(content, format) {
  const lines = content.replace(/\r/g, '').split('\n').filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => normalizeHeader(h));
  const trades = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = toRowMap(headers, values);
    const trade = mapCSVRow(headers, row, format);
    if (trade) trades.push(trade);
  }

  return trades;
}

function parseCSVLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out.map(v => v.replace(/^"|"$/g, ''));
}

function normalizeHeader(h) {
  return String(h || '')
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function toRowMap(headers, values) {
  const m = {};
  headers.forEach((h, i) => {
    m[h] = values[i] || '';
  });
  return m;
}

function pickValue(row, preferredHeaders, fallbackKeywords) {
  for (const h of preferredHeaders) {
    if (row[h] !== undefined && row[h] !== '') return row[h];
  }

  const headerList = Object.keys(row);

  // exact keyword-header match first
  for (const kw of fallbackKeywords) {
    const exact = headerList.find(h => h === kw);
    if (exact && row[exact] !== '') return row[exact];
  }

  // word-level match next
  for (const kw of fallbackKeywords) {
    const word = headerList.find(h => h.split(' ').includes(kw));
    if (word && row[word] !== '') return row[word];
  }

  // substring fallback last
  for (const kw of fallbackKeywords) {
    const partial = headerList.find(h => h.includes(kw));
    if (partial && row[partial] !== '') return row[partial];
  }

  return '';
}

function mapCSVRow(headers, row, format) {
  const symbol = pickValue(row,
    ['symbol', 'instrument', 'pair'],
    ['symbol', 'instrument', 'pair']
  ).toUpperCase();

  const openTime = pickValue(row,
    ['open time', 'opentime', 'date', 'open date'],
    ['open time', 'opentime', 'date']
  );

  const closeTime = pickValue(row,
    ['close time', 'closetime', 'time'],
    ['close time', 'time']
  );

  const rawDate = normalizeDate(openTime || pickValue(row, ['date'], ['date']));
  const rawTime = normalizeTime(openTime || closeTime);
  const dtNorm = normalizeImportedDateTime(rawDate, rawTime);
  const date = dtNorm.date;
  const time = dtNorm.time;
  const inferredSession = (typeof inferSessionFromTradingTime === 'function') ? inferSessionFromTradingTime(dtNorm.sessionTime) : ((typeof inferSessionFromESTTime === 'function') ? inferSessionFromESTTime(dtNorm.sessionTime) : '');

  const dir = normalizeDir(pickValue(row,
    ['side', 'direction', 'type'],
    ['side', 'direction', 'type', 'buy', 'sell']
  ));

  const entry = parseNumber(pickValue(row,
    ['open price', 'openprice', 'entry'],
    ['open price', 'openprice', 'entry', 'open']
  ));

  const exit = parseNumber(pickValue(row,
    ['close price', 'closeprice', 'exit'],
    ['close price', 'closeprice', 'exit', 'close']
  ));

  const size = parseNumber(pickValue(row,
    ['volume', 'size', 'lots', 'lot'],
    ['volume', 'size', 'lots', 'lot']
  ), 1);

  // Critical fix: prefer exact Profit/PnL fields before any generic "profit" keyword.
  const pnl = parseNumber(pickValue(row,
    ['profit', 'pnl', 'p&l', 'net profit', 'pl'],
    ['pnl', 'p&l', 'net profit', 'profit', 'pl']
  ));

  const comm = parseNumber(pickValue(row,
    ['commission', 'comm', 'fee', 'fees'],
    ['commission', 'comm', 'fee', 'fees']
  ));

  const sl = parseNullableNumber(pickValue(row,
    ['stop loss', 'stoploss', 'sl'],
    ['stop loss', 'stoploss', 'sl']
  ));

  const tp = parseNullableNumber(pickValue(row,
    ['take profit', 'takeprofit', 'tp'],
    ['take profit', 'takeprofit', 'tp']
  ));

  if (!symbol || !date || entry <= 0) return null;

  if (symbol === 'TOTAL' || symbol === 'SUMMARY') return null;

  return {
    id: nextTradeId(),
    date,
    time,
    symbol,
    type: detectInstrumentType(symbol),
    dir,
    entry,
    exit,
    size,
    pnl,
    comm,
    sl,
    tp,
    setup: 'Imported',
    model: '',
    session: inferredSession,
    notes: '',
    rating: 0,
    emotions: [],
    account: $('import-target-account').value || ''
  };
}

function detectInstrumentType(symbol) {
  if (symbol.includes('/')) return 'Forex';
  if (['XAUUSD', 'XAGUSD'].includes(symbol)) return 'Metals';
  if (['NQ', 'ES', 'YM', 'MNQ', 'MES', 'MYM', 'RTY', 'CL', 'GC', 'SI', 'ZB', 'ZN'].some(s => symbol.startsWith(s))) {
    return 'Futures';
  }
  return 'Forex';
}

function nextTradeId() {
  return TRADES.length > 0 ? Math.max(...TRADES.map(t => t.id || 0)) + 1 : 1;
}

function parseNumber(v, fallback = 0) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? fallback : n;
}

function parseNullableNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseNumber(v, NaN);
  return isNaN(n) ? null : n;
}

function normalizeDate(dateStr) {
  if (!dateStr) return '';
  const raw = String(dateStr).trim();
  const onlyDate = raw.split(' ')[0];

  // DD/MM/YYYY or MM/DD/YYYY or DD-MM-YYYY
  const p = onlyDate.split(/[\/-]/);
  if (p.length === 3) {
    let a = parseInt(p[0], 10);
    let b = parseInt(p[1], 10);
    let c = parseInt(p[2], 10);
    if (isNaN(a) || isNaN(b) || isNaN(c)) return '';

    if (c < 100) c += 2000;

    let day = a;
    let month = b;
    // If first piece cannot be day but second can be day, treat as MM/DD
    if (a <= 12 && b > 12) {
      day = b;
      month = a;
    }

    const d = new Date(c, month - 1, day);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  const d2 = new Date(raw);
  if (!isNaN(d2.getTime())) return d2.toISOString().split('T')[0];

  return '';
}

function normalizeTime(timeStr) {
  if (!timeStr) return '';
  const match = String(timeStr).match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!match) return '';
  const h = String(parseInt(match[1], 10)).padStart(2, '0');
  const m = String(parseInt(match[2], 10)).padStart(2, '0');
  return `${h}:${m}`;
}

function normalizeDir(dirStr) {
  const d = String(dirStr || '').toLowerCase();
  if (d.includes('sell') || d.includes('short') || d === 's') return 'short';
  return 'long';
}

function getImportSourceTimezone() {
  // Can be set explicitly via localStorage key: etImportSourceTimezone
  // Example: localStorage.setItem('etImportSourceTimezone', 'Europe/London')
  const fromUI = $('import-source-timezone') ? $('import-source-timezone').value : '';
  let settingsDefault = '';
  try {
    if (typeof loadSettings === 'function') settingsDefault = loadSettings().importTimezone || '';
  } catch (_) {}
  const explicit = fromUI || localStorage.getItem('etImportSourceTimezone') || settingsDefault;
  if (explicit) return explicit;
  return 'UTC+00:00';
}

function setImportSourceTimezone(tz) {
  if (!tz) return;
  localStorage.setItem('etImportSourceTimezone', tz);
  try {
    if (typeof saveSetting === 'function') saveSetting('importTimezone', tz);
  } catch (_) {}
}

function populateImportTimezoneOptions() {
  const sel = $('import-source-timezone');
  if (!sel) return;

  const current = localStorage.getItem('etImportSourceTimezone') || 'UTC+00:00';
  sel.innerHTML = '';

  const cityByOffset = {
    '-12:00': 'Baker Island',
    '-11:00': 'Pago Pago',
    '-10:00': 'Honolulu',
    '-09:30': 'Marquesas',
    '-09:00': 'Anchorage',
    '-08:00': 'Los Angeles',
    '-07:00': 'Denver',
    '-06:00': 'Chicago',
    '-05:00': 'New York',
    '-04:00': 'Santiago',
    '-03:30': 'St Johns',
    '-03:00': 'Sao Paulo',
    '-02:00': 'South Georgia',
    '-01:00': 'Azores',
    '+00:00': 'London',
    '+01:00': 'Berlin',
    '+02:00': 'Cairo',
    '+03:00': 'Moscow',
    '+03:30': 'Tehran',
    '+04:00': 'Dubai',
    '+04:30': 'Kabul',
    '+05:00': 'Karachi',
    '+05:30': 'Kolkata',
    '+05:45': 'Kathmandu',
    '+06:00': 'Dhaka',
    '+06:30': 'Yangon',
    '+07:00': 'Bangkok',
    '+08:00': 'Singapore',
    '+08:45': 'Eucla',
    '+09:00': 'Tokyo',
    '+09:30': 'Adelaide',
    '+10:00': 'Sydney',
    '+10:30': 'Lord Howe',
    '+11:00': 'Noumea',
    '+12:00': 'Auckland',
    '+12:45': 'Chatham',
    '+13:00': 'Apia',
    '+13:45': 'Chatham DST',
    '+14:00': 'Kiritimati'
  };

  const makeOffset = mins => {
    const sign = mins >= 0 ? '+' : '-';
    const abs = Math.abs(mins);
    const hh = String(Math.floor(abs / 60)).padStart(2, '0');
    const mm = String(abs % 60).padStart(2, '0');
    return `UTC${sign}${hh}:${mm}`;
  };

  for (let h = -12; h <= 14; h++) {
    const val = makeOffset(h * 60);
    const opt = document.createElement('option');
    opt.value = val;
    const key = val.replace('UTC', '');
    opt.textContent = `${val} (${cityByOffset[key] || 'Local'})`;
    sel.appendChild(opt);
  }

  // Common non-hour offsets
  [
    -570, -210, 210, 270, 330, 345, 390, 525, 570, 630, 765, 825
  ].forEach(mins => {
    const val = makeOffset(mins);
    if ([...sel.options].some(o => o.value === val)) return;
    const opt = document.createElement('option');
    opt.value = val;
    const key = val.replace('UTC', '');
    opt.textContent = `${val} (${cityByOffset[key] || 'Local'})`;
    sel.appendChild(opt);
  });

  // Keep a few named zones for convenience
  ['America/New_York', 'Europe/London', 'Europe/Berlin', 'Asia/Kolkata', 'UTC'].forEach(tz => {
    if ([...sel.options].some(o => o.value === tz)) return;
    const opt = document.createElement('option');
    opt.value = tz;
    opt.textContent = tz;
    sel.appendChild(opt);
  });

  sel.value = [...sel.options].some(o => o.value === current) ? current : 'UTC+00:00';
}

function _parseUtcOffsetMinutes(tz) {
  const m = String(tz || '').trim().match(/^UTC([+-])(\d{2}):(\d{2})$/i);
  if (!m) return null;
  const sign = m[1] === '+' ? 1 : -1;
  const hh = parseInt(m[2], 10);
  const mm = parseInt(m[3], 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh > 14 || mm > 59) return null;
  return sign * (hh * 60 + mm);
}

function getJournalTimezone() {
  try {
    if (typeof loadSettings === 'function') {
      const s = loadSettings();
      if (s && s.tradingTimezone) return s.tradingTimezone;
      if (s && s.displayTimezone) return s.displayTimezone;
      if (s && s.timezone) return s.timezone;
    }
  } catch (_) {}
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function _fmtPartsByTz(dateObj, tz) {
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

function _zonedLocalToUtcMs(year, month, day, hour, minute, sourceTz) {
  const offsetMins = _parseUtcOffsetMinutes(sourceTz);
  if (offsetMins !== null) {
    return Date.UTC(year, month - 1, day, hour, minute, 0) - (offsetMins * 60 * 1000);
  }

  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const desired = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let i = 0; i < 4; i++) {
    const p = _fmtPartsByTz(new Date(guess), sourceTz);
    const represented = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
    const diff = desired - represented;
    guess += diff;
    if (diff === 0) break;
  }
  return guess;
}

function normalizeImportedDateTime(dateYmd, timeHm) {
  if (!dateYmd || !timeHm) return { date: dateYmd || '', time: timeHm || '', sessionTime: timeHm || '' };

  const d = String(dateYmd).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const t = String(timeHm).match(/^(\d{2}):(\d{2})$/);
  if (!d || !t) return { date: dateYmd, time: timeHm, sessionTime: timeHm };

  const y = parseInt(d[1], 10);
  const mo = parseInt(d[2], 10);
  const da = parseInt(d[3], 10);
  const h = parseInt(t[1], 10);
  const mi = parseInt(t[2], 10);

  let utcMs;
  try {
    utcMs = _zonedLocalToUtcMs(y, mo, da, h, mi, getImportSourceTimezone());
  } catch (_) {
    return { date: dateYmd, time: timeHm, sessionTime: timeHm };
  }

  const utcDate = new Date(utcMs);
  let journalParts;

  try {
    journalParts = _fmtPartsByTz(utcDate, getJournalTimezone());
  } catch (_) {
    return { date: dateYmd, time: timeHm, sessionTime: timeHm };
  }

  const journalDate = `${String(journalParts.year).padStart(4, '0')}-${String(journalParts.month).padStart(2, '0')}-${String(journalParts.day).padStart(2, '0')}`;
  const journalTime = `${String(journalParts.hour).padStart(2, '0')}:${String(journalParts.minute).padStart(2, '0')}`;

  return { date: journalDate, time: journalTime, sessionTime: journalTime };
}

// ── Preview / errors ──
function showImportPreview(trades) {
  $('import-preview-count').textContent = trades.length;

  let html = '<table style="width:100%;border-collapse:collapse">';
  html += '<thead style="background:var(--bg3);position:sticky;top:0"><tr>';
  html += '<th style="padding:6px 4px;text-align:left;border-bottom:1px solid var(--border);font-weight:600">Date</th>';
  html += '<th style="padding:6px 4px;text-align:left;border-bottom:1px solid var(--border);font-weight:600">Symbol</th>';
  html += '<th style="padding:6px 4px;text-align:center;border-bottom:1px solid var(--border);font-weight:600">Dir</th>';
  html += '<th style="padding:6px 4px;text-align:right;border-bottom:1px solid var(--border);font-weight:600">Entry</th>';
  html += '<th style="padding:6px 4px;text-align:right;border-bottom:1px solid var(--border);font-weight:600">Exit</th>';
  html += '<th style="padding:6px 4px;text-align:right;border-bottom:1px solid var(--border);font-weight:600">P&L</th>';
  html += '</tr></thead><tbody>';

  trades.slice(0, 10).forEach(t => {
    const pnlColor = t.pnl > 0 ? 'var(--green)' : (t.pnl < 0 ? 'var(--red)' : 'var(--text3)');
    html += '<tr style="border-bottom:1px solid var(--border)">';
    html += `<td style="padding:5px 4px;font-size:10px">${t.date}</td>`;
    html += `<td style="padding:5px 4px;font-size:10px">${t.symbol}</td>`;
    html += `<td style="padding:5px 4px;text-align:center;font-size:10px;color:${t.dir === 'long' ? 'var(--green)' : 'var(--red)'}">${t.dir.substring(0,1).toUpperCase()}</td>`;
    html += `<td style="padding:5px 4px;text-align:right;font-size:10px">${t.entry.toFixed(5)}</td>`;
    html += `<td style="padding:5px 4px;text-align:right;font-size:10px">${t.exit.toFixed(5)}</td>`;
    html += `<td style="padding:5px 4px;text-align:right;font-size:10px;color:${pnlColor};font-weight:600">${t.pnl > 0 ? '+' : ''}${t.pnl.toFixed(2)}</td>`;
    html += '</tr>';
  });

  if (trades.length > 10) {
    html += `<tr><td colspan="6" style="padding:8px 4px;text-align:center;color:var(--text3);font-size:10px">... and ${trades.length - 10} more trades</td></tr>`;
  }

  html += '</tbody></table>';
  $('import-preview-table').innerHTML = html;
  $('import-preview').style.display = '';
}

function showImportError(msg) {
  $('import-error-text').textContent = msg;
  $('import-error').style.display = '';
  $('import-submit-btn').disabled = true;
}

// ── Confirm import ──
function confirmImportTrades() {
  const targetAccount = $('import-target-account').value;
  if (!targetAccount) {
    showImportError('Please select a target account');
    return;
  }

  if (_importedTrades.length === 0) {
    showImportError('No trades to import');
    return;
  }

  const skipDuplicates = $('import-skip-duplicates').checked;
  const result = importTradesIntoJournal(_importedTrades, targetAccount, { skipDuplicates: skipDuplicates });
  const importCount = result.importCount;
  const skipCount = result.skipCount;

  saveTradesToStorage();
  // Clear state after successful import
  _importedTrades = [];
  _importFile = null;
  const fileInput = $('import-file-input');
  if (fileInput) fileInput.value = '';
  closeImportModal();

  currentPage = 1;
  renderTrades(TRADES);
  if (typeof populateDashboard === 'function') populateDashboard();
  if (typeof refreshAdvAnalytics === 'function') refreshAdvAnalytics();
  if (typeof syncTradeModalAccountList === 'function') syncTradeModalAccountList();

  let msg = `✓ Imported ${importCount} trade${importCount !== 1 ? 's' : ''}`;
  if (skipCount > 0) msg += ` (${skipCount} duplicates skipped)`;
  showToast(msg, 'success', '✓', 3500);
}

function importTradesIntoJournal(trades, targetAccount, options) {
  const opts = options || {};
  const skipDuplicates = opts.skipDuplicates !== false;
  let importCount = 0;
  let skipCount = 0;

  if (!Array.isArray(trades) || !targetAccount) {
    return { importCount: 0, skipCount: 0 };
  }

  trades.forEach(function(trade) {
    if (!trade) return;

    trade.account = targetAccount;

    if (skipDuplicates) {
      const duplicate = TRADES.some(function(t) {
        return t.date === trade.date &&
          t.symbol === trade.symbol &&
          t.entry === trade.entry &&
          t.exit === trade.exit &&
          (t.account || '') === targetAccount;
      });

      if (duplicate) {
        skipCount++;
        return;
      }
    }

    trade.id = nextTradeId();
    TRADES.push(trade);
    importCount++;
  });

  return { importCount: importCount, skipCount: skipCount };
}

function initBrokerAutoImport() {
  loadBrokerConnections();
  startEnabledBrokerPollers();
  populateBrokerAccountOptions();
  renderBrokerConnections();
}

function loadBrokerConnections() {
  try {
    const raw = localStorage.getItem(_AUTO_IMPORT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    _brokerConnections = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    _brokerConnections = [];
  }
}

function saveBrokerConnections() {
  localStorage.setItem(_AUTO_IMPORT_STORAGE_KEY, JSON.stringify(_brokerConnections));
}

function brokerConnectionId() {
  return 'bc-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
}

function populateBrokerAccountOptions() {
  const sel = $('broker-auto-account');
  if (!sel) return;

  const prev = sel.value;
  sel.innerHTML = '<option value="">Select account to auto-import into...</option>';

  if (Array.isArray(ACCOUNTS)) {
    ACCOUNTS.forEach(function(a) {
      const opt = document.createElement('option');
      opt.value = a.phase || a.key || '';
      opt.textContent = (a.firm || 'Account') + ' - ' + (a.phase || a.key || '');
      sel.appendChild(opt);
    });
  }

  if (prev && Array.from(sel.options).some(function(o) { return o.value === prev; })) {
    sel.value = prev;
  }
}

function brokerClearForm() {
  const name = $('broker-auto-name');
  const provider = $('broker-auto-provider');
  const account = $('broker-auto-account');
  const endpoint = $('broker-auto-endpoint');
  const token = $('broker-auto-token');
  const interval = $('broker-auto-interval');

  if (name) name.value = '';
  if (provider) provider.value = 'custom';
  if (account) account.value = '';
  if (endpoint) endpoint.value = '';
  if (token) token.value = '';
  if (interval) interval.value = '5';
}

function saveBrokerConnectionFromForm() {
  const name = ($('broker-auto-name') && $('broker-auto-name').value || '').trim();
  const provider = $('broker-auto-provider') ? $('broker-auto-provider').value : 'custom';
  const account = $('broker-auto-account') ? $('broker-auto-account').value : '';
  const endpoint = ($('broker-auto-endpoint') && $('broker-auto-endpoint').value || '').trim();
  const token = ($('broker-auto-token') && $('broker-auto-token').value || '').trim();
  const intervalMins = parseInt(($('broker-auto-interval') && $('broker-auto-interval').value) || '5', 10);

  if (!account) {
    showToast('Select a target account for auto-import', 'error', '', 2800);
    return;
  }

  if (!endpoint) {
    showToast('Enter broker endpoint URL', 'error', '', 2800);
    return;
  }

  const conn = {
    id: brokerConnectionId(),
    name: name || provider.toUpperCase() + ' Connection',
    provider: provider,
    account: account,
    endpoint: endpoint,
    token: token,
    intervalMins: Number.isFinite(intervalMins) && intervalMins > 0 ? intervalMins : 5,
    enabled: true,
    createdAt: new Date().toISOString(),
    lastSyncAt: '',
    lastStatus: 'Not synced yet',
    importedTotal: 0
  };

  _brokerConnections.push(conn);
  saveBrokerConnections();
  startBrokerPoller(conn.id, true);
  renderBrokerConnections();
  brokerClearForm();

  showToast('Broker auto-import connected', 'success', '🔗', 2500);
}

function renderBrokerConnections() {
  const wrap = $('broker-auto-list');
  if (!wrap) return;

  if (!_brokerConnections.length) {
    wrap.innerHTML = '<div style="font-size:11px;color:var(--text3);font-family:var(--font-mono);padding:8px 2px">No broker connections yet.</div>';
    return;
  }

  wrap.innerHTML = _brokerConnections.map(function(c) {
    const statusColor = c.enabled ? 'var(--green)' : 'var(--text3)';
    const endpointShort = String(c.endpoint || '').length > 45
      ? String(c.endpoint).slice(0, 42) + '...'
      : String(c.endpoint || '');

    return `
      <div style="border:1px solid var(--border);border-radius:10px;padding:10px;background:var(--bg3);display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:8px;min-width:0">
            <span style="font-size:10px;font-family:var(--font-mono);letter-spacing:.08em;color:var(--purple);text-transform:uppercase">${escapeHtml(c.provider || 'custom')}</span>
            <span style="font-size:12px;color:var(--text);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px">${escapeHtml(c.name || 'Connection')}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <button onclick="runBrokerSyncNow('${c.id}')" style="background:var(--ac-20);border:1px solid var(--ac-40);color:var(--purple);border-radius:7px;padding:4px 9px;font-size:10px;cursor:pointer;font-family:var(--font-mono)">Sync now</button>
            <button onclick="toggleBrokerConnection('${c.id}')" style="background:var(--bg4);border:1px solid var(--border2);color:var(--text2);border-radius:7px;padding:4px 9px;font-size:10px;cursor:pointer;font-family:var(--font-mono)">${c.enabled ? 'Pause' : 'Resume'}</button>
            <button onclick="removeBrokerConnection('${c.id}')" style="background:transparent;border:1px solid rgba(232,80,74,.45);color:var(--red);border-radius:7px;padding:4px 9px;font-size:10px;cursor:pointer;font-family:var(--font-mono)">Remove</button>
          </div>
        </div>
        <div style="font-size:10px;color:var(--text3);font-family:var(--font-mono)">Endpoint: ${escapeHtml(endpointShort)}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <div style="font-size:10px;color:var(--text3);font-family:var(--font-mono)">Account: ${escapeHtml(c.account || '')} · Every ${c.intervalMins || 5} min</div>
          <div style="font-size:10px;color:${statusColor};font-family:var(--font-mono)">${escapeHtml(c.lastStatus || 'Not synced yet')}</div>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(v) {
  return String(v || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function startEnabledBrokerPollers() {
  Object.keys(_brokerPollTimers).forEach(function(id) {
    clearInterval(_brokerPollTimers[id]);
    delete _brokerPollTimers[id];
  });

  _brokerConnections.forEach(function(c) {
    if (c.enabled) startBrokerPoller(c.id, false);
  });
}

function startBrokerPoller(connectionId, runNow) {
  const c = _brokerConnections.find(function(x) { return x.id === connectionId; });
  if (!c || !c.enabled) return;

  if (_brokerPollTimers[connectionId]) {
    clearInterval(_brokerPollTimers[connectionId]);
    delete _brokerPollTimers[connectionId];
  }

  const mins = Math.max(1, parseInt(c.intervalMins || 5, 10));
  _brokerPollTimers[connectionId] = setInterval(function() {
    runBrokerSync(connectionId, false);
  }, mins * 60 * 1000);

  if (runNow) runBrokerSync(connectionId, true);
}

function toggleBrokerConnection(connectionId) {
  const c = _brokerConnections.find(function(x) { return x.id === connectionId; });
  if (!c) return;

  c.enabled = !c.enabled;

  if (!c.enabled && _brokerPollTimers[connectionId]) {
    clearInterval(_brokerPollTimers[connectionId]);
    delete _brokerPollTimers[connectionId];
  }

  if (c.enabled) startBrokerPoller(connectionId, false);
  c.lastStatus = c.enabled ? 'Resumed' : 'Paused';

  saveBrokerConnections();
  renderBrokerConnections();
}

function removeBrokerConnection(connectionId) {
  const idx = _brokerConnections.findIndex(function(x) { return x.id === connectionId; });
  if (idx === -1) return;

  if (_brokerPollTimers[connectionId]) {
    clearInterval(_brokerPollTimers[connectionId]);
    delete _brokerPollTimers[connectionId];
  }

  _brokerConnections.splice(idx, 1);
  saveBrokerConnections();
  renderBrokerConnections();
}

function runBrokerSyncNow(connectionId) {
  runBrokerSync(connectionId, true);
}

async function runBrokerSync(connectionId, manual) {
  const c = _brokerConnections.find(function(x) { return x.id === connectionId; });
  if (!c || c._running) return;

  c._running = true;
  c.lastStatus = 'Syncing...';
  renderBrokerConnections();

  try {
    const rawTrades = await fetchBrokerTrades(c);
    const normalized = normalizeBrokerTrades(rawTrades, c.account, c.provider);
    const result = importTradesIntoJournal(normalized, c.account, { skipDuplicates: true });

    if (result.importCount > 0) {
      saveTradesToStorage();
      if (typeof renderTrades === 'function') renderTrades(TRADES);
      if (typeof populateDashboard === 'function') populateDashboard();
      if (typeof refreshAdvAnalytics === 'function') refreshAdvAnalytics();
      if (typeof syncTradeModalAccountList === 'function') syncTradeModalAccountList();
    }

    c.importedTotal = (c.importedTotal || 0) + result.importCount;
    c.lastSyncAt = new Date().toISOString();
    c.lastStatus = `Imported ${result.importCount}, skipped ${result.skipCount}`;

    if (manual) {
      showToast(`Broker sync complete: ${result.importCount} imported`, 'success', '🔄', 3000);
    }
  } catch (e) {
    c.lastStatus = 'Sync failed: ' + (e && e.message ? e.message : 'Unknown error');
    if (manual) {
      showToast(c.lastStatus, 'error', '', 3200);
    }
  } finally {
    c._running = false;
    saveBrokerConnections();
    renderBrokerConnections();
  }
}

async function fetchBrokerTrades(connection) {
  const headers = { 'Accept': 'application/json' };
  if (connection.token) {
    headers.Authorization = connection.token.startsWith('Bearer ') ? connection.token : ('Bearer ' + connection.token);
  }

  let url = String(connection.endpoint || '').trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('Endpoint must start with http:// or https://');
  }

  // Optional incremental sync hint for proxy endpoints that support `since`.
  if (connection.lastSyncAt) {
    const sep = url.includes('?') ? '&' : '?';
    url += sep + 'since=' + encodeURIComponent(connection.lastSyncAt);
  }

  const res = await fetch(url, {
    method: 'GET',
    headers: headers,
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error('HTTP ' + res.status + ' from broker endpoint');
  }

  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.trades)) return data.trades;
  if (data && Array.isArray(data.data)) return data.data;
  throw new Error('Broker response must be an array or { trades: [] }');
}

function normalizeBrokerTrades(rows, targetAccount, provider) {
  if (!Array.isArray(rows)) return [];

  return rows.map(function(t, idx) {
    const symbol = String(t.symbol || t.Symbol || t.instrument || t.pair || 'UNKNOWN').toUpperCase();
    const dir = normalizeDir(t.direction || t.dir || t.side || t.tradeType || 'long');

    const parsedTs = brokerTimestampToJournalParts(t.closeTime || t.time || t.timestamp || t.closedAt || t.openTime || t.date);
    const fallbackDate = normalizeDate(t.date || t.tradeDate || '');
    const fallbackTime = normalizeTime(t.time || t.tradeTime || '');
    const dtNorm = parsedTs || normalizeImportedDateTime(fallbackDate, fallbackTime || '00:00');

    const entry = parseNumber(t.entry || t.entryPrice || t.open || t.openPrice || t.priceOpen, 0);
    const exit = parseNumber(t.exit || t.exitPrice || t.close || t.closePrice || t.priceClose, 0);
    const pnl = parseNumber(t.pnl || t.profit || t.netProfit || t.realizedPnL || 0, 0);
    const size = parseNumber(t.size || t.volume || t.lots || t.quantity || 1, 1);

    if (!symbol || !dtNorm.date || entry <= 0) return null;

    return {
      id: nextTradeId() + idx,
      date: dtNorm.date,
      time: dtNorm.time || '00:00',
      symbol: symbol,
      type: detectInstrumentType(symbol),
      dir: dir,
      entry: entry,
      exit: exit,
      size: size,
      pnl: pnl,
      comm: parseNumber(t.commission || t.comm || t.fee || 0, 0),
      sl: parseNullableNumber(t.sl || t.stopLoss || t.stoploss || ''),
      tp: parseNullableNumber(t.tp || t.takeProfit || t.takeprofit || ''),
      setup: 'Imported',
      model: String(provider || '').toUpperCase(),
      session: typeof inferSessionFromTradingTime === 'function'
        ? inferSessionFromTradingTime(dtNorm.sessionTime || dtNorm.time || '00:00')
        : '',
      notes: t.notes || t.comment || '',
      rating: 0,
      emotions: [],
      account: targetAccount || ''
    };
  }).filter(function(t) { return !!t; });
}

function brokerTimestampToJournalParts(rawTs) {
  if (rawTs === null || rawTs === undefined || rawTs === '') return null;

  let d;
  if (typeof rawTs === 'number') {
    const ms = rawTs < 1e12 ? rawTs * 1000 : rawTs;
    d = new Date(ms);
  } else {
    d = new Date(String(rawTs));
  }

  if (!d || Number.isNaN(d.getTime())) return null;

  const tz = getJournalTimezone();
  const p = _fmtPartsByTz(d, tz);
  const date = String(p.year).padStart(4, '0') + '-' + String(p.month).padStart(2, '0') + '-' + String(p.day).padStart(2, '0');
  const time = String(p.hour).padStart(2, '0') + ':' + String(p.minute).padStart(2, '0');
  return { date: date, time: time, sessionTime: time };
}

window.addEventListener('DOMContentLoaded', initBrokerAutoImport, { once: true });

function adjustContrastForBackgroundShift() {
  // Optional UI adjustments
}
