#!/usr/bin/env python3
"""
Add "You Might Also Enjoy" related articles section to every article HTML file.
Deterministic selection based on filename hash. Skips articles that already have
the section, and skips articles/index.html.
"""

import json
import os
import re
import hashlib

ARTICLES_DIR = os.path.join(os.path.dirname(__file__), '..', 'articles')
METADATA_FILE = os.path.join(os.path.dirname(__file__), '..', 'article_metadata.json')

# Number of related articles to show
NUM_RELATED = 3


def load_metadata():
    with open(METADATA_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def extract_category_from_html(filepath):
    """Extract category from <span class="tag">CATEGORY</span> in the HTML."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    match = re.search(r'<span\s+class="tag"[^>]*>\s*(\w+)\s*</span>', content)
    if match:
        return match.group(1).lower()
    return None


def deterministic_select(seed_str, candidates, count):
    """Select `count` items from candidates deterministically using a hash seed."""
    if len(candidates) <= count:
        return candidates[:]
    # Create a deterministic ordering by hashing seed + candidate slug
    scored = []
    for c in candidates:
        h = hashlib.sha256((seed_str + '|' + c['slug']).encode()).hexdigest()
        scored.append((h, c))
    scored.sort(key=lambda x: x[0])
    return [item for _, item in scored[:count]]


def build_related_html(related_articles):
    """Build the HTML for the related articles section."""
    cards = []
    for art in related_articles:
        slug = art['slug']
        title = art['title']
        category = art['category']
        cards.append(
            f'    <a href="{slug}" class="related-article-card">\n'
            f'      <span class="related-article-category">{category}</span>\n'
            f'      <span class="related-article-title">{title}</span>\n'
            f'    </a>'
        )
    cards_html = '\n'.join(cards)
    return (
        f'\n<div class="related-articles">\n'
        f'  <h3>You Might Also Enjoy</h3>\n'
        f'  <div class="related-articles-grid">\n'
        f'{cards_html}\n'
        f'  </div>\n'
        f'</div>\n'
    )


def pick_related(current_slug, current_category, all_articles):
    """Pick NUM_RELATED related articles: same category first, then others."""
    # Exclude the current article
    others = [a for a in all_articles if a['slug'] != current_slug]
    same_cat = [a for a in others if a['category'] == current_category]
    diff_cat = [a for a in others if a['category'] != current_category]

    seed = current_slug
    selected = []

    # First, pick from same category
    same_pick = deterministic_select(seed, same_cat, NUM_RELATED)
    selected.extend(same_pick)

    # If not enough, fill from other categories
    if len(selected) < NUM_RELATED:
        remaining = NUM_RELATED - len(selected)
        diff_pick = deterministic_select(seed, diff_cat, remaining)
        selected.extend(diff_pick)

    return selected[:NUM_RELATED]


def process_article(filepath, all_articles, metadata_by_slug):
    """Insert related articles section into a single article file."""
    filename = os.path.basename(filepath)

    # Skip index.html
    if filename == 'index.html':
        return False

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Skip if already has related articles
    if 'related-articles' in content:
        return False

    # Determine category
    slug = filename
    if slug in metadata_by_slug:
        category = metadata_by_slug[slug]['category']
    else:
        category = extract_category_from_html(filepath)
        if not category:
            print(f"  SKIP (no category found): {filename}")
            return False

    # Pick related articles
    related = pick_related(slug, category, all_articles)
    if len(related) < NUM_RELATED:
        print(f"  WARN: Only {len(related)} related articles for {filename}")

    if not related:
        print(f"  SKIP (no related articles): {filename}")
        return False

    related_html = build_related_html(related)

    # Insert before article-share div if present
    share_pattern = r'(<div\s+class="article-share[^"]*")'
    share_match = re.search(share_pattern, content)

    if share_match:
        insert_pos = share_match.start()
        new_content = content[:insert_pos] + related_html + content[insert_pos:]
    else:
        # Insert before footer
        footer_pattern = r'(<!-- FOOTER -->\s*<footer|<footer\s+class="site-footer")'
        footer_match = re.search(footer_pattern, content)
        if footer_match:
            insert_pos = footer_match.start()
            new_content = content[:insert_pos] + related_html + content[insert_pos:]
        else:
            # Last resort: insert before </body>
            body_match = re.search(r'</body>', content)
            if body_match:
                insert_pos = body_match.start()
                new_content = content[:insert_pos] + related_html + content[insert_pos:]
            else:
                print(f"  SKIP (no insertion point): {filename}")
                return False

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

    return True


def main():
    metadata = load_metadata()

    # Build slug -> metadata lookup
    metadata_by_slug = {art['slug']: art for art in metadata}

    # Build full list of articles (from metadata) for linking
    all_articles = []
    for art in metadata:
        all_articles.append({
            'slug': art['slug'],
            'title': art['title'],
            'category': art['category'],
        })

    # Also scan articles/ dir for articles NOT in metadata
    for fname in sorted(os.listdir(ARTICLES_DIR)):
        if not fname.endswith('.html') or fname == 'index.html':
            continue
        if fname not in metadata_by_slug:
            cat = extract_category_from_html(os.path.join(ARTICLES_DIR, fname))
            if cat:
                # Extract title from <h1> tag
                with open(os.path.join(ARTICLES_DIR, fname), 'r', encoding='utf-8') as f:
                    h1_match = re.search(r'<h1[^>]*>(.*?)</h1>', f.read(), re.DOTALL)
                title = h1_match.group(1).strip() if h1_match else fname.replace('.html', '').replace('-', ' ').title()
                all_articles.append({
                    'slug': fname,
                    'title': title,
                    'category': cat,
                })

    print(f"Total articles available for linking: {len(all_articles)}")

    # Process each HTML file
    processed = 0
    skipped = 0
    for fname in sorted(os.listdir(ARTICLES_DIR)):
        if not fname.endswith('.html'):
            continue
        filepath = os.path.join(ARTICLES_DIR, fname)
        if process_article(filepath, all_articles, metadata_by_slug):
            processed += 1
            print(f"  OK: {fname}")
        else:
            skipped += 1

    print(f"\nDone. Processed: {processed}, Skipped: {skipped}")


if __name__ == '__main__':
    main()
