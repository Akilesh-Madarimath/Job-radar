import os
import requests


def fetch_jobs():
    APP_ID = os.getenv("ADZUNA_APP_ID")
    APP_KEY = os.getenv("ADZUNA_APP_KEY")

    if not APP_ID or not APP_KEY:
        print("Adzuna credentials not found.")
        return []

    url = (
        f"https://api.adzuna.com/v1/api/jobs/in/search/1"
        f"?app_id={APP_ID}"
        f"&app_key={APP_KEY}"
        f"&results_per_page=50"
        f"&what=Data%20Scientist%20OR%20Data%20Analyst%20OR%20Machine%20Learning%20Engineer"
        f"&content-type=application/json"
    )

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()

        data = response.json()

        jobs = []

        for job in data.get("results", []):
            jobs.append({
                "title": job.get("title", ""),
                "company": job.get("company", {}).get("display_name", "Unknown"),
                "location": job.get("location", {}).get("display_name", ""),
                "url": job.get("redirect_url", ""),
                "salary": str(job.get("salary_is_predicted", "Not specified")),
                "experience": "Not specified",
                "fitScore": 80,
                "category": "High",
                "isNew": True,
                "source": "Adzuna"
            })

        print(f"Adzuna: {len(jobs)} jobs")
        return jobs

    except Exception as e:
        print("Adzuna Error:", e)
        return []