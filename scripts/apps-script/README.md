# Lead capture backend — one-time setup

This has to be done by hand once, in a browser, because Apps Script deployment
requires Google OAuth consent that can't be scripted. Takes about 10 minutes.
`leadCapture.gs` in this folder is the source of truth — if you ever edit the
script in the Apps Script editor, copy the change back into that file too.

> **Already set this up once?** The form's fields changed (ZIP, equipment
> model, and quoted price added) and the sheet's header row changed to match.
> If your "Leads" sheet is still empty, no action needed — just paste the
> updated `leadCapture.gs` into the editor and follow "Redeploying after an
> edit" below. If you've already got a test row in there with the old columns
> (email, zip_or_state, message...), clear the sheet's contents first, or the
> new header won't get written and new columns will misalign with old ones.

## 1. Create the Sheet + script project

1. Go to [sheets.google.com](https://sheets.google.com), create a new blank
   spreadsheet. Name it something like "A2L Reference — Leads."
2. **Extensions → Apps Script.** This opens the script editor, already bound
   to this specific sheet.
3. Delete the default `Code.gs` contents and paste in the full contents of
   [`leadCapture.gs`](./leadCapture.gs) from this repo.
4. Save the project (name it e.g. "lead-capture").

## 2. Store the Turnstile secret key

Never paste the secret key into the `.gs` file itself — it would be saved in
Apps Script's own version history, and if it's ever copied back into this
repo, it'd be committed to a public GitHub repo.

1. In the Apps Script editor: **Project Settings** (gear icon, left sidebar).
2. Scroll to **Script Properties → Add script property**.
3. Property: `TURNSTILE_SECRET_KEY`. Value: the *secret* key from the
   Cloudflare Turnstile widget (not the site key — that one's public and goes
   in the site's own `.env` instead).

## 3. Deploy as a Web App

1. Back in the editor: **Deploy → New deployment**.
2. Type: **Web app**.
3. Execute as: **Me**.
4. Who has access: **Anyone** (this is what allows the static site to POST to
   it without the visitor having a Google account — the endpoint itself is
   still only doing one thing: verifying Turnstile and appending a sheet row).
5. Deploy. Google will ask you to authorize the script's permissions
   (UrlFetchApp for the Turnstile call, Sheets access) — this is the one
   unavoidable manual OAuth click-through.
6. Copy the **Web app URL** (ends in `/exec`).

## 4. Wire it into the site

Set `PUBLIC_LEAD_CAPTURE_ENDPOINT` to that URL and `PUBLIC_TURNSTILE_SITE_KEY`
to the Turnstile *site* key (from the same Cloudflare Turnstile widget):

- Locally: in `.env` (gitignored, copy from `.env.example`).
- On Cloudflare Pages: Settings → Environment variables.
- In GitHub Actions (scheduled rebuild): repo Settings → Secrets and
  variables → Actions.

## Redeploying after an edit

Apps Script Web App URLs are tied to a specific deployment, not the project.
After changing `leadCapture.gs` and pasting the update into the editor:
**Deploy → Manage deployments → edit (pencil) icon → Version: New version →
Deploy.** This keeps the same `/exec` URL, so nothing downstream needs to
change.

## Known limits (free, no billing)

- Consumer Google account Apps Script quota: ~90 minutes of total script
  execution per day, 6-minute max per single execution. A sheet-append
  execution here takes well under a second, so this comfortably supports
  thousands of submissions/day before it's a concern.
- Google Sheets itself: 10 million cells per spreadsheet — irrelevant at any
  lead volume this site will plausibly see.
