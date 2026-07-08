from scrapers.arbeitnow import fetch_jobs as arbeitnow_jobs
from scrapers.remoteok import fetch_jobs as remoteok_jobs
from scrapers.greenhouse import fetch_jobs as greenhouse_jobs
from scrapers.remotive import fetch_jobs as remotive_jobs
from scrapers.adzuna import fetch_jobs as adzuna_jobs

def merge_jobs():

    jobs = []

    print("Fetching Arbeitnow...")
    jobs.extend(arbeitnow_jobs())

    print("Fetching RemoteOK...")
    jobs.extend(remoteok_jobs())

    print("Fetching Greenhouse...")
    jobs.extend(greenhouse_jobs())

    print("Fetching Remotive...")
    jobs.extend(remotive_jobs())

    print("Fetching Adzuna...")
    jobs.extend(adzuna_jobs())

    print(f"\nCollected {len(jobs)} jobs")

    unique = {}

    for job in jobs:

        key = (
            job["title"].strip().lower(),
            job["company"].strip().lower()
        )

        if key not in unique:
            unique[key] = job

    merged = list(unique.values())

    print(f"After removing duplicates: {len(merged)}")

    return merged