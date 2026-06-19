-- Change default theme preference for new users to follow system setting
ALTER TABLE public.user_settings ALTER COLUMN theme SET DEFAULT 'system';
