import requests


def fetch_jobs():
    url = "https://remotive.com/api/remote-jobs"

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()

        data = response.json()

        jobs = []

        for job in data.get("jobs", []):
            jobs.append({
                "title": job.get("title", ""),
                "company": job.get("company_name", ""),
                "location": job.get("candidate_required_location", "Remote"),
                "url": job.get("url", ""),
                "salary": job.get("salary", "Not specified"),
                "experience": "Not specified",
                "fitScore": 80,
                "category": "Remote",
                "isNew": True,
                "source": "Remotive"
            })

        print(f"Remotive: {len(jobs)} jobs")
        return jobs

    except Exception as e:
        print("Remotive Error:", e)
        return []