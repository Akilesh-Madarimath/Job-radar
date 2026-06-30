# Job Radar — Live Dashboard with Daily Auto-Refresh (Web Search Edition)

This is a complete, self-contained setup: one GitHub repo gives you a live
dashboard URL that refreshes itself every day via GitHub Actions, using the
Claude API's web search tool (no Apify needed).

## What's in this folder

| File | Purpose |
|---|---|
| `index.html` | The dashboard — same UI as before, now fetches `jobs.json` live instead of having data baked in |
| `jobs.json` | Seed data (today's 30 jobs) so the page isn't empty before the first automated run |
| `job_radar_scraper_v2.py` | The script that finds new jobs via Claude's web_search tool and rewrites `jobs.json` |
| `requirements.txt` | One dependency: `requests` |
| `.github/workflows/daily-scrape.yml` | The schedule — runs the script daily, commits the updated `jobs.json` |

## How it actually works (so you can trust it)

1. GitHub Actions wakes up daily at 6:00 AM IST (00:30 UTC)
2. It runs `job_radar_scraper_v2.py`, which makes 4 separate calls to the
   Claude API, each with `web_search` enabled, asking it to find and
   structure real job listings for a specific query
3. Claude searches the live web, extracts genuine postings with real URLs,
   and scores each against your resume profile (hardcoded in the script —
   edit `CANDIDATE_PROFILE` if your skills/target change)
4. The script deduplicates, filters out anything below a 50 fit score or
   missing a URL, and writes the result to `jobs.json`
5. GitHub Actions commits that updated `jobs.json` back to the repo
6. Your live dashboard (`index.html`) fetches `jobs.json` fresh every time
   someone loads the page — so it always shows whatever the last successful
   run produced

## Setup steps

### 1. Create the GitHub repo and upload everything

1. Create a new **public** repo (call it `job-radar` or anything)
2. Upload **all files in this folder**, preserving the folder structure —
   specifically, `.github/workflows/daily-scrape.yml` must stay in that exact
   nested path for GitHub Actions to find it (GitHub's web upload UI
   preserves folder structure if you drag the whole folder, but check this
   after uploading — see Troubleshooting below if the workflow doesn't show up)

### 2. Add your Anthropic API key as a secret

1. In your repo: **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name: `ANTHROPIC_API_KEY`
4. Value: your key from console.anthropic.com
5. Save

This key is never visible in logs or to anyone browsing your repo — GitHub
encrypts it and only injects it into the Action's environment at run time.

### 3. Enable GitHub Pages

Same as before: **Settings → Pages → Source: Deploy from a branch → main → / (root) → Save**

### 4. Test the workflow manually (don't wait for tomorrow's schedule)

1. Go to the **Actions** tab in your repo
2. Click **Daily Job Scrape** in the left sidebar
3. Click **Run workflow** (top right) → **Run workflow** again to confirm
4. Watch it run — click into the running job to see live logs
5. If it succeeds, check your repo for an updated `jobs.json` with a new commit
6. Visit your live URL and confirm new data shows up (hard-refresh with Ctrl+Shift+R / Cmd+Shift+R to bypass cache)

## Cost

Each daily run makes 4 API calls with web search enabled. Web-search-enabled
calls cost more than plain text calls — budget roughly $0.05–$0.15 per full
run, so **$1.50–$4.50/month** for daily runs. GitHub Actions itself is free
for this usage level on a public repo.

## Honest limitations

- **I have not run this script against a live API key.** I don't have
  Anthropic API access in the sandbox I built this in. The logic is sound
  and mirrors exactly how I successfully called web_search/web_fetch
  manually earlier in this build, but the *unattended, scripted* version
  needs your first manual workflow run (Step 4 above) to confirm it works
  end-to-end. If it fails, check the Actions log — the script prints
  warnings for empty results or JSON parse failures to make debugging easier.
- **Web search results are less structured than a dedicated scraper.**
  Expect more variance run-to-run than the original Apify-based approach —
  some days might surface 15 jobs, others 25, depending on what's freshly
  indexed and how cleanly Claude can extract structured data from search
  snippets.
- **If a run fails or finds zero jobs**, the script exits with an error
  (visible in the Actions log) and does NOT overwrite `jobs.json` — so your
  dashboard keeps showing the last successful day's data rather than going
  blank. This is intentional.

## Troubleshooting

**Workflow doesn't appear in the Actions tab**: confirm the file is at
exactly `.github/workflows/daily-scrape.yml` in your repo (GitHub is strict
about this path). If you used the web upload UI and it flattened your
folders, you'll need to recreate the `.github/workflows/` folder structure —
click "Create new file" in GitHub's UI and type the full path
`.github/workflows/daily-scrape.yml` into the filename box; GitHub will
auto-create the folders.

**Dashboard shows "Could not load live data"**: open browser dev tools
(F12) → Console tab, see the actual fetch error. Usually means `jobs.json`
isn't at the expected relative path, or the most recent Action run failed
before it could commit.

**Action runs but jobs.json doesn't update**: check the Action's logs for
the dedup/filter step — if everything scored below 50 fit or had no URL,
the script writes an empty result on purpose rather than guessing.
