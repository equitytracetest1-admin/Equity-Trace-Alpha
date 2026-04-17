// ═══════════════════════════════════════════════════════════════
//  supabase.js  —  Drop this file next to your index.html
//  Then add:  <script src="supabase.js"></script>
//  BEFORE all other <script> tags in index.html
// ═══════════════════════════════════════════════════════════════

// ── YOUR SUPABASE CREDENTIALS ──────────────────────────────────
// Replace these two values after you create your project
const SUPABASE_URL  = 'https://gxvuemshiulgwnboyswn.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dnVlbXNoaXVsZ3duYm95c3duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODEwMjIsImV4cCI6MjA5MDU1NzAyMn0.pE-ii1y1e_4stbiSQuTU_JXxJ-YyNIJ3tiE9MKArHCA';
// ──────────────────────────────────────────────────────────────

// ── Load Supabase JS SDK from CDN ──
// (already injected via index.html <script> tag — see setup guide)

let _supabase = null;
let _publicProfileInfraAvailable = true;

function getSupabase() {
  if (!_supabase) {
    if (typeof supabase === 'undefined' || !supabase.createClient) {
      console.error('Supabase SDK not loaded. Check your index.html script tag.');
      return null;
    }
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  }
  return _supabase;
}

function normalizePublicUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24);
}

function isMissingPublicProfileInfra(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  return (
    code === 'PGRST205' ||
    message.includes("could not find the table") ||
    message.includes('public_profiles') && message.includes('schema cache') ||
    message.includes('relation "public.public_profiles" does not exist') ||
    message.includes('function public.get_public_trader_stats')
  );
}

function markPublicProfileInfraUnavailable(error) {
  if (!_publicProfileInfraAvailable) return;
  _publicProfileInfraAvailable = false;
  console.warn('Public profile infra unavailable in Supabase. Falling back to local-only mode.', error);
}


// ═══════════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════════

async function sbSignUp(email, password) {
  const { data, error } = await getSupabase().auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

async function sbSignIn(email, password) {
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function sbResetPassword(email) {
  const redirectTo = window.location.origin + window.location.pathname;
  const { data, error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
  return data;
}

async function sbSignOut() {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}

async function sbGetUser() {
  const { data: { user } } = await getSupabase().auth.getUser();
  return user;
}

// Listen for auth state changes (login / logout / token refresh)
function sbOnAuthChange(callback) {
  return getSupabase().auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null, event);
  });
}

async function sbUpdatePassword(newPassword) {
  const client = getSupabase();

  const { data: userData } = await client.auth.getUser();
  let user = userData?.user;

  if (!user && window.location.hash.includes('type=recovery')) {
    const { data: sessionData, error: sessionError } = await client.auth.getSessionFromUrl({ storeSession: true });
    if (sessionError) throw sessionError;
    const refreshed = await client.auth.getUser();
    user = refreshed.data?.user;
  }

  if (!user) {
    throw new Error('No auth session available. Re-open the password reset link and try again.');
  }

  const { data, error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return data;
}


// ═══════════════════════════════════════════════════════════════
//  PUBLIC PROFILES
// ═══════════════════════════════════════════════════════════════

function dbToPublicProfile(row) {
  return {
    publicUsername: row?.username ?? '',
    bio: row?.bio ?? '',
    isPublic: !!row?.is_public,
  };
}

async function sbLoadOwnPublicProfile() {
  if (!_publicProfileInfraAvailable) return null;
  const user = await sbGetUser();
  if (!user) return null;

  const { data, error } = await getSupabase()
    .from('public_profiles')
    .select('username, bio, is_public')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    if (isMissingPublicProfileInfra(error)) {
      markPublicProfileInfraUnavailable(error);
      return null;
    }
    console.error('sbLoadOwnPublicProfile:', error);
    return null;
  }
  return dbToPublicProfile(data || {});
}

