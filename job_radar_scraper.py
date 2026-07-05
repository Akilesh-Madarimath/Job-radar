import json
from datetime import datetime, timezone

from scrapers.merge_jobs import merge_jobs
from scrapers.scorer import calculate_score

jobs = merge_jobs()

for job in jobs:
    job["matchScore"] = calculate_score(job)

jobs = sorted(
    jobs,
    key=lambda x: x["matchScore"],
    reverse=True
)

with open("jobs.json", "w", encoding="utf-8") as f:
    json.dump(
        {
            "jobs": jobs,
            "totalJobs": len(jobs),
            "lastUpdated": datetime.now(timezone.utc).isoformat()
        },
        f,
        indent=2,
        ensure_ascii=False
    )

print(f"\nSaved {len(jobs)} jobs into jobs.json")