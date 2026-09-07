const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { codebergBase, splitRepo } = require("../server/codeberg");
const { isAllowedOrigin } = require("../server/createApp");

describe("codeberg helpers", () => {
  it("normaliseert de Forgejo-basis-URL", () => {
    assert.equal(codebergBase("https://codeberg.org/"), "https://codeberg.org");
    assert.equal(codebergBase(""), "https://codeberg.org");
  });

  it("splitst owner/name", () => {
    assert.deepEqual(splitRepo("johnverberne/projects-captainjohn"), {
      owner: "johnverberne",
      name: "projects-captainjohn",
    });
    assert.throws(() => splitRepo("ongeldig"), /owner\/name/);
  });
});

describe("CORS origins", () => {
  it("laat het productiedomein altijd toe", () => {
    assert.equal(
      isAllowedOrigin("https://projects.captainjohn.nl", [
        "https://projects-captainjohn-production.up.railway.app",
      ]),
      true
    );
    assert.equal(
      isAllowedOrigin("https://evil.example", [
        "https://projects-captainjohn-production.up.railway.app",
      ]),
      false
    );
  });
});
