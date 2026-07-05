import requests

COMPANIES = [
    "stripe",
    "grammarly",
    "notion",
    "canva",
    "datadog",
    "ramp",
    "coinbase"
]

KEYWORDS = [
    "data scientist",
    "data analyst",
    "machine learning",
    "ml engineer",
    "ai engineer",
    "data engineer",
    "analytics engineer",
    "python",
]

def fetch_jobs():

    jobs = []

    for company in COMPANIES:

        url = f"https://boards-api.greenhouse.io/v1/boards/{company}/jobs?content=true"

        try:

            response = requests.get(url, timeout=20)

            if response.status_code != 200:
                continue

            data = response.json()

            for job in data.get("jobs", []):

                title = job.get("title", "")

                if not any(k in title.lower() for k in KEYWORDS):
                    continue

                # Location
                location = job.get("location", {}).get("name", "Remote")

                # Description
                description = job.get("content", "")

                # Simple skill extraction
                skills = []

                SKILLS = [
                    "python",
                    "sql",
                    "machine learning",
                    "deep learning",
                    "tensorflow",
                    "keras",
                    "pandas",
                    "numpy",
                    "scikit-learn",
                    "power bi",
                    "tableau",
                    "excel",
                    "genai",
                    "nlp",
                    "flask",
                    "streamlit"
                ]

                desc_lower = description.lower()

                for skill in SKILLS:
                    if skill in desc_lower:
                        skills.append(skill)

                salary = "Not specified"
                experience = "Not specified"

                score = len(skills) * 5

                jobs.append({

                    "title": title,
                    "company": company.title(),
                    "location": location,
                    "description": description,
                    "skills": skills,
                    "salary": salary,
                    "experience": experience,
                    "source": "Greenhouse",
                    "url": job.get("absolute_url", ""),
                    "matchScore": score

                })

        except Exception as e:
            print(company, e)

    return jobs