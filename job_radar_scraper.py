import requests
import json
from datetime import datetime, timezone

URL = "https://www.arbeitnow.com/api/job-board-api"

response = requests.get(URL, timeout=30)
response.raise_for_status()

data = response.json()

jobs = []

keywords = [
    "data",
    "machine learning",
    "ai",
    "python",
    "analytics",
    "scientist",
    "analyst"
]

for job in data["data"]:
    title = job.get("title", "")

    if any(keyword.lower() in title.lower() for keyword in keywords):
        jobs.append({
            "title": title,
            "company": job.get("company_name", ""),
            "location": job.get("location", ""),
            "url": job.get("url", ""),
            "salary": "Not specified",
            "experience": "Not specified",
            "fitScore": 80,
            "category": "High",
            "isNew": True,
            "source": "Arbeitnow"
        })

with open("jobs.json", "w", encoding="utf-8") as f:
    json.dump(
        {
            "jobs": jobs,
            "lastUpdated": datetime.now(timezone.utc).isoformat()
        },
        f,
        indent=2,
        ensure_ascii=False
    )

print(f"Saved {len(jobs)} jobs.")