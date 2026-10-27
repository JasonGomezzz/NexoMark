"""Optional post-level Insights; an empty response never implies zero."""
import requests


def lifetime_value(body, metric):
    if not isinstance(body, dict) or 'error' in body or not isinstance(body.get('data'), list):
        return None
    matches = [item for item in body['data'] if isinstance(item, dict)
               and item.get('name') == metric and item.get('period') == 'lifetime']
    if len(matches) != 1:
        return None
    values = matches[0].get('values')
    if not isinstance(values, list) or len(values) != 1 or not isinstance(values[0], dict):
        return None
    return values[0].get('value')


def optional_insight(url, token, metric):
    try:
        response = requests.get(url + '/insights', params={'metric': metric, 'period': 'lifetime'},
            headers={'Authorization': f'Bearer {token}'}, timeout=10, allow_redirects=False)
        response.raise_for_status()
        return lifetime_value(response.json(), metric)
    except (requests.RequestException, ValueError, TypeError, KeyError):
        return None
