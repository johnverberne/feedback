function escapeMd(value) {
  return String(value || "").replace(/\r\n/g, "\n");
}

function formatAnswer(field, value) {
  if (field.type === "checkbox") {
    const list = Array.isArray(value) ? value : [];
    if (!list.length) return "_geen keuze_";
    return list.map((item) => `- ${escapeMd(item)}`).join("\n");
  }
  const text = escapeMd(value).trim();
  return text || "_niet ingevuld_";
}

function buildIssueMarkdown({ form, answers, meta = {}, screenshotMarkdown }) {
  const lines = [];
  lines.push(`# ${form.title}`);
  lines.push("");
  lines.push("| | |");
  lines.push("|---|---|");
  if (meta.pageUrl) {
    const label = meta.pageTitle ? escapeMd(meta.pageTitle) : meta.pageUrl;
    lines.push(`| **Pagina** | [${label}](${meta.pageUrl}) |`);
  }
  if (meta.createdAt) {
    lines.push(`| **Wanneer** | ${meta.createdAt} |`);
  }
  if (meta.userAgent) {
    lines.push(`| **Browser** | \`${escapeMd(meta.userAgent)}\` |`);
  }
  if (meta.viewport) {
    lines.push(`| **Scherm** | ${escapeMd(meta.viewport)} |`);
  }
  lines.push("");

  for (const field of form.fields) {
    lines.push(`## ${field.label}`);
    lines.push("");
    lines.push(formatAnswer(field, answers[field.id]));
    lines.push("");
  }

  if (screenshotMarkdown) {
    lines.push("---");
    lines.push("");
    lines.push("## Screenshot");
    lines.push("");
    lines.push(screenshotMarkdown);
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

function issueTitle(form, answers) {
  const kind = form.fields.find((field) => field.type === "radio");
  const text = form.fields.find((field) => field.type === "text" && field.required);
  const kindValue = kind ? String(answers[kind.id] || "").trim() : "";
  const textValue = text ? String(answers[text.id] || "").trim() : "";
  const excerpt = textValue.replace(/\s+/g, " ").slice(0, 72);
  if (kindValue && excerpt) return `[Feedback] ${kindValue}: ${excerpt}`;
  if (kindValue) return `[Feedback] ${kindValue}`;
  if (excerpt) return `[Feedback] ${excerpt}`;
  return `[Feedback] ${form.title}`;
}

module.exports = { buildIssueMarkdown, issueTitle };
