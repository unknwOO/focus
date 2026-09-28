export const YOUTUBE_DISTRACTIONS_PAUSE_DURATION = 15 * 60 * 1000;

export const normalizeYouTubeDistractionsPausedUntil = (value: unknown) => (
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0
);

export const areYouTubeDistractionsHidden = (pausedUntil: unknown, now = Date.now()) => (
  normalizeYouTubeDistractionsPausedUntil(pausedUntil) <= now
);

export const pauseYouTubeDistractions = (now = Date.now()) => (
  now + YOUTUBE_DISTRACTIONS_PAUSE_DURATION
);
