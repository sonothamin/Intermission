-- =============================================================================
-- Intermission Database Schema
-- Migration: 20260619000001_initial_schema
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for full-text search on cache

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE media_type AS ENUM ('movie', 'tv');

CREATE TYPE watch_status AS ENUM (
  'watching',      -- currently watching
  'completed',     -- finished
  'on_hold',       -- paused
  'dropped',       -- abandoned
  'plan_to_watch', -- in watchlist (mirror)
  'rewatching'     -- watching again
);

CREATE TYPE content_rating AS ENUM (
  'G', 'PG', 'PG-13', 'R', 'NC-17', 'NR', 'TV-Y', 'TV-Y7',
  'TV-G', 'TV-PG', 'TV-14', 'TV-MA', 'UNRATED'
);

-- =============================================================================
-- TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles: Extended user data beyond auth.users
-- -----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username        TEXT        UNIQUE,
  display_name    TEXT,
  bio             TEXT        CHECK (char_length(bio) <= 500),
  avatar_url      TEXT,
  banner_url      TEXT,
  website         TEXT,
  location        TEXT        CHECK (char_length(location) <= 100),
  is_public       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT username_format CHECK (
    username IS NULL OR (
      char_length(username) BETWEEN 3 AND 30
      AND username ~ '^[a-zA-Z0-9_]+$'
    )
  )
);

COMMENT ON TABLE public.profiles IS 'Extended user profile data';

-- -----------------------------------------------------------------------------
-- user_settings: Per-user preferences and configuration
-- -----------------------------------------------------------------------------
CREATE TABLE public.user_settings (
  id                    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_language    TEXT        NOT NULL DEFAULT 'en',
  preferred_region      TEXT        NOT NULL DEFAULT 'US',
  theme                 TEXT        NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light', 'system')),
  adult_content         BOOLEAN     NOT NULL DEFAULT false,
  auto_mark_watched     BOOLEAN     NOT NULL DEFAULT false, -- mark movie watched on add
  show_spoilers         BOOLEAN     NOT NULL DEFAULT false,
  default_list_view     TEXT        NOT NULL DEFAULT 'grid' CHECK (default_list_view IN ('grid', 'list', 'compact')),
  notifications_enabled BOOLEAN     NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.user_settings IS 'Per-user application preferences';

-- -----------------------------------------------------------------------------
-- media_cache: TMDB API response cache (reduces API calls, improves latency)
-- -----------------------------------------------------------------------------
CREATE TABLE public.media_cache (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  cache_key       TEXT        NOT NULL UNIQUE, -- e.g. "movie:123", "tv:456", "search:action:1"
  data            JSONB       NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_cache_key ON public.media_cache(cache_key);
CREATE INDEX idx_media_cache_expires ON public.media_cache(expires_at);

COMMENT ON TABLE public.media_cache IS 'TMDB API response cache, 24h TTL';

-- -----------------------------------------------------------------------------
-- library: Core media tracking records
-- -----------------------------------------------------------------------------
CREATE TABLE public.library (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Media identification
  tmdb_id         INTEGER     NOT NULL,
  media_type      media_type  NOT NULL,

  -- Cached metadata snapshot (denormalized for performance)
  title           TEXT        NOT NULL,
  poster_url      TEXT,
  backdrop_url    TEXT,
  release_year    INTEGER,
  genres          TEXT[]      DEFAULT '{}',
  origin_country  TEXT[]      DEFAULT '{}',
  original_language TEXT,
  runtime_minutes INTEGER,    -- movie runtime or avg episode runtime
  content_rating  content_rating,

  -- Tracking data
  status          watch_status NOT NULL DEFAULT 'watching',
  rating          NUMERIC(3,1) CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
  notes           TEXT         CHECK (char_length(notes) <= 2000),
  times_watched   INTEGER      NOT NULL DEFAULT 0 CHECK (times_watched >= 0),

  -- TV-specific progress
  current_season  INTEGER,
  current_episode INTEGER,
  total_seasons   INTEGER,
  total_episodes  INTEGER,
  episodes_watched INTEGER     NOT NULL DEFAULT 0,

  -- Timestamps
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Each user can have one entry per media item
  UNIQUE(user_id, tmdb_id, media_type)
);

CREATE INDEX idx_library_user_id ON public.library(user_id);
CREATE INDEX idx_library_user_status ON public.library(user_id, status);
CREATE INDEX idx_library_user_type ON public.library(user_id, media_type);
CREATE INDEX idx_library_user_rating ON public.library(user_id, rating DESC NULLS LAST);
CREATE INDEX idx_library_updated ON public.library(user_id, updated_at DESC);

COMMENT ON TABLE public.library IS 'Core media tracking records — one row per user per media item';

-- -----------------------------------------------------------------------------
-- episode_progress: Episode-level tracking for TV series
-- -----------------------------------------------------------------------------
CREATE TABLE public.episode_progress (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  library_id      UUID        NOT NULL REFERENCES public.library(id) ON DELETE CASCADE,
  tmdb_show_id    INTEGER     NOT NULL,
  season_number   INTEGER     NOT NULL CHECK (season_number >= 0),
  episode_number  INTEGER     NOT NULL CHECK (episode_number >= 1),

  -- Episode metadata snapshot
  episode_title   TEXT,
  air_date        DATE,
  runtime_minutes INTEGER,

  -- Tracking
  watched         BOOLEAN     NOT NULL DEFAULT false,
  watched_at      TIMESTAMPTZ,
  rating          NUMERIC(3,1) CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
  notes           TEXT         CHECK (char_length(notes) <= 500),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, tmdb_show_id, season_number, episode_number)
);

CREATE INDEX idx_ep_progress_user ON public.episode_progress(user_id);
CREATE INDEX idx_ep_progress_library ON public.episode_progress(library_id);
CREATE INDEX idx_ep_progress_show ON public.episode_progress(user_id, tmdb_show_id);
CREATE INDEX idx_ep_progress_watched ON public.episode_progress(user_id, watched, watched_at DESC);

COMMENT ON TABLE public.episode_progress IS 'Episode-level tracking for TV series';

-- -----------------------------------------------------------------------------
-- watchlist: Want-to-watch queue
-- -----------------------------------------------------------------------------
CREATE TABLE public.watchlist (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tmdb_id         INTEGER     NOT NULL,
  media_type      media_type  NOT NULL,

  -- Metadata snapshot
  title           TEXT        NOT NULL,
  poster_url      TEXT,
  release_year    INTEGER,
  genres          TEXT[]      DEFAULT '{}',
  original_language TEXT,
  content_rating  content_rating,

  -- Queue management
  priority        INTEGER     NOT NULL DEFAULT 0, -- higher = more important
  notes           TEXT         CHECK (char_length(notes) <= 500),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, tmdb_id, media_type)
);

