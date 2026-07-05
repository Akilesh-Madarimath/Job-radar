TITLE_SCORES = {
    "data scientist": 30,
    "machine learning": 25,
    "ml engineer": 25,
    "ai engineer": 25,
    "artificial intelligence": 25,
    "data engineer": 20,
    "data analyst": 20,
    "analytics engineer": 20,
    "python": 15,
    "genai": 20,
    "llm": 20,
    "computer vision": 20,
    "nlp": 20
}

LOCATION_SCORES = {
    "bangalore": 20,
    "bengaluru": 20,
    "hyderabad": 20,
    "pune": 18,
    "chennai": 18,
    "gurugram": 18,
    "noida": 18,
    "india": 20,
    "remote": 10
}

NEGATIVE_WORDS = [
    "senior",
    "principal",
    "director",
    "vp",
    "head",
    "lead"
]


def calculate_score(job):

    score = 0

    title = job.get("title", "").lower()
    location = job.get("location", "").lower()

    # Score title
    for keyword, points in TITLE_SCORES.items():
        if keyword in title:
            score += points

    # Score location
    for keyword, points in LOCATION_SCORES.items():
        if keyword in location:
            score += points

    # Penalize senior roles
    for word in NEGATIVE_WORDS:
        if word in title:
            score -= 20

    return max(score, 0)