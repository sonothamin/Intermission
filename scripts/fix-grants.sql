#!/usr/bin/env bash
# Apply missing table grants to fix "permission denied for table library" (500 errors).
# Run from project root after linking: npx supabase db query --linked -f scripts/fix-grants.sql
# Or paste this file into Supabase Dashboard → SQL Editor → Run.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT SELECT ON public.media_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.episode_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.media_cache TO anon;
