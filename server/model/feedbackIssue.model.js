const mongoose = require("mongoose");

const FeedbackIssueSchema = new mongoose.Schema(
  {
    sessionId: { type: String, index: true, sparse: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    answers: { type: mongoose.Schema.Types.Mixed, default: {} },
    formTitle: { type: String, default: "" },
    pageUrl: { type: String, default: "" },
    pageTitle: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    viewport: { type: String, default: "" },
    screenshotUrl: { type: String, default: "" },
    githubUrl: { type: String, default: "" },
    githubNumber: { type: Number, default: null },
    codebergUrl: { type: String, default: "" },
    codebergNumber: { type: Number, default: null },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: "feedback_issues" }
);

FeedbackIssueSchema.index({ githubNumber: 1 }, { unique: true, sparse: true });
FeedbackIssueSchema.index({ codebergNumber: 1 }, { unique: true, sparse: true });

module.exports =
  mongoose.models.FeedbackIssue ||
  mongoose.model("FeedbackIssue", FeedbackIssueSchema);
