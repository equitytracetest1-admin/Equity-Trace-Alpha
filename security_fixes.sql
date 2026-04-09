-- ═══════════════════════════════════════════════════════════════
--  EQUITY TRACE — Security Advisor Fixes
--  Run this in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

-- ── Fix 1: handle_new_user — add SET search_path ──────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public          -- ← this line fixes the warning
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- ── Fix 2: touch_updated_at — add SET search_path ────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public          -- ← this line fixes the warning
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

-- ── After running this SQL, fix Warning 3 in the dashboard: ──
-- Go to: Authentication → Security → "Enable leaked password protection" → toggle ON
