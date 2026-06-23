-- =============================================================================
-- Migration: 20260623000001_friend_library_rls
-- Allow accepted friends to read each other's library, episode_progress, and
-- watchlist. Without these policies the user-scoped client used by the
-- library edge function (libraryApi.list({ user_id: <friend> })) returns an
-- empty result: the app-level friendship check passes, but RLS filters
-- out every row owned by the friend before the query reaches the wire.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: is_accepted_friend(uidA, uidB)
--
-- SECURITY DEFINER so the helper bypasses the RLS on public.friendships
-- (which only lets participants see rows) and prevents a recursion where
-- the policy on library/episode_progress/watchlist would itself need to
-- SELECT from friendships. Runs as the function owner; search_path is
-- locked to `public` to satisfy Supabase's linter.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_accepted_friend(uid_a UUID, uid_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND (
        (f.user_a_id = uid_a AND f.user_b_id = uid_b)
        OR
        (f.user_a_id = uid_b AND f.user_b_id = uid_a)
      )
  );
$$;

-- Make the helper callable by any RLS-evaluated query (it's invoked from
-- policy expressions, so it runs in the context of the querying role).
GRANT EXECUTE ON FUNCTION public.is_accepted_friend(UUID, UUID) TO authenticated, anon, service_role;

COMMENT ON FUNCTION public.is_accepted_friend(UUID, UUID) IS
  'Returns true when the two given users have an accepted friendship in either direction. SECURITY DEFINER bypasses the friendships RLS so it can be used inside RLS policy expressions without recursion.';

-- ---------------------------------------------------------------------------
-- library: read self OR read an accepted friend
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "library_select_own" ON public.library;
DROP POLICY IF EXISTS "library_select_own_or_friend" ON public.library;
DROP POLICY IF EXISTS "library_select_self_or_friend" ON public.library;
CREATE POLICY "library_select_self_or_friend"
  ON public.library FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_accepted_friend(auth.uid(), user_id)
  );

-- ---------------------------------------------------------------------------
-- episode_progress: read self OR read an accepted friend
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "ep_progress_select_own" ON public.episode_progress;
DROP POLICY IF EXISTS "ep_progress_select_self_or_friend" ON public.episode_progress;
CREATE POLICY "ep_progress_select_self_or_friend"
  ON public.episode_progress FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_accepted_friend(auth.uid(), user_id)
  );

-- ---------------------------------------------------------------------------
-- watchlist: read self OR read an accepted friend
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "watchlist_select_own" ON public.watchlist;
DROP POLICY IF EXISTS "watchlist_select_self_or_friend" ON public.watchlist;
CREATE POLICY "watchlist_select_self_or_friend"
  ON public.watchlist FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_accepted_friend(auth.uid(), user_id)
  );

-- ---------------------------------------------------------------------------
-- profiles: extend SELECT so accepted friends can see private profiles
-- without the app-level override. The profile edge function already handles
-- this with a 403, but the change keeps the data model consistent: any
-- direct Supabase client query (e.g. a future "friends feed" page) will
-- also work.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_public_or_friend" ON public.profiles;
CREATE POLICY "profiles_select_public_or_friend"
  ON public.profiles FOR SELECT
  USING (
    is_public = true
    OR auth.uid() = id
    OR public.is_accepted_friend(auth.uid(), id)
  );
