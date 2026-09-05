# Feedback — Captain John

Kleine app die een **markdown-formulier** toont (vrije tekst, checkbox, radio) en de antwoorden als **GitHub-issue** post, inclusief screenshot.

Captain John stuurt bij de feedback-knop een screenshot + paginacontext naar deze app.

## Formulier als markdown

Bron: [`forms/default.md`](./forms/default.md).

```markdown
# Titel

Inleiding.

## Vraag
type: radio
required: true

- Optie A
- Optie B

## Meer keuzes
type: checkbox

- Een
- Twee

## Toelichting
type: text
required: true
placeholder: Typ hier…
rows: 5
```

Ondersteunde velden: `text`, `checkbox`, `radio`.  
Het Google-formulier waar dit op gebaseerd is, vraagt om inloggen; pas `forms/default.md` aan als de vragen anders moeten.

## Lokaal

```bash
cp .env.example .env
npm run install:all
npm run prod
```

Open http://localhost:5065

| Script | Doel |
|---|---|
| `npm run install:all` | Root + client |
| `npm run build` | Vue → `client/dist` |
| `npm start` / `npm run prod` | Server (prod = eerst build) |
| `npm test` | Parser + API |
| `npm run dev:vite` | API :5065 + Vite :5174 |

### Omgeving

| Variabele | Doel |
|---|---|
| `PORT` | Standaard `5065` |
| `PUBLIC_URL` | Publieke URL (screenshot-links in issues) |
| `GITHUB_REPO` | Standaard `johnverberne/projects-captainjohn` |
| `GITHUB_TOKEN` | Token met `repo` (en `project` als je een Project-bord wilt) |
| `GITHUB_LABELS` | Standaard `feedback` |
| `GITHUB_PROJECT_NUMBER` | Optioneel Projects v2-nummer |
| `ALLOWED_ORIGINS` | CORS voor screenshot-intake |

Zonder `GITHUB_TOKEN` wordt het issue lokaal bewaard (`data/issues/`) zodat je het formulier kunt testen.

## Koppeling met Captain John

Zet in `projects-captainjohn`:

```
FEEDBACK_APP_URL=http://localhost:5065
```

In productie: de publieke URL van deze app (bijv. Railway).
