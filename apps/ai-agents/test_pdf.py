# pyre-ignore-all-errors
import requests
import json
import sys

url = 'http://localhost:8000/api/v1/compile-pdf'
latex = r'''
\documentclass{article}
\usepackage[utf8]{inputenc}
\usepackage[spanish]{babel}
\begin{document}
Hola Mundo MUNify.
\end{document}
'''

try:
    response = requests.post(url, json={'latex': latex}, timeout=60)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        with open('test_output.pdf', 'wb') as f:
            f.write(response.content)
        print("Success: test_output.pdf created.")
    else:
        print(f"Error: {response.text}")
except Exception as e:
    print(f"Exception: {e}")
