#!/usr/bin/env python3
"""
Download all images from LinkedIn article HTML exports.
Maps each image to its source article and saves with organized naming.
"""

import os
import re
import hashlib
import json
import urllib.request
import urllib.error
import html
import time
from html.parser import HTMLParser

SOURCE_DIR = "/tmp/linkedin_export/Articles/Articles"
IMAGE_DIR = "/home/user/paddyspeaks/images/articles"
MAPPING_FILE = "/home/user/paddyspeaks/image_mapping.json"


class ImageExtractor(HTMLParser):
    """Extract image URLs and their context from LinkedIn HTML."""

    def __init__(self):
        super().__init__()
        self.images = []  # list of {url, alt, type}
        self.in_cover = False
        self.first_image = True
        self.tag_stack = []

    def handle_starttag(self, tag, attrs):
        self.tag_stack.append(tag)
        if tag == 'img':
            attr_dict = dict(attrs)
            src = attr_dict.get('src', '')
            if 'media.licdn.com' in src:
                # Decode HTML entities
                src = html.unescape(src)
                img_type = 'hero' if self.first_image else 'inline'
                self.images.append({
                    'url': src,
                    'alt': attr_dict.get('alt', ''),
                    'type': img_type
                })
                self.first_image = False

    def handle_endtag(self, tag):
        if self.tag_stack and self.tag_stack[-1] == tag:
            self.tag_stack.pop()


def get_article_slug(filename):
    """Generate a slug from a LinkedIn article filename."""
    # Remove the LinkedIn suffix (e.g., -paddy-iyer-abc123.html)
    name = filename.replace('.html', '')
    # Remove common suffixes
    name = re.sub(r'-(?:paddy-)?iyer-[a-z0-9]+$', '', name)
    name = re.sub(r'-paddy-iyer$', '', name)
    return name


def download_image(url, filepath, retries=3):
    """Download an image with retry logic."""
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
            })
            with urllib.request.urlopen(req, timeout=30) as response:
                data = response.read()
                with open(filepath, 'wb') as f:
                    f.write(data)
                return len(data)
        except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                print(f"  FAILED: {e}")
                return 0
    return 0


def main():
    os.makedirs(IMAGE_DIR, exist_ok=True)

    mapping = {}  # article_filename -> [list of image info]
    total_images = 0
    downloaded = 0
    failed = 0
    skipped = 0

    # Process each article HTML file
    html_files = sorted([f for f in os.listdir(SOURCE_DIR) if f.endswith('.html')])

    for html_file in html_files:
        filepath = os.path.join(SOURCE_DIR, html_file)
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        parser = ImageExtractor()
        parser.feed(content)

        if not parser.images:
            continue

        slug = get_article_slug(html_file)
        article_image_dir = os.path.join(IMAGE_DIR, slug)
        os.makedirs(article_image_dir, exist_ok=True)

        article_images = []

        for i, img in enumerate(parser.images):
            total_images += 1

            # Generate filename
            url_hash = hashlib.md5(img['url'].encode()).hexdigest()[:8]
            if img['type'] == 'hero' and i == 0:
                filename = f"hero-{url_hash}.jpg"
            else:
                filename = f"img-{i:02d}-{url_hash}.jpg"

            save_path = os.path.join(article_image_dir, filename)

            # Skip if already downloaded
            if os.path.exists(save_path) and os.path.getsize(save_path) > 0:
                skipped += 1
                article_images.append({
                    'filename': filename,
                    'type': img['type'],
                    'alt': img['alt'],
                    'path': os.path.relpath(save_path, '/home/user/paddyspeaks')
                })
                continue

            # Download
            size = download_image(img['url'], save_path)
            if size > 0:
                downloaded += 1
                article_images.append({
                    'filename': filename,
                    'type': img['type'],
                    'alt': img['alt'],
                    'path': os.path.relpath(save_path, '/home/user/paddyspeaks')
                })
                if downloaded % 20 == 0:
                    print(f"  Progress: {downloaded} downloaded, {failed} failed, {skipped} skipped...")
            else:
                failed += 1

        if article_images:
            mapping[html_file] = {
                'slug': slug,
                'images': article_images
            }

    # Save mapping
    with open(MAPPING_FILE, 'w') as f:
        json.dump(mapping, f, indent=2)

    print(f"\n{'='*50}")
    print(f"DONE!")
    print(f"Total images found: {total_images}")
    print(f"Downloaded: {downloaded}")
    print(f"Skipped (already existed): {skipped}")
    print(f"Failed: {failed}")
    print(f"Articles with images: {len(mapping)}")
    print(f"Mapping saved to: {MAPPING_FILE}")


if __name__ == '__main__':
    main()
