const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("API: intake en submit", () => {
  let app;
  let dataDir;
  const saved = [];

  before(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "feedback-"));
    process.env.ALLOW_NO_CLIENT = "true";
    const { createApp } = require("../server/createApp");
    app = createApp({
      allowNoClient: true,
      dataDir,
      githubToken: "",
      publicUrl: "http://feedback.test",
      saveIssue: async (doc) => {
        saved.push(doc);
      },
    });
  });

  after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("GET /api/form geeft markdown-velden terug", async () => {
    const res = await request(app).get("/api/form").expect(200);
    assert.ok(res.body.title);
    assert.ok(Array.isArray(res.body.fields));
    const types = new Set(res.body.fields.map((field) => field.type));
    assert.ok(types.has("radio"));
    assert.ok(types.has("checkbox"));
    assert.ok(types.has("text"));
  });

  it("intake + submit bewaart markdown inclusief screenshot (dry-run)", async () => {
    const intake = await request(app)
      .post("/api/intake")
      .send({
        screenshot: TINY_PNG,
        pageUrl: "http://localhost:5055/",
        pageTitle: "Captain John",
        userAgent: "supertest",
        viewport: "800x600",
      })
      .expect(201);

    const shot = await request(app)
      .get(`/api/screenshots/${intake.body.id}.png`)
      .expect(200);
    assert.match(shot.headers["content-type"], /image\/png/);

    const session = await request(app)
      .get(`/api/sessions/${intake.body.id}`)
      .expect(200);
    const answers = {};
    for (const field of session.body.form.fields) {
      if (field.type === "radio") answers[field.id] = field.options[0];
      else if (field.type === "checkbox") answers[field.id] = [field.options[0]];
      else answers[field.id] = "De homepage laadt traag op mijn telefoon.";
    }

    const submit = await request(app)
      .post(`/api/sessions/${intake.body.id}/submit`)
      .send({ answers })
      .expect(200);

    assert.equal(submit.body.ok, true);
    assert.equal(submit.body.dryRun, true);
    assert.match(submit.body.body, /# Feedback website Captain John/);
    assert.match(submit.body.body, /!\[Screenshot\]/);
    assert.match(submit.body.body, /De homepage laadt traag/);
    assert.match(submit.body.body, /http:\/\/localhost:5055\//);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].formTitle, "Feedback website Captain John");
    assert.match(saved[0].screenshotUrl, /\/api\/screenshots\//);
    assert.ok(saved[0].answers);
  });

  it("post naar Codeberg als er een token is", async () => {
    const posted = [];
    const stored = [];
    const { createApp } = require("../server/createApp");
    const app = createApp({
      allowNoClient: true,
      dataDir,
      githubToken: "",
      codebergToken: "test-token",
      createCodebergIssue: async (payload) => {
        posted.push(payload);
        return {
          url: "https://codeberg.org/johnverberne/projects-captainjohn/issues/3",
          number: 3,
        };
      },
      saveIssue: async (doc) => {
        stored.push(doc);
      },
      publicUrl: "http://feedback.test",
    });

    const intake = await request(app)
      .post("/api/intake")
      .send({ pageUrl: "http://localhost:5055/", pageTitle: "Captain John" })
      .expect(201);
    const session = await request(app).get(`/api/sessions/${intake.body.id}`).expect(200);
    const answers = {};
    for (const field of session.body.form.fields) {
      if (field.type === "radio") answers[field.id] = field.options[0];
      else if (field.type === "checkbox") answers[field.id] = [field.options[0]];
      else answers[field.id] = "Codeberg-test";
    }

    const submit = await request(app)
      .post(`/api/sessions/${intake.body.id}/submit`)
      .send({ answers })
      .expect(200);

    assert.equal(submit.body.dryRun, false);
    assert.equal(posted.length, 1);
    assert.equal(posted[0].repo, "johnverberne/projects-captainjohn");
    assert.equal(stored[0].codebergNumber, 3);
    assert.match(submit.body.codebergUrl, /codeberg.org/);
  });
});

