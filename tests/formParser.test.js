const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { parseFormMarkdown, validateAnswers } = require("../server/formParser");
const { buildIssueMarkdown, issueTitle } = require("../server/issueMarkdown");

const SAMPLE = `# Feedback test

Introductie van het formulier.

## Soort
type: radio
required: true

- Bug
- Idee

## Onderdelen
type: checkbox

- Home
- Foto's

## Toelichting
type: text
required: true
placeholder: Vertel het
rows: 5
`;

describe("formParser", () => {
  it("leest titel, beschrijving en de drie componenttypen", () => {
    const form = parseFormMarkdown(SAMPLE);
    assert.equal(form.title, "Feedback test");
    assert.match(form.description, /Introductie/);
    assert.equal(form.fields.length, 3);
    assert.equal(form.fields[0].type, "radio");
    assert.deepEqual(form.fields[0].options, ["Bug", "Idee"]);
    assert.equal(form.fields[1].type, "checkbox");
    assert.equal(form.fields[2].type, "text");
    assert.equal(form.fields[2].rows, 5);
    assert.equal(form.fields[2].required, true);
  });

  it("valideert verplichte velden", () => {
    const form = parseFormMarkdown(SAMPLE);
    const empty = validateAnswers(form, {});
    assert.equal(empty.ok, false);
    assert.ok(empty.errors.length >= 2);

    const ok = validateAnswers(form, {
      soort: "Bug",
      onderdelen: ["Home"],
      toelichting: "De knop doet niets",
    });
    assert.equal(ok.ok, true);
    assert.equal(ok.answers.soort, "Bug");
  });
});

describe("issueMarkdown", () => {
  it("zet antwoorden en screenshot om naar issue-markdown", () => {
    const form = parseFormMarkdown(SAMPLE);
    const answers = {
      soort: "Bug",
      onderdelen: ["Home", "Foto's"],
      toelichting: "Lightbox sluit niet",
    };
    const body = buildIssueMarkdown({
      form,
      answers,
      meta: {
        pageUrl: "https://example.test/project/1",
        pageTitle: "Vaas",
        createdAt: "2026-09-05T07:00:00.000Z",
        userAgent: "TestBrowser",
        viewport: "390x844",
      },
      screenshotMarkdown: "![Screenshot](https://example.test/shot.png)",
    });
    assert.match(body, /# Feedback test/);
    assert.match(body, /\[Vaas\]\(https:\/\/example.test\/project\/1\)/);
    assert.match(body, /## Soort/);
    assert.match(body, /Bug/);
    assert.match(body, /- Home/);
    assert.match(body, /Lightbox sluit niet/);
    assert.match(body, /!\[Screenshot\]/);
    assert.equal(issueTitle(form, answers), "[Feedback] Bug: Lightbox sluit niet");
  });
});
