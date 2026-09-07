function text(value) {
  return String(value ?? "").trim();
}

function flag(value, fallback) {
  if (value == null || String(value).trim() === "") return fallback;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
}

function optionalIntegration({ token, repo, enabled, defaultRepo = "" }) {
  const trimmedToken = text(token);
  const on = flag(enabled, Boolean(trimmedToken));
  return {
    enabled: on && Boolean(trimmedToken),
    token: trimmedToken,
    repo: text(repo) || defaultRepo,
  };
}

function readIntegrations(options = {}) {
  return {
    github: optionalIntegration({
      token: options.githubToken ?? process.env.GITHUB_TOKEN,
      repo: options.githubRepo ?? process.env.GITHUB_REPO,
      enabled: options.githubEnabled ?? process.env.GITHUB_ENABLED,
      defaultRepo: "johnverberne/projects-captainjohn",
    }),
    codeberg: optionalIntegration({
      token: options.codebergToken ?? process.env.CODEBERG_TOKEN,
      repo: options.codebergRepo ?? process.env.CODEBERG_REPO,
      enabled: options.codebergEnabled ?? process.env.CODEBERG_ENABLED,
      defaultRepo: "johnverberne/projects-captainjohn",
    }),
  };
}

module.exports = { text, flag, optionalIntegration, readIntegrations };
