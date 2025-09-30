import requests

api_url = "https://www.hvakosterstrommen.no/api/v1/prices/2025/09-30_NO5.json" 

response = requests.get(api_url) 

if response.status_code == 200:
    data = response.json()
    print("API call successful. Data received:")
    print(data)
else:
    print(f"API call failed with status code: {response.status_code}")
    print(f"Error message: {response.text}") 