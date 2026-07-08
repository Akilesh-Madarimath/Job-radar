import os
import requests

SEARCH_ROLES = [
    "Data Scientist",
    "Data Analyst",
    "Machine Learning Engineer",
    "AI Engineer",
    "Python Developer",
    "Business Analyst"
]


def fetch_jobs():
    APP_ID = os.getenv("ADZUNA_APP_ID")
    APP_KEY = os.getenv("ADZUNA_APP_KEY")

    if not APP_ID or not APP_KEY:
        print("Adzuna credentials not found.")
        return []

    jobs = []

    for role in SEARCH_ROLES:
        try:
            print(f"Searching Adzuna for: {role}")

            url = (
                f"https://api.adzuna.com/v1/api/jobs/in/search/1"
                f"?app_id={APP_ID}"
                f"&app_key={APP_KEY}"
                f"&results_per_page=50"
                f"&what={role}"
                f"&content-type=application/json"
            )

            response = requests.get(url, timeout=20)
            response.raise_for_status()

            data = response.json()

            for job in data.get("results", []):
                jobs.append({
                    "title": job.get("title", ""),
                    "company": job.get("company", {}).get("display_name", "Unknown"),
                    "location": job.get("location", {}).get("display_name", ""),
                    "url": job.get("redirect_url", ""),
                    "salary": job.get("salary_min", "Not specified"),
                    "experience": "Not specified",
                    "fitScore": 80,
                    "category": "High",
                    "isNew": True,
                    "source": "Adzuna"
                })

        except Exception as e:
            print(f"Adzuna search failed for '{role}': {e}")
            continue

    # Remove duplicates
    unique = {}

    for job in jobs:
        key = (
            job["title"].strip().lower(),
            job["company"].strip().lower(),
            job["location"].strip().lower()
        )

        if key not in unique:
            unique[key] = job

    jobs = list(unique.values())

    print(f"Adzuna: {len(jobs)} jobs")

    return jobs