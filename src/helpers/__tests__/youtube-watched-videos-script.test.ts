import {
  syncWatchedVideosScript,
  YOUTUBE_WATCHED_VIDEOS_SCRIPT_ID,
} from "../youtube-watched-videos-script";

const createScripting = (registeredIds: string[] = []) => ({
  getRegisteredContentScripts: jest.fn(async () => registeredIds.map((id) => ({ id }))),
  registerContentScripts: jest.fn(async () => undefined),
  unregisterContentScripts: jest.fn(async () => undefined),
});

describe("syncWatchedVideosScript", () => {
  it("registers the script for the selected mode", async () => {
    const scripting = createScripting();
    await syncWatchedVideosScript(scripting as never, "HIDE", true);

    expect(scripting.unregisterContentScripts).not.toHaveBeenCalled();
    expect(scripting.registerContentScripts).toHaveBeenCalledWith([
      expect.objectContaining({
        id: YOUTUBE_WATCHED_VIDEOS_SCRIPT_ID,
        js: ["youtube-watched-videos-hide.js"],
        runAt: "document_start",
        persistAcrossSessions: true,
      }),
    ]);
  });

  it("replaces a script registered for another mode", async () => {
    const scripting = createScripting([YOUTUBE_WATCHED_VIDEOS_SCRIPT_ID]);
    await syncWatchedVideosScript(scripting as never, "DIM", false);

    expect(scripting.unregisterContentScripts).toHaveBeenCalledWith({
      ids: [YOUTUBE_WATCHED_VIDEOS_SCRIPT_ID],
    });
    expect(scripting.registerContentScripts).toHaveBeenCalledWith([
      expect.objectContaining({ js: ["youtube-watched-videos-dim.js"] }),
    ]);
  });

  it("only unregisters the script in SHOW mode", async () => {
    const scripting = createScripting([YOUTUBE_WATCHED_VIDEOS_SCRIPT_ID]);
    await syncWatchedVideosScript(scripting as never, "SHOW", true);

    expect(scripting.unregisterContentScripts).toHaveBeenCalled();
    expect(scripting.registerContentScripts).not.toHaveBeenCalled();
  });
});
