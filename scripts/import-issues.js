require("../server/loadEnv");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { connectMongo, saveFeedbackIssue } = require("../server/store");
const FeedbackIssue = require("../server/model/feedbackIssue.model");

function screenshotFromBody(body) {
  const match = String(body || "").match(
    /!\[[^\]]*\]\((https?:\/\/[^)]+\.png)\)/
  );
  return match ? match[1] : "";
}

function sessionIdFromUrl(url) {
  const match = String(url || "").match(/screenshots\/([a-f0-9-]+)\.png/i);
  return match ? match[1] : "";
}

async function githubIssues(repo, token) {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/issues?labels=feedback&state=all&per_page=50`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "captainjohn-feedback",
      },
    }
  );
  if (!res.ok) throw new Error(`GitHub issues: ${res.status}`);
  const items = await res.json();
  return items.filter((item) => !item.pull_request);
}

async function main() {
  await connectMongo();
  const repo = process.env.GITHUB_REPO || "johnverberne/projects-captainjohn";
  const token = process.env.GITHUB_TOKEN;
  let imported = 0;

  if (token) {
    const issues = await githubIssues(repo, token);
    for (const issue of issues) {
      const screenshotUrl = screenshotFromBody(issue.body);
      await saveFeedbackIssue({
        sessionId: sessionIdFromUrl(screenshotUrl) || undefined,
        title: issue.title,
        body: issue.body || "",
        answers: {},
        formTitle: "Feedback website Captain John",
        screenshotUrl,
        githubUrl: issue.html_url,
        githubNumber: issue.number,
        submittedAt: new Date(issue.created_at),
      });
      imported += 1;
      console.log(`Mongo: #${issue.number} ${issue.title}`);
    }
  }

  const localDir = path.join(__dirname, "..", "data", "issues");
  if (fs.existsSync(localDir)) {
    for (const name of fs.readdirSync(localDir)) {
      if (!name.endsWith(".md")) continue;
      const sessionId = name.replace(/\.md$/, "");
      const exists = await FeedbackIssue.findOne({ sessionId });
      if (exists) continue;
      const body = fs.readFileSync(path.join(localDir, name), "utf8");
      const titleMatch = body.match(/^# (.+)$/m);
      await saveFeedbackIssue({
        sessionId,
        title: titleMatch ? `[Feedback] ${titleMatch[1]}` : "[Feedback]",
        body,
        answers: {},
        formTitle: titleMatch ? titleMatch[1] : "",
        screenshotUrl: screenshotFromBody(body),
        submittedAt: fs.statSync(path.join(localDir, name)).mtime,
      });
      imported += 1;
      console.log(`Mongo: lokaal ${sessionId}`);
    }
  }

  console.log(`Klaar: ${imported} issues naar MongoDB`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
