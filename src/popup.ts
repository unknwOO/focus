import storage from "./storage";
import {
  areYouTubeDistractionsHidden,
  normalizeYouTubeDistractionsPausedUntil,
  pauseYouTubeDistractions,
} from "./helpers/youtube-distractions";

const toggle = document.getElementById("youtube-distractions-toggle") as HTMLInputElement;
const statusTitle = document.getElementById(
  "youtube-distractions-status-title",
) as HTMLElement;
const statusDetail = document.getElementById(
  "youtube-distractions-status-detail",
) as HTMLElement;
const openSettings = document.getElementById("open-settings") as HTMLButtonElement;
let pausedUntil = 0;

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

toggle.addEventListener("change", () => {
  pausedUntil = toggle.checked ? 0 : pauseYouTubeDistractions();
  void storage.set({ youtubeDistractionsPausedUntil: pausedUntil }).then(render);
});

openSettings.addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
  window.close();
});

void storage.get(["youtubeDistractionsPausedUntil"]).then((settings) => {
  pausedUntil = normalizeYouTubeDistractionsPausedUntil(
    settings.youtubeDistractionsPausedUntil,
  );
  render();
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
});

window.setInterval(render, 1000);
