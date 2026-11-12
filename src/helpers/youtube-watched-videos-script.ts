import type { YouTubeWatchedVideosMode } from "./youtube-watched-videos";

export const YOUTUBE_WATCHED_VIDEOS_SCRIPT_ID = "youtube-watched-videos-mode";

export const YOUTUBE_WATCHED_VIDEOS_SCRIPT_FILES: Readonly<
  Record<Exclude<YouTubeWatchedVideosMode, "SHOW">, string>
> = {
  DIM: "youtube-watched-videos-dim.js",
  HIDE: "youtube-watched-videos-hide.js",
};

type ScriptingApi = Pick<
  typeof chrome.scripting,
  "getRegisteredContentScripts" | "registerContentScripts" | "unregisterContentScripts"
>;

/**
 * Registers a tiny document_start script that sets the watched videos mode before the first
 * paint, so YouTube never shows watched videos while the content script reads storage.
 */
export const syncWatchedVideosScript = async (
  scripting: ScriptingApi,
  mode: YouTubeWatchedVideosMode,
  persistAcrossSessions: boolean,
) => {
  const registered = await scripting.getRegisteredContentScripts({
    ids: [YOUTUBE_WATCHED_VIDEOS_SCRIPT_ID],
  });
  if (registered.length) {
    await scripting.unregisterContentScripts({ ids: [YOUTUBE_WATCHED_VIDEOS_SCRIPT_ID] });
  }

  if (mode === "SHOW") return;

  await scripting.registerContentScripts([
    {
      id: YOUTUBE_WATCHED_VIDEOS_SCRIPT_ID,
      matches: ["https://youtube.com/*", "https://www.youtube.com/*"],
      js: [YOUTUBE_WATCHED_VIDEOS_SCRIPT_FILES[mode]],
      runAt: "document_start",
      persistAcrossSessions,
    },
  ]);
};
