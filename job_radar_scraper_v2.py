#!/usr/bin/env python3
"""
Job Radar — Daily Scraper (Web Search Edition)
=================================================
Uses the Claude API's built-in web_search tool to find fresh job listings
for Akilesh's profile, score them, and output jobs.json for the dashboard.

This replaces the Apify-based approach. Why: Apify access kept dropping in
the chat session this was built in, and this version only needs ONE API key
(Anthropic) instead of two (Apify + Anthropic), which simplifies setup.

Trade-off vs Apify: web_search returns whatever Claude finds via search,
which is less structured than a purpose-built LinkedIn/Naukri scraper —
expect noisier, more variable results from run to run. It also costs more
per run (each search-enabled API call is pricier than a plain Apify scrape).

WORKFLOW:
  1. Ask Claude (via API, with web_search tool enabled) to search for fresh
     postings across several role-relevant queries.
  2. Ask Claude to extract structured job data + a fit score from what it found.
  3. Parse the structured JSON response, merge with previous run's data,
     mark new entries, write jobs.json.

Run manually:
    python job_radar_scraper_v2.py

Run on a schedule: see README_V2.md for GitHub Actions setup.

Environment variable required:
    ANTHROPIC_API_KEY   — from https://console.anthropic.com
"""

import os
import sys
import json
import re
import time
from datetime import datetime, timezone

import requests

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    sys.exit("ERROR: set ANTHROPIC_API_KEY environment variable (console.anthropic.com)")

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-sonnet-4-6"

OUTPUT_PATH = os.environ.get("OUTPUT_PATH", "jobs.json")
STATE_PATH = os.environ.get("STATE_PATH", "seen_jobs_state.json")

CANDIDATE_PROFILE = """
B.Tech Computer Science graduate (2025), Bengaluru-based, fresher with 2 internships
(AI/ML Intern at Rooman Technologies, Data Science Intern at Internship Studio).
Core skills: Python, SQL (MySQL/PostgreSQL), Pandas, NumPy, Scikit-learn, XGBoost,
TensorFlow/Keras, PyTorch (learning), CNNs, Spark/PySpark, Tableau, Git.
GenAI: prompt engineering, RAG fundamentals (conceptual), Hugging Face Transformers.
MLOps exposure: MLflow, CI/CD basics, AWS (foundational), Docker (learning).
Quantified achievements: 88% accuracy classifier ensemble, F1 improved 12% via feature
engineering, ROC-AUC 0.91 fraud model, 91% accuracy CNN image classifier (70K images),
Tableau dashboard cutting manual reporting from 2hrs to real-time.
Target roles: AI/ML Engineer, Data Scientist, Associate Data Scientist — fresher/0-2 yrs.
Target location: Bengaluru, India (open to remote/hybrid within India).
"""

# Search queries — each becomes a separate API call so Claude can focus its
# searches and we don't overload one context with too many topics at once.
SEARCH_QUERIES = [
    "Data Scientist fresher jobs Bengaluru hiring now",
    "Machine Learning Engineer entry level jobs Bengaluru",
    "AI Engineer fresher GenAI jobs India hiring",
    "Associate Data Scientist 0-2 years experience Bengaluru",
]


