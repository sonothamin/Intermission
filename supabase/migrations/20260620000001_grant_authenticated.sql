-- =============================================================================
-- Grant table privileges to authenticated users
-- RLS policies were defined but base GRANTs were missing, causing
-- "permission denied for table ..." (42501) errors from edge functions.
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT SELECT ON public.media_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.episode_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist TO authenticated;

-- Allow anon to read public profiles and media cache (RLS still applies)
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.media_cache TO anon;