async function sbSavePublicProfile(profile) {
  if (!_publicProfileInfraAvailable) return dbToPublicProfile({
    username: profile?.publicUsername || profile?.handle || '',
    bio: profile?.bio || '',
    is_public: !!profile?.isPublic,
  });

  const user = await sbGetUser();
  if (!user) throw new Error('Not authenticated');

  const username = normalizePublicUsername(profile?.publicUsername || profile?.handle || '');

  // Best effort update only; avoid insert/upsert on profiles to prevent RLS insert violations.
  await getSupabase()
    .from('profiles')
    .update({
      display_name: profile?.name || null,
    })
    .eq('id', user.id);

  const { data, error } = await getSupabase()
    .from('public_profiles')
    .upsert({
      user_id: user.id,
      username: username || null,
      bio: profile?.bio || null,
      is_public: !!profile?.isPublic,
    }, { onConflict: 'user_id' })
    .select('username, bio, is_public')
    .single();

  if (error) {
    if (isMissingPublicProfileInfra(error)) {
      markPublicProfileInfraUnavailable(error);
      return dbToPublicProfile({
        username: profile?.publicUsername || profile?.handle || '',
        bio: profile?.bio || '',
        is_public: !!profile?.isPublic,
      });
    }
    throw error;
  }
  return dbToPublicProfile(data);
}

async function sbGetPublicTraderStats(username) {
  if (!_publicProfileInfraAvailable) return null;
  const normalized = normalizePublicUsername(username);
  if (!normalized) return null;

  const { data, error } = await getSupabase()
    .rpc('get_public_trader_stats', { profile_username: normalized });

  if (error) {
    if (isMissingPublicProfileInfra(error)) {
      markPublicProfileInfraUnavailable(error);
      return null;
    }
    console.error('sbGetPublicTraderStats:', error);
    return null;
  }
  return data || null;
}


// ═══════════════════════════════════════════════════════════════
//  TRADES
// ═══════════════════════════════════════════════════════════════

// Convert DB row → app trade object
function dbToTrade(row) {
  return {
    id:       row.legacy_id ?? row.id,  // keep numeric id for app compat
    _uuid:    row.id,                   // store real UUID for DB ops
    date:     row.date,
    time:     row.time,
    symbol:   row.symbol,
    type:     row.type,
    dir:      row.dir,
    entry:    row.entry,
    exit:     row.exit,
    size:     row.size,
    sl:       row.sl,
    tp:       row.tp,
    comm:     row.comm,
    setup:    row.setup,
    model:    row.model,
    session:  row.session,
    account:  row.account,
    rating:   row.rating,
    notes:    row.notes,
    emotions: row.emotions ?? [],
    pnl:      row.pnl,
  };
}

// Convert app trade object → DB insert/update payload
function tradeToDb(trade, userId) {
  const payload = {
    user_id:   userId,
    legacy_id: typeof trade.id === 'number' ? trade.id : null,
    date:      trade.date,
    time:      trade.time,
    symbol:    trade.symbol,
    type:      trade.type,
    dir:       trade.dir,
    entry:     trade.entry,
    exit:      trade.exit,
    size:      trade.size,
    sl:        trade.sl    ?? null,
    tp:        trade.tp    ?? null,
    comm:      trade.comm  ?? 0,
    setup:     trade.setup ?? null,
    model:     trade.model ?? null,
    session:   trade.session ?? null,
    account:   trade.account ?? null,
    rating:    trade.rating ?? null,
    notes:     trade.notes ?? null,
    emotions:  trade.emotions ?? [],
    pnl:       trade.pnl,
  };
  return payload;
}

async function sbLoadTrades() {
  const user = await sbGetUser();
  if (!user) return [];

  const { data, error } = await getSupabase()
    .from('trades')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) { console.error('sbLoadTrades:', error); return []; }
  return (data || []).map(dbToTrade);
}

async function sbSaveTrade(trade) {
  const user = await sbGetUser();
  if (!user) throw new Error('Not authenticated');

  const payload = tradeToDb(trade, user.id);

  // If trade has a UUID already, update; otherwise insert
  if (trade._uuid) {
    const { data, error } = await getSupabase()
      .from('trades')
      .update(payload)
      .eq('id', trade._uuid)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw error;
    return dbToTrade(data);
  } else {
    const { data, error } = await getSupabase()
      .from('trades')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return dbToTrade(data);
  }
}

