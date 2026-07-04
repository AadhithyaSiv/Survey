# Deploying the survey + collecting responses into Google Sheets

The survey is a single static page. Responses are sent to a **Google Apps Script
Web App** that appends them to a Google Sheet — no server, no database, free.

Do the **Google side first** (you need its URL), then the **Vercel side**.

---

## Part 1 — Google Sheet + Apps Script (the collector)

1. Go to <https://sheets.google.com> and create a **new blank spreadsheet**.
   Name it anything (e.g. *WDMI Responses*). You don't need to add headers —
   the script creates them automatically.
2. In that sheet: **Extensions ▸ Apps Script**.
3. Delete whatever is in the editor, then open [`apps-script/Code.gs`](apps-script/Code.gs)
   from this project, copy **all** of it, and paste it in. Click **Save** (💾).
4. Click **Deploy ▸ New deployment**.
5. Click the **gear icon ▸ Web app**.
6. Set:
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`  ← must be *Anyone*, not "Anyone with Google account"
7. Click **Deploy**, then **Authorize access** and allow the permissions
   (Google will warn it's an unverified app — that's your own script, continue).
8. Copy the **Web app URL**. It looks like:
   `https://script.google.com/macros/s/AKfy..../exec`
   (Sanity check: open that URL in a browser — you should see
   `{"ok":true,"service":"wdmi-survey-collector"}`.)

## Part 2 — Point the survey at your collector

Open [`index.html`](index.html), find near
the top of the `<script>`:

```js
const CONFIG = {
  endpoint: "",   /* paste your Supabase/webhook URL here to start collecting */
```

Paste your `/exec` URL inside the quotes:

```js
  endpoint: "https://script.google.com/macros/s/AKfy..../exec",
```

Save the file.

## Part 3 — Deploy to Vercel

**Option A — GitHub (recommended, gives auto-deploys on every edit):**
1. Put this folder in a GitHub repo (commit `index.html` and the
   `apps-script/` folder).
2. At <https://vercel.com> ▸ **Add New ▸ Project ▸ Import** the repo.
3. Framework preset: **Other**. Leave build/output settings empty. **Deploy**.

**Option B — Vercel CLI (no GitHub):**
```bash
npm i -g vercel
cd "path/to/Jyoti Survey"
vercel        # first run links/creates the project
vercel --prod # promote to your live URL
```

Because the file is named `index.html`, Vercel serves it at the site root
(`your-app.vercel.app/`) automatically — no extra configuration needed.

## Part 4 — Test end to end

1. Open your live Vercel URL.
2. Complete the survey (you can click through quickly to test).
3. On the final screen it transmits. Refresh your Google Sheet — a new row
   appears on the **Responses** tab, one column per item/score.

---

## Notes & troubleshooting

- **No row appeared.** Re-check that `Who has access` = **Anyone**, that the URL
  ends in `/exec` (not `/dev`), and that you pasted it into `CONFIG.endpoint`.
  Opening the `/exec` URL should return the `{"ok":true...}` JSON.
- **You edited `Code.gs` after deploying.** A new paste is *not* live until you
  redeploy: **Deploy ▸ Manage deployments ▸** edit (pencil) **▸ Version: New
  version ▸ Deploy**. The URL stays the same.
- **Columns.** Headers are generated from the first response and extend
  automatically if a new field ever shows up. Rows are keyed by
  `respondentId`, so a resent/reopened submission updates its row rather than
  duplicating.
- **Nothing is lost if a send fails.** Every completed response is also saved in
  the respondent's browser `localStorage` (`swdmi_results`), and failed sends are
  queued under `swdmi_unsent`.
- **Privacy.** The `apps-script/Code.gs` file contains no secrets, so it's
  harmless if it's also served by Vercel. If you'd rather not publish it, just
  don't commit the `apps-script/` folder to the deployed repo — keep it locally.
- **Consent.** The payload includes `consent_participate` /
  `consent_shareAnonymised`; you can filter on those columns before analysis.
