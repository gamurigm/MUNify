
import requests
import os
import json

# Top 100 most representative countries (approx by GDP/Population/UN relevance)
COUNTRIES = {
    "us": "United States", "cn": "China", "jp": "Japan", "de": "Germany", "in": "India",
    "gb": "United Kingdom", "fr": "France", "br": "Brazil", "it": "Italy", "ca": "Canada",
    "ru": "Russia", "kr": "South Korea", "au": "Australia", "es": "Spain", "mx": "Mexico",
    "id": "Indonesia", "nl": "Netherlands", "sa": "Saudi Arabia", "tr": "Turkey", "ch": "Switzerland",
    "ar": "Argentina", "ae": "United Arab Emirates", "vn": "Vietnam", "th": "Thailand", "be": "Belgium",
    "se": "Sweden", "at": "Austria", "no": "Norway", "dk": "Denmark", "fi": "Finland",
    "pl": "Poland", "eg": "Egypt", "za": "South Africa", "ng": "Nigeria", "il": "Israel",
    "sg": "Singapore", "my": "Malaysia", "pk": "Pakistan", "ir": "Iran", "iq": "Iraq",
    "cl": "Chile", "co": "Colombia", "pe": "Peru", "ve": "Venezuela", "ua": "Ukraine",
    "gr": "Greece", "pt": "Portugal", "cz": "Czech Republic", "hu": "Hungary", "ro": "Romania",
    "ie": "Ireland", "nz": "New Zealand", "pk": "Pakistan", "bd": "Bangladesh", "ph": "Philippines",
    "kz": "Kazakhstan", "qa": "Qatar", "kw": "Kuwait", "dz": "Algeria", "ma": "Morocco",
    "il": "Israel", "jo": "Jordan", "lb": "Lebanon", "sy": "Syria", "ye": "Yemen",
    "pk": "Pakistan", "af": "Afghanistan", "uz": "Uzbekistan", "lk": "Sri Lanka", "mm": "Myanmar",
    "kh": "Cambodia", "la": "Laos", "kp": "North Korea", "mn": "Mongolia", "cu": "Cuba",
    "pa": "Panama", "cr": "Costa Rica", "do": "Dominican Republic", "ec": "Ecuador", "uy": "Uruguay",
    "et": "Ethiopia", "ke": "Kenya", "gh": "Ghana", "sn": "Senegal", "tz": "Tanzania",
    "ug": "Uganda", "ao": "Angola", "ci": "Ivory Coast", "cm": "Cameroon", "sd": "Sudan",
    "cu": "Cuba", "jm": "Jamaica", "ht": "Haiti", "sv": "El Salvador", "gt": "Guatemala",
    "hn": "Honduras", "ni": "Nicaragua", "bo": "Bolivia", "py": "Paraguay", "sr": "Suriname",
    "is": "Iceland", "lu": "Luxembourg", "mt": "Malta", "cy": "Cyprus"
}

OUTPUT_DIR = "apps/web-ui/public/flags"

def download_flags():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        
    print(f"Downloading {len(COUNTRIES)} flags...")
    
    for code, name in COUNTRIES.items():
        url = f"https://flagcdn.com/w160/{code}.png"
        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                with open(os.path.join(OUTPUT_DIR, f"{code}.png"), "wb") as f:
                    f.write(response.content)
                print(f" [OK] {name} ({code})")
            else:
                print(f" [FAIL] {name} ({code}) - Status: {response.status_code}")
        except Exception as e:
            print(f" [ERROR] {name} ({code}) - {e}")

if __name__ == "__main__":
    download_flags()
