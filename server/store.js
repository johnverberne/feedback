const mongoose = require("mongoose");
const FeedbackIssue = require("./model/feedbackIssue.model");

function mongoUriFromEnv() {
  return process.env.MONGODB_URI || process.env.MONGO_URI || "";
}

async function connectMongo(uri = mongoUriFromEnv()) {
  if (!uri) return false;
  if (mongoose.connection.readyState === 1) return true;
  await mongoose.connect(uri);
  return true;
}

function mongoStatus() {
  return mongoose.connection.readyState === 1 ? "connected" : "disconnected";
}

async function saveFeedbackIssue(doc) {
  const query = doc.sessionId
    ? { sessionId: doc.sessionId }
    : doc.githubNumber
      ? { githubNumber: doc.githubNumber }
      : { title: doc.title, submittedAt: doc.submittedAt };
  return FeedbackIssue.findOneAndUpdate(query, { $set: doc }, {
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
  saveFeedbackIssue,
  listFeedbackIssues,
};
