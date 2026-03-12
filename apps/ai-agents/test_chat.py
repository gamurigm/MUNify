import requests
res = requests.post("http://localhost:8000/api/v1/chat", json={
    "messages": [{"role": "user", "text": "hola"}],
    "topic": "Cambio climatico",
    "country": "Mexico",
    "committee": "UNSC"
})
print(res.status_code)
print(res.text)
