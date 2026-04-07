# Equity Trace — Supabase Backend Setup Guide

## What you get
- All trades, accounts, playbooks, and settings saved to the cloud
- Sync across any device / browser
- Free on Supabase (500 MB, unlimited API calls)
- Login modal with email/password auth
- One-time automatic migration of your existing localStorage data

---

## Files in this folder

| File | What it does |
|------|-------------|
| `supabase_schema.sql` | Creates all DB tables + security rules |
| `supabase.js` | Backend API layer (drop next to index.html) |
| `auth-modal.html` | Login/signup UI (paste into index.html) |
| `SETUP_GUIDE.md` | This file |

---

## Step 1 — Create a free Supabase project

1. Go to **https://supabase.com** → click **Start your project**
2. Sign up with GitHub or email
3. Click **New project**
4. Fill in:
   - **Name**: `equity-trace` (or anything)
   - **Database password**: choose a strong password, save it somewhere
   - **Region**: pick the one closest to you
5. Click **Create new project** — wait ~2 minutes for it to spin up

---

## Step 2 — Run the database schema

1. In your Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open `supabase_schema.sql` from this folder
4. Copy the entire contents and paste it into the SQL editor
5. Click **Run** (or press Ctrl+Enter)
6. You should see: *"Success. No rows returned"*

This creates these tables:
- `profiles` — one row per user
- `accounts` — prop firm accounts
- `trades` — all your trades
- `trade_images` — chart screenshots
- `playbooks` — entry models
- `user_settings` — theme, filters, etc.

---

## Step 3 — Get your API credentials

1. In Supabase dashboard → **Project Settings** (gear icon, bottom-left)
2. Click **API** in the left menu
3. Copy two values:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public** key — long string starting with `eyJ...`

---

## Step 4 — Add your credentials to supabase.js

Open `supabase.js` and replace the two placeholder values at the top:

```javascript
const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';  // ← replace
const SUPABASE_ANON = 'YOUR_ANON_PUBLIC_KEY';                  // ← replace
```

Example:
```javascript
const SUPABASE_URL  = 'https://xyzabcde.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

---

## Step 5 — Add files to your project folder

Copy these two files into your project folder (same folder as index.html):
- `supabase.js`
- (auth-modal.html content goes into index.html — see Step 6)

Your folder should look like:
```
your-project/
  index.html
  app.js
  styles.css
  calendar.js
  account.js
  reports.js
  settings.js
  images.js
  templates.js
  supabase.js          ← NEW
```

---

## Step 6 — Edit index.html (3 changes)

Open `index.html` in VS Code. Make these 3 changes:

### Change 1 — Add Supabase SDK (in the `<head>`)

Find your `<head>` section and add this line **before any other `<script>` tags**:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

### Change 2 — Add supabase.js (in the `<head>` or after the SDK)

Right after the Supabase SDK line, add:

```html
<script src="supabase.js"></script>
```

So your head script block looks like:
```html
<head>
  ...
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="supabase.js"></script>
  <!-- your existing scripts below -->
  <script src="app.js"></script>
  ...
</head>
```

### Change 3 — Paste auth modal (just before `</body>`)

1. Open `auth-modal.html` from this folder
2. Copy the entire contents
3. In `index.html`, find the closing `</body>` tag (very last lines)
4. Paste the auth modal content just before it:

```html
  ...rest of your html...

  <!-- PASTE auth-modal.html CONTENT HERE -->

</body>
</html>
```

---

## Step 7 — Hook up save functions (connect app.js writes to Supabase)

These are the 4 functions in `app.js` that write data. You need to add a Supabase call alongside each one. Open `app.js` in VS Code and apply these small edits:

### 7a — saveTradesToStorage (around line 162)

Find:
```javascript
function saveTradesToStorage() {
  try {
    localStorage.setItem('tradingJournalTrades', JSON.stringify(TRADES));
    hideStorageWarning();
  } catch(e) {
    showStorageWarning();
  }
}
```

Replace with:
```javascript
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
```

### 7b — saveAccounts (around line 617)

Find:
```javascript
function saveAccounts() {
  try { localStorage.setItem('equityTraceAccounts', JSON.stringify(ACCOUNTS)); } catch(e) {}
}
```

Replace with:
```javascript
function saveAccounts() {
  try { localStorage.setItem('equityTraceAccounts', JSON.stringify(ACCOUNTS)); } catch(e) {}
  // Sync to Supabase if signed in
  if (window.SB) {
    window.SB.getUser().then(user => {
      if (user) window.SB.saveAllAccounts(ACCOUNTS).catch(e => console.warn('SB sync accounts:', e));
    });
  }
}
```

### 7c — setPbList (around line 711)

Find:
```javascript
function setPbList(arr) { localStorage.setItem('eq_playbooks', JSON.stringify(arr)); }
```

Replace with:
```javascript
function setPbList(arr) {
  localStorage.setItem('eq_playbooks', JSON.stringify(arr));
  // Sync to Supabase if signed in
  if (window.SB) {
    window.SB.getUser().then(user => {
      if (user) window.SB.savePlaybooks(arr).catch(e => console.warn('SB sync playbooks:', e));
    });
  }
}
```

### 7d — saveTradeImages (in images.js, around line 23)

Find:
```javascript
function saveTradeImages(tradeId, imgs) {
  try {
    const all = JSON.parse(localStorage.getItem(TRADE_IMGS_KEY) || '{}');
    if (imgs.length === 0) delete all[String(tradeId)];
    else all[String(tradeId)] = imgs;
    localStorage.setItem(TRADE_IMGS_KEY, JSON.stringify(all));
    return true;
  } catch(e) {
    showToast('Storage full — image too large or too many images', 'error', '', 3000);
    return false;
  }
}
```

Replace with:
```javascript
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
    showToast('Storage full — image too large or too many images', 'error', '', 3000);
    return false;
  }
}
```

---

## Step 8 — Test it

1. Open VS Code terminal in your project folder
2. Run your dev server (e.g. `npx live-server` or the VS Code Live Server extension)
3. Open the app in your browser
4. You should see the **sign-in modal**
5. Click **Create Account**, enter your email + password → Submit
6. Check your email for a confirmation link → click it
7. Sign in — you'll see your data migrate automatically
8. Open a second browser or incognito window → sign in again → your trades appear!

---

## Troubleshooting

### "Supabase SDK not loaded"
- Make sure the CDN script tag is in `<head>` and loads BEFORE `supabase.js`
- Check browser console for network errors (ad blockers can block CDN)

### "Not authenticated" errors
- Make sure you confirmed your email after sign-up
- Try signing out and back in

### Auth modal doesn't appear
- Check that you pasted `auth-modal.html` content just before `</body>`
- Check browser console for JavaScript errors

### Trades not syncing
- Open browser DevTools → Console → look for "SB sync" warnings
- Check Supabase Dashboard → Table Editor → trades to see if rows exist

### "duplicate key" errors during migration  
- This is fine — it means data was already migrated. No action needed.

---

## Security notes

- The `anon` key is safe to expose in client-side code — Supabase Row Level Security ensures users can only read/write their own data
- Never expose your **service_role** key in the frontend
- Passwords are handled entirely by Supabase Auth — never touch your DB directly

---

## Free tier limits (plenty for personal use)

| Resource | Free limit |
|----------|-----------|
| Database size | 500 MB |
| API requests | Unlimited |
| Auth users | 50,000 |
| Storage | 1 GB |
| Project pauses after | 1 week of inactivity (just click "Restore") |
