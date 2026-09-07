function splitRepo(repo) {
  const [owner, name] = String(repo || "").split("/");
  if (!owner || !name) {
    throw new Error("CODEBERG_REPO moet owner/name zijn");
  }
  return { owner, name };
}

function codebergBase(url) {
  return String(url || "https://codeberg.org").replace(/\/$/, "");
}

function codebergHeaders(token) {
  return {
    Authorization: `token ${token}`,
    Accept: "application/json",
    "User-Agent": "captainjohn-feedback",
  };
}

async function codebergJson(url, { token, method = "GET", body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      ...codebergHeaders(token),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.message || data.error || `Codeberg ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function ensureLabelIds(base, repo, token, labels) {
  const existing = await codebergJson(`${base}/api/v1/repos/${repo}/labels?limit=50`, {
    token,
  });
  const byName = new Map(
    (Array.isArray(existing) ? existing : []).map((label) => [label.name, label.id])
  );
  const ids = [];
  for (const name of labels) {
    if (byName.has(name)) {
      ids.push(byName.get(name));
      continue;
    }
    const created = await codebergJson(`${base}/api/v1/repos/${repo}/labels`, {
      token,
      method: "POST",
      body: {
        name,
        color: "b85c38",
        description: "Website-feedback met screenshot",
      },
    });
    ids.push(created.id);
    byName.set(name, created.id);
  }
  return ids;
}

async function createCodebergIssue({
  baseUrl,
  repo,
  token,
  title,
  body,
  labels = ["feedback"],
}) {
  const base = codebergBase(baseUrl);
  splitRepo(repo);
  const labelIds = await ensureLabelIds(base, repo, token, labels);
  const issue = await codebergJson(`${base}/api/v1/repos/${repo}/issues`, {
    token,
    method: "POST",
    body: {
      title,
      body,
      labels: labelIds,
    },
  });
  return {
    url: issue.html_url,
    number: issue.number,
  };
}

module.exports = {
  createCodebergIssue,
  codebergBase,
  splitRepo,
};
