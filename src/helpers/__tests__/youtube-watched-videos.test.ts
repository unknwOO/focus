import {
  isYouTubeWatchedVideosMode,
  normalizeYouTubeWatchedVideosMode,
  YOUTUBE_WATCHED_VIDEOS_CAPTIONS,
  YOUTUBE_WATCHED_VIDEOS_MODES,
} from "../youtube-watched-videos";

describe("YouTube watched videos mode", () => {
  it("accepts every supported mode", () => {
    YOUTUBE_WATCHED_VIDEOS_MODES.forEach((mode) => {
      expect(isYouTubeWatchedVideosMode(mode)).toBe(true);
      expect(normalizeYouTubeWatchedVideosMode(mode)).toBe(mode);
    });
  });

  it("falls back to SHOW for invalid stored values", () => {
    [undefined, null, "", "hide", "BLUR", 1, {}].forEach((value) => {
      expect(isYouTubeWatchedVideosMode(value)).toBe(false);
      expect(normalizeYouTubeWatchedVideosMode(value)).toBe("SHOW");
    });
  });

  it("has a caption for every mode", () => {
    YOUTUBE_WATCHED_VIDEOS_MODES.forEach((mode) => {
      expect(YOUTUBE_WATCHED_VIDEOS_CAPTIONS[mode]).toEqual(expect.any(String));
    });
  });
});
