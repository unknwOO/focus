import {
  YOUTUBE_DISTRACTIONS_PAUSE_DURATION,
  areYouTubeDistractionsHidden,
  normalizeYouTubeDistractionsPausedUntil,
  pauseYouTubeDistractions,
} from "../youtube-distractions";

describe("YouTube distractions visibility", () => {
  const now = 1_000_000;

  it("hides distractions when no pause is active", () => {
    expect(areYouTubeDistractionsHidden(0, now)).toBe(true);
    expect(areYouTubeDistractionsHidden(now, now)).toBe(true);
  });

  it("shows distractions while a pause is active", () => {
    expect(areYouTubeDistractionsHidden(now + 1, now)).toBe(false);
  });

  it("creates a 15-minute pause", () => {
    expect(pauseYouTubeDistractions(now))
      .toBe(now + YOUTUBE_DISTRACTIONS_PAUSE_DURATION);
    expect(YOUTUBE_DISTRACTIONS_PAUSE_DURATION).toBe(15 * 60 * 1000);
  });

  it("normalizes invalid stored values", () => {
    [undefined, null, "later", -1, Number.NaN, Number.POSITIVE_INFINITY]
      .forEach((value) => expect(normalizeYouTubeDistractionsPausedUntil(value)).toBe(0));
  });
});
