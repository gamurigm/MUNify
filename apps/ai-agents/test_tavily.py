import os
from dotenv import load_dotenv
load_dotenv(".env")
from tavily import TavilyClient
t = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
r = t.search(query="Norway UN human rights", max_results=3)
print(f"{len(r['results'])} resultados:")
for x in r["results"]:
    print(f"  {x['title'][:70]}")