async function sbDeleteTrade(trade) {
  const user = await sbGetUser();
  if (!user) throw new Error('Not authenticated');

  const uuid = trade._uuid || trade.id;
  const { error } = await getSupabase()
    .from('trades')
    .delete()
    .eq('id', uuid)
    .eq('user_id', user.id);
  if (error) throw error;
}

async function sbSaveAllTrades(trades) {
  // Bulk upsert — used during initial migration from localStorage
  const user = await sbGetUser();
  if (!user) throw new Error('Not authenticated');

  const payloads = trades.map(t => tradeToDb(t, user.id));

  // Supabase upsert in chunks of 200
  const CHUNK = 200;
  for (let i = 0; i < payloads.length; i += CHUNK) {
    const chunk = payloads.slice(i, i + CHUNK);
    const { error } = await getSupabase()
      .from('trades')
      .upsert(chunk, { onConflict: 'user_id,legacy_id', ignoreDuplicates: false });
    if (error) throw error;
  }
}


// ═══════════════════════════════════════════════════════════════
//  ACCOUNTS
// ═══════════════════════════════════════════════════════════════

function dbToAccount(row) {
  return {
    id:            row.legacy_id ?? 1,
    _uuid:         row.id,
    firm:          row.firm,
    phase:         row.phase,
    key:           row.key,
    balance:       row.balance,
    type:          row.type,
    active:        row.active,
    startBal:      row.start_bal,
    maxDrawdown:   row.max_drawdown,
    dailyLoss:     row.daily_loss,
    profitTarget:  row.profit_target,
    ddType:        row.dd_type,
    challengeType: row.challenge_type,
    currentPhase:  row.current_phase,
  };
}

function accountToDb(acct, userId) {
  return {
    user_id:       userId,
    legacy_id:     typeof acct.id === 'number' ? acct.id : null,
    firm:          acct.firm,
    phase:         acct.phase,
    key:           acct.key ?? acct.phase,
    balance:       acct.balance ?? null,
    type:          acct.type ?? 'DEMO',
    active:        acct.active ?? true,
    start_bal:     acct.startBal ?? 0,
    max_drawdown:  acct.maxDrawdown ?? 8,
    daily_loss:    acct.dailyLoss ?? 4,
    profit_target: acct.profitTarget ?? null,
    dd_type:       acct.ddType ?? 'trailing',
    challenge_type: acct.challengeType ?? null,
    current_phase: acct.currentPhase ?? null,
  };
}

async function sbLoadAccounts() {
  const user = await sbGetUser();
  if (!user) return [];

  const { data, error } = await getSupabase()
    .from('accounts')
    .select('*')
    .eq('user_id', user.id)
    .order('legacy_id', { ascending: true });

  if (error) { console.error('sbLoadAccounts:', error); return []; }
  return (data || []).map(dbToAccount);
}

async function sbSaveAccount(acct) {
  const user = await sbGetUser();
  if (!user) throw new Error('Not authenticated');

  const payload = accountToDb(acct, user.id);

  if (acct._uuid) {
    const { data, error } = await getSupabase()
      .from('accounts')
      .update(payload)
      .eq('id', acct._uuid)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw error;
    return dbToAccount(data);
  } else {
    const { data, error } = await getSupabase()
      .from('accounts')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return dbToAccount(data);
  }
}

async function sbDeleteAccount(acct) {
  const user = await sbGetUser();
  if (!user) throw new Error('Not authenticated');

  const uuid = acct._uuid;
  if (!uuid) return;
  const { error } = await getSupabase()
    .from('accounts')
    .delete()
    .eq('id', uuid)
    .eq('user_id', user.id);
  if (error) throw error;
}

async function sbSaveAllAccounts(accounts) {
  const user = await sbGetUser();
  if (!user) throw new Error('Not authenticated');

  const payloads = accounts.map(a => accountToDb(a, user.id));
  const { error } = await getSupabase()
    .from('accounts')
    .upsert(payloads, { onConflict: 'user_id,legacy_id', ignoreDuplicates: false });
  if (error) throw error;
}


