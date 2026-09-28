import makeRules, { hasInvalidSiteRules, isSiteRuleLineInvalid, type Rule } from "../make-rules";

test("makeRules()", () => {
  expect(
    makeRules([
      "www.facebook.com",
      "https://www.instagram.com/",

      "*.youtube.com",
      "!music.youtube.com",

      "reddit.com",
      "!reddit.com/r/MachineLearning",
    ]),
  ).toEqual<Rule[]>([
    { type: "allow", path: "music.youtube.com" },
    { type: "allow", path: "reddit.com/r/MachineLearning" },

    { type: "block", path: "www.facebook.com" },
    { type: "block", path: "www.instagram.com/" },

    { type: "block", path: "*.youtube.com" },
    { type: "block", path: "reddit.com" },
  ]);
});

test("makeRules() parses per-site schedule overrides", () => {
  expect(makeRules(["instagram.com | 8-10, 14:00-16:30", "youtube.com | !12-13, *"])).toEqual<
    Rule[]
  >([
    {
      type: "block",
      path: "instagram.com",
      schedule: [
        { type: "block", start: 480, end: 600 },
        { type: "block", start: 840, end: 990 },
      ],
    },
    {
      type: "block",
      path: "youtube.com",
      schedule: [{ type: "allow", start: 720, end: 780 }, { type: "block-all" }],
    },
  ]);
});

test("site rule validation checks every schedule override", () => {
  expect(isSiteRuleLineInvalid("instagram.com | 8-10, 14-16")).toBe(false);
  expect(isSiteRuleLineInvalid("instagram.com | !12-13, *")).toBe(false);
  expect(isSiteRuleLineInvalid("instagram.com | 8-99")).toBe(true);
  expect(isSiteRuleLineInvalid("instagram.com |")).toBe(true);
  expect(hasInvalidSiteRules("instagram.com | 8-10\nyoutube.com | 9-99")).toBe(true);
});
