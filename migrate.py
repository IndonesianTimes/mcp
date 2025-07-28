import json
import logging
import argparse
import re
from pathlib import Path

import requests

logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(message)s')


def sanitize(text: str) -> str:
    text = text.lower().replace(' ', '')
    return re.sub(r'[^a-z0-9_-]+', '', text)


def load_games(path: Path):
    try:
        with path.open('r', encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data, list):
            raise ValueError('JSON must contain a list of games')
        return data
    except Exception as exc:
        logging.error('Failed to load %s: %s', path, exc)
        return []


def to_article(entry: dict) -> dict:
    provider = str(entry.get('provider', '')).strip()
    name = (entry.get('name') or entry.get('game_name') or entry.get('game') or '').strip()
    rtp = entry.get('rtp', '')
    jam = entry.get('jam_gacor', entry.get('jam', ''))
    pola = entry.get('pola_main', entry.get('pola', []))
    if isinstance(pola, str):
        pola_list = [p.strip() for p in pola.split(',') if p.strip()]
    elif isinstance(pola, list):
        pola_list = [str(p).strip() for p in pola if str(p).strip()]
    else:
        pola_list = []
    last_update = entry.get('last_update', entry.get('updated_at', ''))

    article_id = sanitize(f"{provider}_{name}")
    title = f"{name.upper()} dari {provider}".strip()
    pola_str = ', '.join(pola_list)
    content = f"Game ini memiliki RTP sebesar {rtp}%\. Jam gacor: {jam}. Pola umum: [{pola_str}]"

    tags = [provider] + pola_list[:2]

    return {
        'id': article_id,
        'title': title,
        'content': content,
        'tags': tags,
        'category': provider,
        'createdAt': last_update,
        'author': 'auto_scraper'
    }


def send_article(url: str, article: dict, skip_dup: bool = False) -> bool:
    try:
        res = requests.post(url, json=article)
        if res.status_code in (200, 201):
            return True
        if res.status_code == 409 and skip_dup:
            logging.info('Duplicate %s skipped', article['id'])
            return False
        logging.error('Failed to send %s: %s %s', article['id'], res.status_code, res.text)
    except Exception as exc:
        logging.error('Error sending %s: %s', article['id'], exc)
    return False


def main():
    parser = argparse.ArgumentParser(description='Migrate games to MCP KB')
    parser.add_argument('file', help='path to all_games_global.json')
    parser.add_argument('--url', default='http://localhost:3000/articles', help='server endpoint')
    parser.add_argument('--skip-duplicates', action='store_true', help='skip duplicate IDs if server returns 409')
    args = parser.parse_args()

    games = load_games(Path(args.file))
    if not games:
        logging.error('No games loaded')
        return

    success = 0
    total = len(games)
    for i, entry in enumerate(games, 1):
        try:
            art = to_article(entry)
        except Exception as exc:
            logging.error('Failed to convert entry %s: %s', entry, exc)
            continue
        if not art['title'] or len(art['content']) < 50:
            logging.warning('Skipping id %s due to invalid title or content', art['id'])
            continue
        if send_article(args.url, art, args.skip_duplicates):
            success += 1
        logging.info('Processed %d/%d', i, total)

    logging.info('Migration complete: %d/%d articles sent', success, total)


if __name__ == '__main__':
    main()
