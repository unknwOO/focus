export const YOUTUBE_WATCHED_VIDEOS_MODES = ["SHOW", "DIM", "HIDE"] as const;

export type YouTubeWatchedVideosMode = (typeof YOUTUBE_WATCHED_VIDEOS_MODES)[number];

export const YOUTUBE_WATCHED_VIDEOS_CAPTIONS: Readonly<Record<YouTubeWatchedVideosMode, string>> = {
  SHOW: "Watched videos look like any other video.",
  DIM: "Watched videos fade out.",
  HIDE: "Watched videos are removed from your feed.",
};

export const isYouTubeWatchedVideosMode = (value: unknown): value is YouTubeWatchedVideosMode =>
  YOUTUBE_WATCHED_VIDEOS_MODES.includes(value as YouTubeWatchedVideosMode);

export const normalizeYouTubeWatchedVideosMode = (value: unknown): YouTubeWatchedVideosMode =>
  isYouTubeWatchedVideosMode(value) ? value : "SHOW";
