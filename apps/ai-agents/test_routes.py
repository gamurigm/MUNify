import requests
res = requests.get("http://localhost:8000/openapi.json")
with open("openapi_resp.json", "w") as f:
    f.write(res.text)