CREATE INDEX idx_watchlist_user ON public.watchlist(user_id);
CREATE INDEX idx_watchlist_priority ON public.watchlist(user_id, priority DESC, created_at DESC);

COMMENT ON TABLE public.watchlist IS 'User want-to-watch queue';

-- =============================================================================
-- FUNCTIONS & TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_media_cache_updated_at
  BEFORE UPDATE ON public.media_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_library_updated_at
  BEFORE UPDATE ON public.library
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_episode_progress_updated_at
  BEFORE UPDATE ON public.episode_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_watchlist_updated_at
  BEFORE UPDATE ON public.watchlist
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile and settings when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_settings (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-expire media cache cleanup function (call periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.media_cache WHERE expires_at < NOW();
END;
$$;

-- =============================================================================
-- ANALYTICS VIEW
-- =============================================================================

CREATE OR REPLACE VIEW public.user_watch_stats AS
SELECT
  l.user_id,
  COUNT(*) FILTER (WHERE l.media_type = 'movie' AND l.status = 'completed') AS movies_watched,
  COUNT(*) FILTER (WHERE l.media_type = 'tv') AS series_tracked,
  COUNT(*) FILTER (WHERE l.media_type = 'tv' AND l.status = 'completed') AS series_completed,
  COUNT(*) FILTER (WHERE l.media_type = 'tv' AND l.status = 'watching') AS series_watching,
  COUNT(*) FILTER (WHERE l.media_type = 'tv' AND l.status = 'dropped') AS series_dropped,
  COALESCE(SUM(
    CASE
      WHEN l.media_type = 'movie' AND l.status = 'completed'
        THEN COALESCE(l.runtime_minutes, 0) * GREATEST(l.times_watched, 1)
      WHEN l.media_type = 'tv'
        THEN COALESCE(l.episodes_watched, 0) * COALESCE(l.runtime_minutes, 30)
      ELSE 0
    END
  ) / 60.0, 0) AS total_hours_watched,
  COALESCE(AVG(l.rating) FILTER (WHERE l.rating IS NOT NULL), 0) AS avg_rating,
  COUNT(*) FILTER (WHERE l.created_at > NOW() - INTERVAL '30 days') AS added_last_30_days
FROM public.library l
GROUP BY l.user_id;

COMMENT ON VIEW public.user_watch_stats IS 'Aggregated watch statistics per user';

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all user tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episode_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

-- profiles policies
CREATE POLICY "profiles_select_public"
  ON public.profiles FOR SELECT
  USING (is_public = true OR auth.uid() = id);

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete_own"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- user_settings policies (strictly private)
CREATE POLICY "settings_select_own"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "settings_insert_own"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "settings_update_own"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- media_cache policies (public read, service role writes only)
CREATE POLICY "cache_select_all"
  ON public.media_cache FOR SELECT
  USING (true);

CREATE POLICY "cache_insert_service"
  ON public.media_cache FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "cache_update_service"
  ON public.media_cache FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "cache_delete_service"
  ON public.media_cache FOR DELETE
  USING (auth.role() = 'service_role');

-- library policies
CREATE POLICY "library_select_own"
  ON public.library FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "library_insert_own"
  ON public.library FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "library_update_own"
  ON public.library FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "library_delete_own"
  ON public.library FOR DELETE
  USING (auth.uid() = user_id);

-- episode_progress policies
CREATE POLICY "ep_progress_select_own"
  ON public.episode_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "ep_progress_insert_own"
  ON public.episode_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ep_progress_update_own"
  ON public.episode_progress FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ep_progress_delete_own"
  ON public.episode_progress FOR DELETE
  USING (auth.uid() = user_id);

-- watchlist policies
CREATE POLICY "watchlist_select_own"
  ON public.watchlist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "watchlist_insert_own"
  ON public.watchlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "watchlist_update_own"
  ON public.watchlist FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "watchlist_delete_own"
  ON public.watchlist FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- STORAGE BUCKETS
-- =============================================================================

-- Avatar uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS for avatars bucket
CREATE POLICY "avatars_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- =============================================================================
-- GRANTS
-- =============================================================================

-- Authenticated users can use the view and all user-facing tables
GRANT SELECT ON public.user_watch_stats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT SELECT ON public.media_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.episode_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.media_cache TO anon;

-- Service role can do everything
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
