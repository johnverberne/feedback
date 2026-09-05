const DEFAULT_LABELS = ["feedback"];

function splitRepo(repo) {
  const [owner, name] = String(repo || "").split("/");
  if (!owner || !name) {
    throw new Error("GITHUB_REPO moet owner/name zijn");
  }
  return { owner, name };
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "captainjohn-feedback",
  };
}

async function githubJson(url, { token, method = "GET", body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      ...githubHeaders(token),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.message || `GitHub ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function ensureLabels(repo, token, labels) {
  for (const label of labels) {
    try {
      await githubJson(`https://api.github.com/repos/${repo}/labels`, {
        token,
        method: "POST",
        body: {
          name: label,
          color: "b85c38",
          description: "Website-feedback met screenshot",
        },
      });
    } catch (err) {
      if (err.status !== 422) throw err;
    }
  }
}

async function uploadScreenshot({ repo, token, id, buffer }) {
  const filePath = `feedback-screenshots/${id}.png`;
  await githubJson(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
    token,
    method: "PUT",
    body: {
      message: `feedback: screenshot ${id}`,
      content: buffer.toString("base64"),
    },
  });
  return `https://raw.githubusercontent.com/${repo}/main/${filePath}`;
}

async function addIssueToProject({ repo, token, projectNumber, issueNodeId }) {
  if (!projectNumber || !issueNodeId) return null;
  const { owner } = splitRepo(repo);
  const ownerQuery = `
    query($login: String!, $number: Int!) {
      user(login: $login) {
        projectV2(number: $number) { id }
      }
    }
  `;
  const found = await githubJson("https://api.github.com/graphql", {
    token,
    method: "POST",
    body: {
      query: ownerQuery,
      variables: { login: owner, number: Number(projectNumber) },
    },
  });
  const projectId = found.data?.user?.projectV2?.id;
  if (!projectId) return null;
  const mutation = `
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item { id }
      }
    }
  `;
  await githubJson("https://api.github.com/graphql", {
    token,
    method: "POST",
    body: {
      query: mutation,
      variables: { projectId, contentId: issueNodeId },
    },
  });
  return projectId;
}

async function createFeedbackIssue({
  repo,
  token,
  title,
  body,
  labels = DEFAULT_LABELS,
  projectNumber,
}) {
  await ensureLabels(repo, token, labels);
  const issue = await githubJson(`https://api.github.com/repos/${repo}/issues`, {
    token,
    method: "POST",
    body: { title, body, labels },
  });
  try {
    await addIssueToProject({
      repo,
      token,
      projectNumber,
      issueNodeId: issue.node_id,
    });
  } catch (err) {
    console.warn("Issue niet aan GitHub Project gekoppeld:", err.message);
  }
  return {
    url: issue.html_url,
    number: issue.number,
  };
}

module.exports = {
  createFeedbackIssue,
  ensureLabels,
  uploadScreenshot,
  DEFAULT_LABELS,
};
