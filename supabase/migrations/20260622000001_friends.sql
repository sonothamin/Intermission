-- =============================================================================
-- Friendships between users.
-- A single row per undirected pair (a < b). The requester is tracked so the
-- recipient knows who to thank / accept.
-- =============================================================================

CREATE TYPE friend_status AS ENUM ('pending', 'accepted', 'declined', 'blocked');

CREATE TABLE public.friendships (
  id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Normalized so user_a_id < user_b_id — guarantees one row per undirected
  -- pair and makes "list my friends" a single index range scan.
  user_a_id       UUID            NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id       UUID            NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  status          friend_status   NOT NULL DEFAULT 'pending',
  requested_by    UUID            NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  responded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT friendships_pair_order CHECK (user_a_id < user_b_id),
  CONSTRAINT friendships_no_self CHECK (user_a_id <> user_b_id),
  CONSTRAINT friendships_unique UNIQUE (user_a_id, user_b_id)
);

CREATE INDEX idx_friendships_a ON public.friendships(user_a_id, status);
CREATE INDEX idx_friendships_b ON public.friendships(user_b_id, status);
CREATE INDEX idx_friendships_pending_b ON public.friendships(user_b_id) WHERE status = 'pending';
CREATE INDEX idx_friendships_pending_a ON public.friendships(user_a_id) WHERE status = 'pending';

-- Reuse the existing updated_at trigger function.
CREATE TRIGGER trg_friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE public.friendships IS 'Undirected friend relationships; one row per user pair';

-- =============================================================================
-- Helper: are these two users friends (accepted)?
-- Used by RLS policies and edge functions.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.are_friends(uid_a UUID, uid_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND (
        (f.user_a_id = uid_a AND f.user_b_id = uid_b)
        OR (f.user_a_id = uid_b AND f.user_b_id = uid_a)
      )
  );
$$;

-- =============================================================================
-- Helper: is there a pending friend request from `from_uid` to `to_uid`?
-- =============================================================================
CREATE OR REPLACE FUNCTION public.has_pending_request(from_uid UUID, to_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'pending'
      AND f.requested_by = from_uid
      AND (
        (f.user_a_id = from_uid AND f.user_b_id = to_uid)
        OR (f.user_a_id = to_uid AND f.user_b_id = from_uid)
      )
  );
$$;

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- A user can see friendships they are part of.
CREATE POLICY "friendships_select_participant"
  ON public.friendships FOR SELECT
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- A user can create a friendship only as the requester, and only with a
-- different user. The CHECK on the row enforces pair ordering + self-pair
-- ban; the trigger at the application layer keeps user_a_id < user_b_id.
CREATE POLICY "friendships_insert_requester"
  ON public.friendships FOR INSERT
  WITH CHECK (
    auth.uid() = requested_by
    AND (auth.uid() = user_a_id OR auth.uid() = user_b_id)
  );

-- Updates are limited to participants. Status transitions are enforced by
-- the edge function (only the recipient can accept/decline; either side can
-- cancel a pending request or unfriend).
CREATE POLICY "friendships_update_participant"
  ON public.friendships FOR UPDATE
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id)
  WITH CHECK (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- Either participant may delete (unfriend / cancel request).
CREATE POLICY "friendships_delete_participant"
  ON public.friendships FOR DELETE
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- =============================================================================
-- Grants
-- =============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO service_role;
GRANT EXECUTE ON FUNCTION public.are_friends(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_pending_request(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_friends(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_pending_request(UUID, UUID) TO service_role;

-- =============================================================================
-- Library visibility for accepted friends
-- Update existing policy to also allow accepted friends to read.
-- =============================================================================
DROP POLICY IF EXISTS "library_select_own" ON public.library;

CREATE POLICY "library_select_own_or_friend"
  ON public.library FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.are_friends(auth.uid(), user_id)
  );

-- =============================================================================
-- Profile visibility for accepted friends
-- Accepted friends can view a profile even when is_public = false, but only
-- the basic columns; settings stay private.
-- =============================================================================
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;

CREATE POLICY "profiles_select_public_or_friend"
  ON public.profiles FOR SELECT
  USING (
    is_public = true
    OR auth.uid() = id
    OR public.are_friends(auth.uid(), id)
  );
