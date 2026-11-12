import {
  areYouTubeDistractionsHidden,
  getYouTubeRedirectPath,
  normalizeYouTubeDistractionsPausedUntil,
} from "./helpers/youtube-distractions";
import {
  normalizeYouTubeWatchedVideosMode,
  YOUTUBE_WATCHED_VIDEOS_CACHE_KEY,
} from "./helpers/youtube-watched-videos";
import storage from "./storage";

const HIDDEN_CLASS = "focus-hide-youtube-distractions";
let resumeTimer: number | undefined;
let layoutRefreshTimer: number | undefined;

const refreshYouTubeLayout = () => {
  window.clearTimeout(layoutRefreshTimer);
  layoutRefreshTimer = window.setTimeout(() => {
    window.dispatchEvent(new Event("resize"));
  }, 0);
};

const redirectFromHome = () => {
  const hidden = document.documentElement.classList.contains(HIDDEN_CLASS);
  const redirectPath = getYouTubeRedirectPath(window.location.pathname, hidden);

  if (redirectPath) {
    window.location.replace(redirectPath);
  }
};

const render = (storedPausedUntil: unknown) => {
  window.clearTimeout(resumeTimer);
  const pausedUntil = normalizeYouTubeDistractionsPausedUntil(storedPausedUntil);
  const hidden = areYouTubeDistractionsHidden(pausedUntil);
  const visibilityChanged = document.documentElement.classList.contains(HIDDEN_CLASS) !== hidden;
  document.documentElement.classList.toggle(HIDDEN_CLASS, hidden);

  if (visibilityChanged) {
    refreshYouTubeLayout();
  }

  redirectFromHome();

  if (!hidden) {
    resumeTimer = window.setTimeout(() => render(pausedUntil), pausedUntil - Date.now());
  }
};

const renderWatchedVideos = (storedMode: unknown) => {
  const mode = normalizeYouTubeWatchedVideosMode(storedMode);
  const changed = document.documentElement.dataset.focusWatchedVideos !== mode;
  document.documentElement.dataset.focusWatchedVideos = mode;

  try {
    localStorage.setItem(YOUTUBE_WATCHED_VIDEOS_CACHE_KEY, mode);
  } catch {
    // The cache only prevents a flash on reload; storage stays the source of truth.
  }

  if (changed) {
    refreshYouTubeLayout();
  }
};

const readCachedWatchedVideosMode = () => {
  try {
    return localStorage.getItem(YOUTUBE_WATCHED_VIDEOS_CACHE_KEY);
  } catch {
    return null;
  }
};

document.documentElement.classList.add(HIDDEN_CLASS);
// Read synchronously at document_start so watched videos never flash before the first paint.
document.documentElement.dataset.focusWatchedVideos = normalizeYouTubeWatchedVideosMode(
  readCachedWatchedVideosMode(),
);

void storage
  .get(["youtubeDistractionsPausedUntil", "youtubeWatchedVideos"])
  .then(({ youtubeDistractionsPausedUntil, youtubeWatchedVideos }) => {
    render(youtubeDistractionsPausedUntil);
    renderWatchedVideos(youtubeWatchedVideos);
  });

document.addEventListener("yt-navigate-finish", redirectFromHome);

chrome.storage.local.onChanged.addListener((changes) => {
  if (changes.youtubeDistractionsPausedUntil) {
    render(changes.youtubeDistractionsPausedUntil.newValue);
  }

  if (changes.youtubeWatchedVideos) {
    renderWatchedVideos(changes.youtubeWatchedVideos.newValue);
  }
});
