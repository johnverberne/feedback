const META_RE = /^(type|required|placeholder|help|rows):\s*(.+)$/i;

function slugify(text) {
  const base = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "veld";
}

function uniqueId(usedIds, base) {
  const n = (usedIds.get(base) || 0) + 1;
  usedIds.set(base, n);
  return n === 1 ? base : `${base}-${n}`;
}

function parseFormMarkdown(markdown) {
  const lines = String(markdown || "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  let title = "Feedback";
  const descriptionParts = [];
  const fields = [];
  const usedIds = new Map();
  let current = null;
  let seenField = false;

  function flush() {
    if (!current) return;
    if (!current.type) {
      current.type = current.options.length ? "radio" : "text";
    }
    if (current.type === "textarea") current.type = "text";
    if (!["radio", "checkbox", "text"].includes(current.type)) {
      throw new Error(`Onbekend veldtype "${current.type}" bij "${current.label}"`);
    }
    if (
      (current.type === "radio" || current.type === "checkbox") &&
      current.options.length === 0
    ) {
      throw new Error(`Veld "${current.label}" heeft geen opties`);
    }
    current.required = Boolean(current.required);
    current.rows = Number(current.rows) || (current.type === "text" ? 4 : 0);
    fields.push(current);
    current = null;
  }

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed.startsWith("# ") && !seenField && !current) {
      title = trimmed.slice(2).trim();
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flush();
      seenField = true;
      const label = trimmed.slice(3).trim();
      current = {
        id: uniqueId(usedIds, slugify(label)),
        label,
        type: null,
        required: false,
        placeholder: "",
        help: "",
        options: [],
        rows: 0,
      };
      continue;
    }
    if (!current) {
      if (trimmed) descriptionParts.push(trimmed);
      continue;
    }
    const meta = trimmed.match(META_RE);
    if (meta) {
      const key = meta[1].toLowerCase();
      const value = meta[2].trim();
      if (key === "required") {
        current.required = /^(true|ja|yes|1)$/i.test(value);
      } else if (key === "type") {
        current.type = value.toLowerCase();
      } else if (key === "rows") {
        current.rows = Number(value);
      } else {
        current[key] = value;
      }
      continue;
    }
    const option = trimmed.match(/^[-*]\s+(.+)$/);
    if (option) {
      current.options.push(option[1].trim());
      continue;
    }
    if (trimmed) {
      current.help = current.help ? `${current.help}\n\n${trimmed}` : trimmed;
    }
  }
  flush();

  return {
    title,
    description: descriptionParts.join("\n\n"),
    fields,
  };
}

function validateAnswers(form, answers) {
  const errors = [];
  const normalized = {};
  const incoming = answers && typeof answers === "object" ? answers : {};

  for (const field of form.fields) {
    const raw = incoming[field.id];
    if (field.type === "checkbox") {
      const list = Array.isArray(raw)
        ? raw.map((item) => String(item).trim()).filter(Boolean)
        : [];
      const allowed = new Set(field.options);
      const unknown = list.filter((item) => !allowed.has(item));
      if (unknown.length) {
        errors.push(`Ongeldige keuze bij "${field.label}"`);
      }
      if (field.required && list.length === 0) {
        errors.push(`Vink minstens één optie aan bij "${field.label}"`);
      }
      normalized[field.id] = list;
      continue;
    }
    if (field.type === "radio") {
      const value = raw == null ? "" : String(raw).trim();
      if (value && !field.options.includes(value)) {
        errors.push(`Ongeldige keuze bij "${field.label}"`);
      }
      if (field.required && !value) {
        errors.push(`Kies een optie bij "${field.label}"`);
      }
      normalized[field.id] = value;
      continue;
    }
    const value = raw == null ? "" : String(raw).trim();
    if (field.required && !value) {
      errors.push(`Vul "${field.label}" in`);
    }
    normalized[field.id] = value;
  }

  return { ok: errors.length === 0, errors, answers: normalized };
}

module.exports = { parseFormMarkdown, validateAnswers, slugify };
