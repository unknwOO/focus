import {
  areYouTubeDistractionsHidden,
  normalizeYouTubeDistractionsPausedUntil,
  pauseYouTubeDistractions,
} from "./helpers/youtube-distractions";
import {
  normalizeYouTubeWatchedVideosMode,
  YOUTUBE_WATCHED_VIDEOS_CAPTIONS,
  type YouTubeWatchedVideosMode,
} from "./helpers/youtube-watched-videos";
import storage from "./storage";

const toggle = document.getElementById("youtube-distractions-toggle") as HTMLInputElement;
const statusTitle = document.getElementById("youtube-distractions-status-title") as HTMLElement;
const statusDetail = document.getElementById("youtube-distractions-status-detail") as HTMLElement;
const openSettings = document.getElementById("open-settings") as HTMLButtonElement;
const watchedVideosButtons = document.querySelectorAll<HTMLButtonElement>(
  "#youtube-watched-videos [data-mode]",
);
const watchedVideosCaption = document.getElementById(
  "youtube-watched-videos-caption",
) as HTMLElement;
let pausedUntil = 0;
let watchedVideosMode: YouTubeWatchedVideosMode = "SHOW";

const formatRemainingTime = (milliseconds: number) => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
};

const render = () => {
  const hidden = areYouTubeDistractionsHidden(pausedUntil);
  toggle.checked = hidden;
  statusTitle.textContent = hidden ? "Focus mode is active" : "Taking a break";
  statusDetail.textContent = hidden
    ? "Home, Shorts and suggestions are hidden."
    : `Distractions return in ${formatRemainingTime(pausedUntil - Date.now())}.`;
};

const renderWatchedVideos = () => {
  watchedVideosCaption.textContent = YOUTUBE_WATCHED_VIDEOS_CAPTIONS[watchedVideosMode];
  watchedVideosButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.mode === watchedVideosMode));
  });
};

watchedVideosButtons.forEach((button) => {
  button.addEventListener("click", () => {
    watchedVideosMode = normalizeYouTubeWatchedVideosMode(button.dataset.mode);
    renderWatchedVideos();
    void storage.set({ youtubeWatchedVideos: watchedVideosMode });
  });
});

toggle.addEventListener("change", () => {
  pausedUntil = toggle.checked ? 0 : pauseYouTubeDistractions();
  void storage.set({ youtubeDistractionsPausedUntil: pausedUntil }).then(render);
});

openSettings.addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
  window.close();
});

void storage.get(["youtubeDistractionsPausedUntil", "youtubeWatchedVideos"]).then((settings) => {
  pausedUntil = normalizeYouTubeDistractionsPausedUntil(settings.youtubeDistractionsPausedUntil);
  watchedVideosMode = normalizeYouTubeWatchedVideosMode(settings.youtubeWatchedVideos);
  render();
  renderWatchedVideos();
  document.body.classList.add("ready");
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => document.body.classList.add("interactive"));
  });
});

chrome.storage.local.onChanged.addListener((changes) => {
  if (changes.youtubeDistractionsPausedUntil) {
    pausedUntil = normalizeYouTubeDistractionsPausedUntil(
      changes.youtubeDistractionsPausedUntil.newValue,
    );
    render();
  }

  if (changes.youtubeWatchedVideos) {
    watchedVideosMode = normalizeYouTubeWatchedVideosMode(changes.youtubeWatchedVideos.newValue);
    renderWatchedVideos();
  }
});

window.setInterval(render, 1000);
