import requests

URL = "https://www.arbeitnow.com/api/job-board-api"

KEYWORDS = [
    "data",
    "scientist",
    "analyst",
    "machine learning",
    "ai",
    "python",
    "genai"
]


def fetch_jobs():
    response = requests.get(URL, timeout=30)
    response.raise_for_status()

    jobs = []

    for job in response.json()["data"]:
        title = job.get("title", "")

        if any(k.lower() in title.lower() for k in KEYWORDS):
            jobs.append({
                "title": title,
                "company": job.get("company_name", ""),
                "location": job.get("location", ""),
                "url": job.get("url", ""),
                "source": "Arbeitnow"
            })

    return jobs