const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const TTL_MS = 2 * 60 * 60 * 1000;
const PNG_PREFIX = "data:image/png;base64,";
const JPEG_PREFIX = "data:image/jpeg;base64,";

function createSessionStore(dataDir) {
  const screenshotDir = path.join(dataDir, "screenshots");
  const issueDir = path.join(dataDir, "issues");
  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.mkdirSync(issueDir, { recursive: true });

  const sessions = new Map();

  function prune() {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (session.expiresAt <= now) sessions.delete(id);
    }
  }

  function decodeScreenshot(dataUrl) {
    if (!dataUrl || typeof dataUrl !== "string") return null;
    if (dataUrl.startsWith(PNG_PREFIX)) {
      return Buffer.from(dataUrl.slice(PNG_PREFIX.length), "base64");
    }
    if (dataUrl.startsWith(JPEG_PREFIX)) {
      return Buffer.from(dataUrl.slice(JPEG_PREFIX.length), "base64");
    }
    return null;
  }

  function create(payload = {}) {
    prune();
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const screenshot = decodeScreenshot(payload.screenshot);
    if (screenshot) {
      fs.writeFileSync(path.join(screenshotDir, `${id}.png`), screenshot);
    }
    const session = {
      id,
      createdAt,
      expiresAt: Date.now() + TTL_MS,
      pageUrl: String(payload.pageUrl || "").slice(0, 2000),
      pageTitle: String(payload.pageTitle || "").slice(0, 200),
      userAgent: String(payload.userAgent || "").slice(0, 500),
      viewport: String(payload.viewport || "").slice(0, 80),
      hasScreenshot: Boolean(screenshot),
    };
    sessions.set(id, session);
    return session;
  }

  function get(id) {
    prune();
    return sessions.get(id) || null;
  }

  function screenshotPath(id) {
    const file = path.join(screenshotDir, `${id}.png`);
    return fs.existsSync(file) ? file : null;
  }

  function screenshotBuffer(id) {
    const file = screenshotPath(id);
    return file ? fs.readFileSync(file) : null;
  }

  function saveIssueMarkdown(id, markdown) {
    const file = path.join(issueDir, `${id}.md`);
    fs.writeFileSync(file, markdown, "utf8");
    return file;
  }

  return {
    create,
    get,
    screenshotPath,
    screenshotBuffer,
    saveIssueMarkdown,
  };
}

module.exports = { createSessionStore };
