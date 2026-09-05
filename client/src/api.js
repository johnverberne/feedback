async function request(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || `Fout ${res.status}`);
  }
  return data;
}

export function getForm() {
  return request("/api/form");
}

export function getSession(id) {
  return request(`/api/sessions/${id}`);
}

export function submitSession(id, answers) {
  return request(`/api/sessions/${id}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
}

export function createSession(payload) {
  return request("/api/intake", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
