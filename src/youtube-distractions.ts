import storage from "./storage";
import {
  areYouTubeDistractionsHidden,
  normalizeYouTubeDistractionsPausedUntil,
} from "./helpers/youtube-distractions";

const HIDDEN_CLASS = "focus-hide-youtube-distractions";
let resumeTimer: number | undefined;
let layoutRefreshTimer: number | undefined;

const refreshYouTubeLayout = () => {
  window.clearTimeout(layoutRefreshTimer);
  layoutRefreshTimer = window.setTimeout(() => {
    window.dispatchEvent(new Event("resize"));
  }, 0);
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

  if (!hidden) {
    resumeTimer = window.setTimeout(() => render(pausedUntil), pausedUntil - Date.now());
  }
};

document.documentElement.classList.add(HIDDEN_CLASS);

void storage.get(["youtubeDistractionsPausedUntil"])
  .then(({ youtubeDistractionsPausedUntil }) => {
    render(youtubeDistractionsPausedUntil);
  });

chrome.storage.local.onChanged.addListener((changes) => {
  if (changes.youtubeDistractionsPausedUntil) {
    render(changes.youtubeDistractionsPausedUntil.newValue);
  }
});
