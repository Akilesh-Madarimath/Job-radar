from scrapers.arbeitnow import fetch_jobs as arbeitnow_jobs
from scrapers.remoteok import fetch_jobs as remoteok_jobs
from scrapers.greenhouse import fetch_jobs as greenhouse_jobs

arbeit = arbeitnow_jobs()
remote = remoteok_jobs()
green = greenhouse_jobs()

print(f"Arbeitnow : {len(arbeit)}")
print(f"RemoteOK  : {len(remote)}")
print(f"Greenhouse: {len(green)}")