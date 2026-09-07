const mongoose = require("mongoose");
const FeedbackIssue = require("./model/feedbackIssue.model");

function mongoUriFromEnv() {
  return process.env.MONGODB_URI || process.env.MONGO_URI || "";
}

async function connectMongo(uri = mongoUriFromEnv()) {
  if (!uri) return false;
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(uri);
  }
  await FeedbackIssue.syncIndexes();
  return true;
}

function mongoStatus() {
  return mongoose.connection.readyState === 1 ? "connected" : "disconnected";
}

function issueUpdate(doc) {
  const next = { ...doc };
  const unset = {};
  for (const key of ["githubNumber", "codebergNumber"]) {
    if (next[key] == null) {
      delete next[key];
      unset[key] = "";
    }
  }
  const update = { $set: next };
  if (Object.keys(unset).length) update.$unset = unset;
  return update;
}

async function saveFeedbackIssue(doc) {
  const query = doc.sessionId
    ? { sessionId: doc.sessionId }
    : doc.githubNumber
      ? { githubNumber: doc.githubNumber }
      : { title: doc.title, submittedAt: doc.submittedAt };
  return FeedbackIssue.findOneAndUpdate(query, issueUpdate(doc), {
    upsert: true,
    new: true,
  });
}

async function listFeedbackIssues(limit = 50) {
  return FeedbackIssue.find().sort({ submittedAt: -1, createdAt: -1 }).limit(limit).lean();
}

module.exports = {
  mongoUriFromEnv,
  connectMongo,
  mongoStatus,
  issueUpdate,
  saveFeedbackIssue,
  listFeedbackIssues,
};
