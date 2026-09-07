const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { issueUpdate } = require("../server/store");

describe("issueUpdate", () => {
  it("zet null issue-nummers unset zodat unique indexes niet botsen", () => {
    const update = issueUpdate({
      title: "Test",
      githubNumber: null,
      codebergNumber: null,
    });
    assert.equal("githubNumber" in update.$set, false);
    assert.equal("codebergNumber" in update.$set, false);
    assert.deepEqual(update.$unset, { githubNumber: "", codebergNumber: "" });
  });

  it("houdt echte nummers in $set", () => {
    const update = issueUpdate({
      title: "Test",
      githubNumber: 12,
      codebergNumber: 3,
    });
    assert.equal(update.$set.githubNumber, 12);
    assert.equal(update.$set.codebergNumber, 3);
    assert.equal(update.$unset, undefined);
  });
});
