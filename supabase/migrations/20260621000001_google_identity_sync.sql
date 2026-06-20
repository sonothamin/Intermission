-- =============================================================================
-- Migration: 20260621000001_google_identity_sync
-- Populate display_name + avatar_url on profiles when a user signs up via
-- Google (or any OAuth provider that sets raw_user_meta_data.full_name /
-- .avatar_url / .name / .picture).
-- =============================================================================

-- Replace handle_new_user to seed Google identity metadata into the profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_display_name TEXT;
  v_avatar_url   TEXT;
BEGIN
  -- Prefer provider metadata stored by Supabase on the auth.users row.
  -- signInWithIdToken / OAuth signups populate these fields automatically.
  v_display_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'name', '')
  );

  v_avatar_url := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'picture', '')
  );

  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id, v_display_name, v_avatar_url)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_settings (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Backfill any existing users whose profile row was created without
-- OAuth identity metadata (e.g. Google users who signed in before this
-- migration ran). Uses the identities table to look up the latest
-- provider payload.
UPDATE public.profiles p
SET
  display_name = COALESCE(
    p.display_name,
    NULLIF(i.identity_data ->> 'full_name', ''),
    NULLIF(i.identity_data ->> 'name', '')
  ),
  avatar_url = COALESCE(
    p.avatar_url,
    NULLIF(i.identity_data ->> 'avatar_url', ''),
    NULLIF(i.identity_data ->> 'picture', '')
  ),
  updated_at = NOW()
FROM auth.users u
LEFT JOIN LATERAL (
  SELECT identity_data
  FROM auth.identities
  WHERE user_id = u.id
    AND provider = 'google'
  ORDER BY created_at DESC
  LIMIT 1
) i ON true
WHERE p.id = u.id
  AND (
    p.display_name IS NULL
    OR p.avatar_url IS NULL
  );
