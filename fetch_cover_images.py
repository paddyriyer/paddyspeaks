#!/usr/bin/env python3
"""
Fetch actual cover images from live LinkedIn article pages via og:image meta tags.

LinkedIn article exports contain cover image URLs in the OLD CDN format (expired/404).
But the live article pages have working og:image URLs with long expiry.
This script fetches those URLs and downloads the actual cover images.
"""

import os
import re
import json
import hashlib
import html
import time
import urllib.request
import urllib.error

SOURCE_DIR = "/home/user/paddyspeaks/Articles/Articles"
IMAGE_DIR = "/home/user/paddyspeaks/images/articles"
MAPPING_FILE = "/home/user/paddyspeaks/image_mapping.json"
COVER_CACHE = "/home/user/paddyspeaks/cover_image_cache.json"


def get_article_slug(filename):
    """Generate a slug from a LinkedIn article filename."""
    name = filename.replace('.html', '')
    name = re.sub(r'-(?:paddy-)?iyer-[a-z0-9]+$', '', name)
    name = re.sub(r'-paddy-iyer$', '', name)
    return name


def get_linkedin_url(filename):
    """Convert HTML filename to LinkedIn article URL."""
    slug = filename.replace('.html', '')
    return f"https://www.linkedin.com/pulse/{slug}"


def fetch_og_image(url, retries=3):
    """Fetch the og:image URL from a LinkedIn article page."""
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                              'AppleWebKit/537.36 (KHTML, like Gecko) '
                              'Chrome/120.0.0.0 Safari/537.36'
            })
            with urllib.request.urlopen(req, timeout=30) as response:
                page_html = response.read().decode('utf-8', errors='ignore')
                # Extract og:image content
                match = re.search(
                    r'<meta\s+property="og:image"\s+content="([^"]+)"',
                    page_html
                )
                if match:
                    return html.unescape(match.group(1))
                return None
        except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                print(f"  FAILED to fetch page: {e}")
                return None
    return None


def detect_image_format(data):
    """Detect image format from file magic bytes."""
    if data[:4] == b'\x89PNG':
        return '.png'
    elif data[:2] == b'\xff\xd8':
        return '.jpg'
    elif data[:4] == b'GIF8':
        return '.gif'
    elif data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return '.webp'
    return '.jpg'


def download_image(url, filepath_base, retries=3):
    """Download an image. Returns (size, actual_filepath)."""
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
            })
            with urllib.request.urlopen(req, timeout=30) as response:
                data = response.read()
                ext = detect_image_format(data)
                filepath = os.path.splitext(filepath_base)[0] + ext
                with open(filepath, 'wb') as f:
                    f.write(data)
                return len(data), filepath
        except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                print(f"  FAILED download: {e}")
                return 0, None
    return 0, None


def main():
    # Load existing mapping
    if os.path.exists(MAPPING_FILE):
        with open(MAPPING_FILE, 'r') as f:
            mapping = json.load(f)
    else:
        mapping = {}

    # Load cover cache (to avoid re-fetching pages we've already checked)
    cover_cache = {}
    if os.path.exists(COVER_CACHE):
        with open(COVER_CACHE, 'r') as f:
            cover_cache = json.load(f)

    html_files = sorted([f for f in os.listdir(SOURCE_DIR) if f.endswith('.html')])

    total = len(html_files)
    fetched = 0
    downloaded = 0
    no_cover = 0
    already_have = 0
    failed = 0

    for idx, html_file in enumerate(html_files):
        slug = get_article_slug(html_file)
        article_image_dir = os.path.join(IMAGE_DIR, slug)

        # Check if we already have a cover image for this article
        existing_cover = None
        if os.path.exists(article_image_dir):
            for f in os.listdir(article_image_dir):
                if f.startswith('cover-'):
                    existing_cover = f
                    break

        if existing_cover:
            already_have += 1
            continue

        linkedin_url = get_linkedin_url(html_file)

        # Check cache first
        if html_file in cover_cache:
            og_url = cover_cache[html_file]
        else:
            print(f"[{idx+1}/{total}] Fetching: {slug}")
            og_url = fetch_og_image(linkedin_url)
            cover_cache[html_file] = og_url
            fetched += 1
            # Rate limit: be respectful
            time.sleep(1)

        if not og_url:
            no_cover += 1
            continue

        # Check if this is actually a cover image (not a default LinkedIn image)
        if 'article-cover_image' not in og_url and 'article-inline' not in og_url:
            # Might be a default LinkedIn placeholder
            no_cover += 1
            continue

        # Download the cover image
        os.makedirs(article_image_dir, exist_ok=True)
        url_hash = hashlib.md5(og_url.encode()).hexdigest()[:8]
        save_path = os.path.join(article_image_dir, f"cover-{url_hash}.jpg")

        size, actual_path = download_image(og_url, save_path)
        if size > 0 and actual_path:
            downloaded += 1
            actual_filename = os.path.basename(actual_path)

            # Update mapping
            if html_file not in mapping:
                mapping[html_file] = {'slug': slug, 'images': []}

            # Remove old hero entry, add new cover
            images = mapping[html_file]['images']
            # Mark old hero as inline if it exists
            for img in images:
                if img.get('type') == 'hero':
                    img['type'] = 'inline'

            # Add new cover image at the beginning
            images.insert(0, {
                'filename': actual_filename,
                'type': 'hero',
                'alt': '',
                'path': os.path.relpath(actual_path, '/home/user/paddyspeaks')
            })

            if downloaded % 10 == 0:
                print(f"  Progress: {downloaded} covers downloaded...")
        else:
            failed += 1

        # Save cache periodically
        if (idx + 1) % 20 == 0:
            with open(COVER_CACHE, 'w') as f:
                json.dump(cover_cache, f, indent=2)

    # Save final cache and mapping
    with open(COVER_CACHE, 'w') as f:
        json.dump(cover_cache, f, indent=2)

    with open(MAPPING_FILE, 'w') as f:
        json.dump(mapping, f, indent=2)

    print(f"\n{'='*50}")
    print(f"DONE!")
    print(f"Total articles: {total}")
    print(f"Pages fetched: {fetched}")
    print(f"Covers downloaded: {downloaded}")
    print(f"Already had cover: {already_have}")
    print(f"No cover image: {no_cover}")
    print(f"Failed: {failed}")
    print(f"Mapping updated: {MAPPING_FILE}")


if __name__ == '__main__':
    main()
