import packageJson from "./package.json";

import manifestChromeJson from "./public/manifest-chrome.json";
import manifestFirefoxJson from "./public/manifest-firefox.json";

test("version equality", () => {
  const { version } = packageJson;

  [manifestChromeJson.version, manifestFirefoxJson.version].forEach((manifestVersion) => {
    expect(manifestVersion).toBe(version);
  });
});
