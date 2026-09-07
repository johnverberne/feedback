const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { readIntegrations } = require("../server/env");

describe("readIntegrations", () => {
  it("zet GitHub en Codeberg uit zonder token", () => {
    const { github, codeberg } = readIntegrations({
      githubToken: "",
      codebergToken: "",
    });
    assert.equal(github.enabled, false);
    assert.equal(codeberg.enabled, false);
  });

  it("zet een token uit met ENABLED=false", () => {
    const { github, codeberg } = readIntegrations({
      githubToken: "gho_x",
      githubEnabled: "false",
      codebergToken: "gto_x",
      codebergEnabled: "0",
    });
    assert.equal(github.enabled, false);
    assert.equal(codeberg.enabled, false);
  });

  it("zet een token aan als ENABLED leeg is", () => {
    const { github } = readIntegrations({
      githubToken: "gho_x",
      githubEnabled: "",
    });
    assert.equal(github.enabled, true);
    assert.equal(github.repo, "johnverberne/projects-captainjohn");
  });
});