def call_claude_with_search(query: str) -> dict:
    """Calls the Claude API with web_search enabled, asking it to find and
    structure job listings for a single query. Returns the parsed response."""

    system_prompt = f"""You are a job search assistant. You have access to web search.

Candidate profile:
{CANDIDATE_PROFILE}

For the search query you'll be given, search the web for REAL, CURRENTLY ACTIVE
job postings matching it. Prioritize results from LinkedIn, Naukri, Wellfound,
Internshala, and company career pages. Only include listings you can find an
actual URL for — do not invent or guess at postings.

For each genuine listing found (aim for 3-6 per query, fewer is fine if that's
all you find), extract:
- title, company, location, experience requirement, salary (if stated)
- the exact URL to the listing
- a one-sentence summary of required skills

Then score it 0-100 for fit against the candidate profile above (skills match,
experience level, location, domain relevance). Categorize: "High" (80+),
"Medium" (65-79), "Stretch" (50-64). Skip and omit anything below 50.
Recommend bestResume from: "AI/ML Engineer", "Data Scientist (general)",
"Data Scientist I", "Data Scientist (R&D-focused)", "Associate Data Scientist (MLOps)",
"Entry-Level".

Respond with ONLY a JSON array (no markdown fences, no preamble), in this shape:
[
  {{
    "title": "...", "company": "...", "location": "...", "experience": "...",
    "salary": "...", "url": "...", "skills": "...", "fitScore": 82,
    "category": "High", "reasoning": "...", "bestResume": "..."
  }}
]
If you find nothing genuine and verifiable, return an empty array: []"""

    resp = requests.post(
        ANTHROPIC_URL,
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": MODEL,
            "max_tokens": 4000,
            "system": system_prompt,
            "messages": [{"role": "user", "content": f"Search query: {query}"}],
            "tools": [{"type": "web_search_20250305", "name": "web_search"}],
        },
        timeout=120,
    )

    if resp.status_code != 200:
        print(f"  ✗ API call failed for '{query}': {resp.status_code} {resp.text[:300]}")
        return {"jobs": [], "raw_error": resp.text[:500]}

    data = resp.json()

    # Collect all text blocks (search results may produce multiple content blocks:
    # tool_use, tool_result, and final text — we want the final text block)
    text_blocks = [block["text"] for block in data.get("content", []) if block.get("type") == "text"]
    full_text = "\n".join(text_blocks).strip()

    # Strip markdown fences if present
    full_text = re.sub(r"^```json\s*|\s*```$", "", full_text)

    try:
        jobs = json.loads(full_text)
        if not isinstance(jobs, list):
            jobs = []
    except json.JSONDecodeError:
        print(f"  ⚠ Could not parse JSON from response for '{query}'. Raw text:")
        print(f"    {full_text[:300]}")
        jobs = []

    return {"jobs": jobs, "raw_text": full_text}


def make_job_id(job: dict) -> str:
    raw = f"{job.get('title','')}|{job.get('company','')}|{job.get('location','')}"
    return str(abs(hash(raw)) % (10**10))


def dedup_by_url_and_title(jobs: list[dict]) -> list[dict]:
    seen_urls = set()
    seen_title_company = set()
    deduped = []
    for job in jobs:
        url = job.get("url", "").strip()
        key = (job.get("title", "").lower().strip(), job.get("company", "").lower().strip())
        if url and url in seen_urls:
            continue
        if key in seen_title_company:
            continue
        seen_urls.add(url)
        seen_title_company.add(key)
        deduped.append(job)
    return deduped


def load_seen_ids() -> set[str]:
    if os.path.exists(STATE_PATH):
        with open(STATE_PATH) as f:
            return set(json.load(f).get("seen_ids", []))
    return set()


def save_seen_ids(ids: set[str]):
    with open(STATE_PATH, "w") as f:
        json.dump({"seen_ids": list(ids), "updated": datetime.now(timezone.utc).isoformat()}, f)


def main():
    print(f"Job Radar (web search edition) starting — {datetime.now(timezone.utc).isoformat()}")

    all_jobs = []
    for i, query in enumerate(SEARCH_QUERIES, 1):
        print(f"\n[{i}/{len(SEARCH_QUERIES)}] Searching: {query}")
        result = call_claude_with_search(query)
        found = result["jobs"]
        print(f"  → found {len(found)} candidate jobs")
        all_jobs.extend(found)
        time.sleep(2)  # be polite, avoid rate limits

    print(f"\nTotal before dedup: {len(all_jobs)}")
    deduped = dedup_by_url_and_title(all_jobs)
    print(f"After dedup: {len(deduped)}")

    deduped = [j for j in deduped if j.get("fitScore", 0) >= 50 and j.get("url")]
    print(f"After filtering (fit>=50, has URL): {len(deduped)}")

    seen_ids = load_seen_ids()
    for job in deduped:
        job["id"] = make_job_id(job)
        job["isNew"] = job["id"] not in seen_ids
        job["source"] = "Web Search (Claude)"

    new_count = sum(1 for j in deduped if j["isNew"])
    print(f"{new_count} jobs are new since last run")

    save_seen_ids(seen_ids | {j["id"] for j in deduped})

    deduped.sort(key=lambda j: -j.get("fitScore", 0))
    with open(OUTPUT_PATH, "w") as f:
        json.dump(
            {"jobs": deduped, "lastUpdated": datetime.now(timezone.utc).isoformat()},
            f,
            indent=2,
            ensure_ascii=False,
        )
    print(f"\nDone. Wrote {len(deduped)} jobs to {OUTPUT_PATH}")

    if len(deduped) == 0:
        print("\n⚠ WARNING: zero jobs found. This could mean:")
        print("  - web_search tool isn't returning usable results for these queries")
        print("  - Claude's JSON formatting didn't match expectations (check raw API responses)")
        print("  - Genuinely no fresh postings matched (less likely with 4 broad queries)")
        sys.exit(1)


if __name__ == "__main__":
    main()
