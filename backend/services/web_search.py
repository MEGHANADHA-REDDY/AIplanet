import os
import requests

SERPAPI_KEY = os.getenv('SERPAPI_API_KEY')
BRAVE_API_KEY = os.getenv('BRAVE_API_KEY')


def serpapi_search(query, num_results=3):
    if not SERPAPI_KEY:
        raise Exception('SerpAPI key not set in environment.')
    url = 'https://serpapi.com/search.json'
    params = {
        'q': query,
        'api_key': SERPAPI_KEY,
        'num': num_results,
        'engine': 'google',
    }
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    data = resp.json()
    results = []
    for item in data.get('organic_results', [])[:num_results]:
        title = item.get('title')
        snippet = item.get('snippet')
        link = item.get('link')
        results.append(f"{title}: {snippet} ({link})")
    return results


def brave_search(query, num_results=3):
    if not BRAVE_API_KEY:
        raise Exception('Brave API key not set in environment.')
    url = 'https://api.search.brave.com/res/v1/web/search'
    headers = {'Accept': 'application/json', 'X-Subscription-Token': BRAVE_API_KEY}
    params = {'q': query, 'count': num_results}
    resp = requests.get(url, headers=headers, params=params)
    resp.raise_for_status()
    data = resp.json()
    results = []
    for item in data.get('web', {}).get('results', [])[:num_results]:
        title = item.get('title')
        desc = item.get('description')
        url = item.get('url')
        results.append(f"{title}: {desc} ({url})")
    return results


def web_search(query, num_results=3):
    # Try SerpAPI first, then Brave
    try:
        return serpapi_search(query, num_results)
    except Exception as e:
        print(f"SerpAPI failed: {e}")
        try:
            return brave_search(query, num_results)
        except Exception as e2:
            print(f"Brave search failed: {e2}")
            return [] 