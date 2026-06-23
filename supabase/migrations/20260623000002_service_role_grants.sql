-- =============================================================================
-- Migration: 20260623000002_service_role_grants
-- Add service_role grants for edge functions to access friendships table
-- =============================================================================

-- Service role needs SELECT access to query friendships for profile lookup
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO service_role;

-- Service role needs to execute friendship helper functions
GRANT EXECUTE ON FUNCTION public.are_friends(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_pending_request(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_accepted_friend(UUID, UUID) TO service_role;
