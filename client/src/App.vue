<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { createSession, getForm, getSession, submitSession } from "./api";

const loading = ref(true);
const saving = ref(false);
const error = ref("");
const form = ref(null);
const session = ref(null);
const result = ref(null);
const answers = reactive({});

const sessionId = computed(() => {
  const params = new URLSearchParams(window.location.search);
  return params.get("session") || "";
});

function emptyAnswer(field) {
  return field.type === "checkbox" ? [] : "";
}

function applyForm(nextForm, nextSession = null) {
  form.value = nextForm;
  session.value = nextSession;
  for (const key of Object.keys(answers)) delete answers[key];
  for (const field of nextForm.fields) {
    answers[field.id] = emptyAnswer(field);
  }
}

onMounted(async () => {
  try {
    if (sessionId.value) {
      const data = await getSession(sessionId.value);
      applyForm(data.form, data);
    } else {
      const nextForm = await getForm();
      const created = await createSession({
        pageUrl: document.referrer || window.location.href,
        pageTitle: document.title,
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      });
      history.replaceState(null, "", `/?session=${created.id}`);
      const data = await getSession(created.id);
      applyForm(data.form, data);
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});

function toggleCheckbox(field, option) {
  const current = Array.isArray(answers[field.id]) ? answers[field.id] : [];
  answers[field.id] = current.includes(option)
    ? current.filter((item) => item !== option)
    : [...current, option];
}

async function submit() {
  if (!session.value || saving.value) return;
  error.value = "";
  saving.value = true;
  try {
    result.value = await submitSession(session.value.id, answers);
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="app-shell">
    <header class="brand">
      <img class="brand-icon" src="/favicon.svg" alt="" width="40" height="40" />
      <div>
        Captain John
        <span>feedback</span>
      </div>
    </header>

    <p v-if="loading" class="lead">Formulier laden…</p>

    <section v-else-if="result" class="panel stack">
      <h1 class="ok">Bedankt</h1>
      <p class="lead">
        {{
          result.dryRun
            ? result.message
            : "Je reactie is bewaard. De screenshot staat op GitHub."
        }}
      </p>
      <p v-if="result.githubUrl || result.url">
        <a
          class="btn-link"
          :href="result.githubUrl || result.url"
          target="_blank"
          rel="noreferrer"
        >
          GitHub{{ result.githubNumber || result.number ? ` #${result.githubNumber || result.number}` : "" }}
        </a>
      </p>
      <p v-if="result.codebergUrl">
        <a class="btn-link" :href="result.codebergUrl" target="_blank" rel="noreferrer">
          Codeberg{{ result.codebergNumber ? ` #${result.codebergNumber}` : "" }}
        </a>
      </p>
      <p v-if="result.warnings?.length" class="error">
        {{ result.warnings.join(" · ") }}
      </p>
      <img
        v-if="result.screenshotUrl"
        class="screenshot"
        :src="result.screenshotUrl"
        alt="Meegestuurde screenshot"
      />
      <details v-if="result.dryRun && result.body">
        <summary>Markdown-preview</summary>
        <pre class="issue-preview">{{ result.body }}</pre>
      </details>
    </section>

    <form v-else-if="form" class="panel stack" @submit.prevent="submit">
      <div>
        <h1>{{ form.title }}</h1>
        <p v-if="form.description" class="lead">{{ form.description }}</p>
        <p v-if="session?.pageUrl" class="meta">
          Pagina: {{ session.pageTitle || session.pageUrl }}
        </p>
      </div>

      <figure v-if="session?.screenshotUrl">
        <img
          class="screenshot"
          :src="session.screenshotUrl"
          alt="Screenshot van de pagina"
        />
      </figure>
      <p v-else class="help">Geen screenshot meegestuurd; je kunt het formulier wel versturen.</p>

      <fieldset
        v-for="field in form.fields"
        :key="field.id"
        class="field"
      >
        <legend v-if="field.type !== 'text'">
          {{ field.label }}
          <span v-if="field.required" class="required">*</span>
        </legend>
        <span v-else class="label">
          {{ field.label }}
          <span v-if="field.required" class="required">*</span>
        </span>
        <p v-if="field.help" class="help">{{ field.help }}</p>

        <div v-if="field.type === 'radio'" class="options">
          <label v-for="option in field.options" :key="option" class="option">
            <input
              type="radio"
              :name="field.id"
              :value="option"
              v-model="answers[field.id]"
            />
            <span>{{ option }}</span>
          </label>
        </div>

        <div v-else-if="field.type === 'checkbox'" class="options">
          <label v-for="option in field.options" :key="option" class="option">
            <input
              type="checkbox"
              :value="option"
              :checked="answers[field.id].includes(option)"
              @change="toggleCheckbox(field, option)"
            />
            <span>{{ option }}</span>
          </label>
        </div>

        <textarea
          v-else
          :id="field.id"
          :rows="field.rows > 1 ? field.rows : 1"
          :placeholder="field.placeholder"
          v-model="answers[field.id]"
        />
      </fieldset>

      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn btn-primary" type="submit" :disabled="saving">
        {{ saving ? "Versturen…" : "Verstuur feedback" }}
      </button>
    </form>

    <p v-else class="error">{{ error || "Formulier niet beschikbaar." }}</p>
  </div>
</template>
