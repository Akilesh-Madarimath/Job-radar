import requests

URL = "https://remoteok.com/api"

KEYWORDS = [
    "data scientist",
    "data analyst",
    "machine learning",
    "ml engineer",
    "ai engineer",
    "artificial intelligence",
    "python developer",
    "data engineer",
    "business intelligence",
    "analytics engineer",
    "genai",
    "llm",
    "deep learning",
    "computer vision",
    "nlp"
]


def fetch_jobs():

    headers = {
        "User-Agent": "Mozilla/5.0"
    }

    try:
        response = requests.get(URL, headers=headers, timeout=15)
        response.raise_for_status()
        data = response.json()

    except requests.exceptions.RequestException as e:
        print(f"RemoteOK unavailable: {e}")
        return []

    jobs = []

    # First element is metadata
    for job in data[1:]:

        title = job.get("position", "").lower()

        if any(keyword in title for keyword in KEYWORDS):

            jobs.append({
                "title": job.get("position", ""),
                "company": job.get("company", ""),
                "location": job.get("location", "Remote"),
                "url": job.get("url", ""),
                "salary": "Not specified",
                "experience": "Not specified",
                "source": "RemoteOK"
            })

    return jobs