// ═══════════════════════════════════════════════════════════════
//  PLAYBOOKS
// ═══════════════════════════════════════════════════════════════

function dbToPlaybook(row) {
  return {
    _uuid:   row.id,
    name:    row.name,
    emoji:   row.emoji,
    avgR:    row.avg_r,
    desc:    row.description,
    images:  [],  // playbook images not stored in DB — kept in trade_images
  };
}

async function sbLoadPlaybooks() {
  const user = await sbGetUser();
  if (!user) return null;  // null means "use localStorage fallback"

  const { data, error } = await getSupabase()
    .from('playbooks')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true });

  if (error) { console.error('sbLoadPlaybooks:', error); return null; }
  if (!data || data.length === 0) return null;
  return data.map(dbToPlaybook);
}

async function sbSavePlaybooks(playbooks) {
  const user = await sbGetUser();
  if (!user) throw new Error('Not authenticated');

  // Delete all existing, re-insert (simplest for small arrays)
  await getSupabase().from('playbooks').delete().eq('user_id', user.id);

  if (playbooks.length === 0) return;

  const payloads = playbooks.map((p, i) => ({
    user_id:     user.id,
    name:        p.name,
    emoji:       p.emoji ?? '📈',
    avg_r:       p.avgR ?? '',
    description: p.desc ?? '',
    sort_order:  i,
  }));

  const { error } = await getSupabase().from('playbooks').insert(payloads);
  if (error) throw error;
}


// ═══════════════════════════════════════════════════════════════
//  TRADE IMAGES
// ═══════════════════════════════════════════════════════════════

async function sbLoadTradeImages(tradeUuid) {
  const user = await sbGetUser();
  if (!user) return [];

  const { data, error } = await getSupabase()
    .from('trade_images')
    .select('*')
    .eq('trade_id', tradeUuid)
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true });

  if (error) { console.error('sbLoadTradeImages:', error); return []; }
  return (data || []).map(row => ({
    id:    row.id,
    label: row.label ?? '',
    data:  row.data,
  }));
}

async function sbSaveTradeImages(tradeUuid, images) {
  const user = await sbGetUser();
  if (!user) throw new Error('Not authenticated');

  // Delete existing images for this trade, then re-insert
  await getSupabase()
    .from('trade_images')
    .delete()
    .eq('trade_id', tradeUuid)
    .eq('user_id', user.id);

  if (!images || images.length === 0) return;

  const payloads = images.map((img, i) => ({
    user_id:    user.id,
    trade_id:   tradeUuid,
    label:      img.label ?? '',
    data:       img.data,
    sort_order: i,
  }));

  const { error } = await getSupabase().from('trade_images').insert(payloads);
  if (error) throw error;
}


// ═══════════════════════════════════════════════════════════════
//  USER SETTINGS  (theme, filter state, hidden accounts, etc.)
// ═══════════════════════════════════════════════════════════════

async function sbGetSetting(key) {
  const user = await sbGetUser();
  if (!user) return null;

  const { data, error } = await getSupabase()
    .from('user_settings')
    .select('value')
    .eq('user_id', user.id)
    .eq('key', key)
    .maybeSingle();

  if (error) { console.error('sbGetSetting:', error); return null; }
  return data?.value ?? null;
}

async function sbSetSetting(key, value) {
  const user = await sbGetUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await getSupabase()
    .from('user_settings')
    .upsert({ user_id: user.id, key, value }, { onConflict: 'user_id,key' });

  if (error) throw error;
}


// ═══════════════════════════════════════════════════════════════
//  ONE-TIME MIGRATION  —  localStorage → Supabase
//  Called once when user first signs in
// ═══════════════════════════════════════════════════════════════

