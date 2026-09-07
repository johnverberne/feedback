# Feedback — Captain John

Kleine app die een **markdown-formulier** toont (vrije tekst, checkbox, radio). Ingevulde issues gaan naar **MongoDB** en als issue naar **GitHub** en **Codeberg**. De screenshot wordt naar **GitHub** geüpload en in beide issues gezet.

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
| `MONGODB_URI` | MongoDB-connectie (collectie `feedback_issues`) |
| `PUBLIC_URL` | Fallback-URL voor screenshots zonder GitHub-token |
| `GITHUB_ENABLED` | Optioneel. `false` zet GitHub uit, ook als er een token staat |
| `GITHUB_REPO` | Optioneel. Standaard `johnverberne/projects-captainjohn` |
| `GITHUB_ASSETS_REPO` | Optioneel. Publieke repo voor PNG-screenshots |
| `GITHUB_TOKEN` | Optioneel. Zonder token geen GitHub-issue |
| `GITHUB_LABELS` | Optioneel. Standaard `feedback` |
| `GITHUB_PROJECT_NUMBER` | Optioneel Projects v2-nummer |
| `CODEBERG_ENABLED` | Optioneel. `false` zet Codeberg uit, ook als er een token staat |
| `CODEBERG_URL` | Optioneel. Standaard `https://codeberg.org` |
| `CODEBERG_REPO` | Optioneel. Standaard `johnverberne/projects-captainjohn` |
| `CODEBERG_TOKEN` | Optioneel. Zonder token geen Codeberg-issue |
| `ALLOWED_ORIGINS` | Extra CORS-origins. `https://projects.captainjohn.nl` is altijd toegestaan |

GitHub en Codeberg zijn optioneel. Zonder token (of met `*_ENABLED=false`) wordt het issue in MongoDB of lokaal bewaard.

Screenshots worden als PNG in `johnverberne/feedback` gezet (`screenshots/…png`). GitHub kan die raw-URL's wél tonen; een `localhost`-link in het issue werkt niet.

## Koppeling met Captain John

Zet in `projects-captainjohn`:

```
FEEDBACK_APP_URL=http://localhost:5065
```

In productie: de publieke URL van deze app (bijv. Railway).