async function migrateLocalStorageToSupabase() {
  const migrationKey = 'et_sb_migrated';
  if (localStorage.getItem(migrationKey)) return;  // already done

  console.log('🔄 Migrating localStorage data to Supabase...');
  const errors = [];

  try {
    // 1. Accounts
    const rawAccounts = localStorage.getItem('equityTraceAccounts');
    if (rawAccounts) {
      const accounts = JSON.parse(rawAccounts);
      if (accounts.length > 0) {
        await sbSaveAllAccounts(accounts);
        console.log(`  ✓ Migrated ${accounts.length} accounts`);
      }
    }
  } catch(e) { errors.push('accounts: ' + e.message); }

  try {
    // 2. Trades
    const rawTrades = localStorage.getItem('tradingJournalTrades');
    if (rawTrades) {
      const trades = JSON.parse(rawTrades);
      if (trades.length > 0) {
        await sbSaveAllTrades(trades);
        console.log(`  ✓ Migrated ${trades.length} trades`);
      }
    }
  } catch(e) { errors.push('trades: ' + e.message); }

  try {
    // 3. Playbooks
    const rawPb = localStorage.getItem('eq_playbooks');
    if (rawPb) {
      const pb = JSON.parse(rawPb);
      await sbSavePlaybooks(pb);
      console.log(`  ✓ Migrated ${pb.length} playbooks`);
    }
  } catch(e) { errors.push('playbooks: ' + e.message); }

  try {
    // 4. Settings
    const settingsKeys = ['et-theme', 'et-filter-state', 'hiddenAccountIds', 'et-acct-labels'];
    for (const key of settingsKeys) {
      const val = localStorage.getItem(key);
      if (val !== null) {
        try {
          await sbSetSetting(key, JSON.parse(val));
        } catch {
          await sbSetSetting(key, val);
        }
      }
    }
    console.log('  ✓ Migrated settings');
  } catch(e) { errors.push('settings: ' + e.message); }

  try {
    const rawProfile = localStorage.getItem('et-user-profile');
    if (rawProfile) {
      const profile = JSON.parse(rawProfile);
      await sbSavePublicProfile({
        name: profile.name || '',
        handle: profile.handle || '',
        publicUsername: profile.publicUsername || profile.handle || '',
        bio: profile.bio || '',
        isPublic: !!profile.isPublic,
      });
      console.log('  ✓ Migrated public profile');
    }
  } catch(e) { errors.push('public profile: ' + e.message); }
  if (errors.length > 0) {
    console.warn('Migration completed with errors:', errors);
  } else {
    localStorage.setItem(migrationKey, '1');
    console.log('✅ Migration complete — all data synced to Supabase');
  }
}


// ═══════════════════════════════════════════════════════════════
//  CONVENIENCE: expose on window so app.js can call directly
// ═══════════════════════════════════════════════════════════════
window.SB = {
  // auth
  signUp:    sbSignUp,
  signIn:    sbSignIn,
  resetPassword: sbResetPassword,
  updatePassword: sbUpdatePassword,
  signOut:   sbSignOut,
  getUser:   sbGetUser,
  onAuthChange: sbOnAuthChange,
  // trades
  loadTrades:    sbLoadTrades,
  saveTrade:     sbSaveTrade,
  deleteTrade:   sbDeleteTrade,
  saveAllTrades: sbSaveAllTrades,
  // accounts
  loadAccounts:    sbLoadAccounts,
  saveAccount:     sbSaveAccount,
  deleteAccount:   sbDeleteAccount,
  saveAllAccounts: sbSaveAllAccounts,
  // playbooks
  loadPlaybooks: sbLoadPlaybooks,
  savePlaybooks: sbSavePlaybooks,
  // images
  loadTradeImages: sbLoadTradeImages,
  saveTradeImages: sbSaveTradeImages,
  // public profiles
  loadOwnPublicProfile: sbLoadOwnPublicProfile,
  savePublicProfile: sbSavePublicProfile,
  getPublicTraderStats: sbGetPublicTraderStats,
  // settings
  getSetting: sbGetSetting,
  setSetting: sbSetSetting,
  // migration
  migrateFromLocalStorage: migrateLocalStorageToSupabase,
};

console.log('✓ supabase.js loaded');
