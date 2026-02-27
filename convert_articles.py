#!/usr/bin/env python3
"""
Convert LinkedIn article HTML exports to PaddySpeaks website format.
Extracts title, date, content from LinkedIn HTML and generates
properly formatted PaddySpeaks article pages.
"""

import os
import re
import html
import hashlib
from html.parser import HTMLParser
from datetime import datetime
import json

SOURCE_DIR = "Articles/Articles"
OUTPUT_DIR = "articles"

# Articles already manually created on the site - skip these
EXISTING_ARTICLES = {
    "the-great-ai-job-apocalypse.html",
    "employee-of-the-year.html",
    "ai-buzzwords-decoded.html",
    "proveit-career-survival-platform.html",
    "less-is-more-breathing.html",
    "dharmakshetre-kurukshetre.html",
    "welcome-to-paddyspeaks.html",
    "index.html",
}

# Map LinkedIn filenames to existing site filenames where they overlap
LINKEDIN_TO_EXISTING = {
    "ai-buzzwords-decoded-paddy-iyer-vid8c.html": "ai-buzzwords-decoded.html",
    "ai-era-professional-network-works-paddy-iyer-lqe7c.html": "proveit-career-survival-platform.html",
    "less-more-timeless-wisdom-breathing-paddy-iyer-6tooc.html": "less-is-more-breathing.html",
    "dharmakshetre-kurukshetre-ideological-battles-ethical-paddy-iyer-edulc.html": "dharmakshetre-kurukshetre.html",
    "welcome-employee-year-one-who-doesnt-need-visa-rsus-sleep-paddy-iyer-ykzvc.html": "employee-of-the-year.html",
}

# Category keywords for classification
CATEGORY_RULES = [
    ("ai", [
        "ai ", "ai-", "artificial intelligence", "machine learning", "llm", "agent",
        "genai", "gen ai", "chatbot", "automation", "robot", "agentic",
        "employee of the year", "job apocalypse", "future of work",
        "ai era", "ai age", "ai buzzword"
    ]),
    ("philosophy", [
        "gita", "bhagavad", "ramayana", "dharma", "karma", "vedant", "vedic",
        "frankl", "wisdom", "spiritual", "soul", "meditation", "breathing",
        "prana", "bhaja govindam", "shankara", "ikigai", "stoic",
        "death", "meaning of life", "cry when you die", "fear", "greed",
        "solitude", "self-care", "self care", "chewing", "gratitude",
        "krishna", "arjuna", "sanjaya", "kurukshetra",
        "children", "peace", "mansion", "outburst",
        "enough equation", "12 rules", "psychology of money",
        "chip packet", "every thief", "gossip", "frenemies",
        "one house", "bhaai bahu", "paradox of more",
        "who will cry", "doctor", "unspoken truth"
    ]),
    ("technology", [
        "data ", "data-", "database", "sql", "cloud", "snowflake", "terraform",
        "etl", "mdm", "spark", "mesh", "browser", "dashboard", "email campaign",
        "migration", "analytics", "architecture", "erp", "saas", "infrastructure",
        "big data", "sizing", "catalog", "cleansing", "cohort", "consent",
        "insurance", "healthcare", "wearable", "insulin", "diabetes",
        "chromebook", "macbook", "apple", "youtube",
        "window functions", "aggregates", "data friends",
        "revenue intelligence", "fab", "alerting",
        "comet", "next generation browser",
        "social media", "cookies", "trackers", "targeted ads",
        "uber", "retail", "fashion", "likes shares",
        "linkedin metamorphosis", "aarrr",
        "patient data", "dimensional modeling",
        "information system", "collapse"
    ]),
    ("life", [
        "financial", "india", "bangalore", "bay area", "money",
        "emi", "middle class", "scam", "elder", "senior citizen",
        "covid", "coronavirus", "pandemic", "phone scam",
        "coming back", "reality check", "america",
        "build financial plan", "surviving",
        "startup", "lic", "insurer",
        "staying put", "how can you help",
        "when trust becomes tragedy",
        "win life destroy planet", "mars"
    ]),
]


class LinkedInHTMLParser(HTMLParser):
    """Parse LinkedIn article HTML exports."""

    def __init__(self):
        super().__init__()
        self.title = ""
        self.created_date = ""
        self.published_date = ""
        self.hero_image = ""
        self.content_parts = []

        # State tracking
        self._in_h1 = False
        self._in_h1_a = False
        self._in_created = False
        self._in_published = False
        self._in_content_div = False
        self._div_depth = 0
        self._current_tag = None
        self._current_attrs = {}
        self._skip_style = False
        self._first_img = True
        self._tag_stack = []
        self._content_started = False

        # For content extraction
        self._buffer = []
        self._in_figure = False
        self._in_blockquote = False

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)

        if tag == "style":
            self._skip_style = True
            return

        # Capture hero image (first img before content)
        if tag == "img" and self._first_img and not self._content_started:
            src = attrs_dict.get("src", "")
            if "licdn.com" in src:
                self.hero_image = src
            self._first_img = False

        if tag == "h1":
            self._in_h1 = True
        elif tag == "a" and self._in_h1:
            self._in_h1_a = True

        if tag == "p":
            cls = attrs_dict.get("class", "")
            if cls == "created":
                self._in_created = True
            elif cls == "published":
                self._in_published = True

        # Main content div (the one after published date)
        if tag == "div" and not self._content_started and self.published_date:
            self._content_started = True
            self._in_content_div = True
            self._div_depth = 1
            return

        if self._in_content_div:
            if tag == "div":
                self._div_depth += 1
            # Build content HTML
            if tag == "img":
                src = attrs_dict.get("src", "")
                alt_text = attrs_dict.get("alt", "")
                if "licdn.com" in src or "media.licdn.com" in src:
                    src = html.unescape(src)
                    self._buffer.append(f'<img src="{src}" alt="{html.escape(alt_text)}" loading="lazy">')
                return
            elif tag == "figure" or tag == "figcaption":
                return
            elif tag == "br":
                self._buffer.append("<br>")
                return

            attr_str = ""
            if tag == "a":
                href = attrs_dict.get("href", "")
                target = attrs_dict.get("target", "")
                if href and "linkedin.com/pulse" not in href:
                    attr_str = f' href="{html.escape(href)}"'
                    if target:
                        attr_str += f' target="{target}" rel="noopener"'
            self._buffer.append(f"<{tag}{attr_str}>")

    def handle_endtag(self, tag):
        if tag == "style":
            self._skip_style = False
            return

        if tag == "h1":
            self._in_h1 = False
        if tag == "a" and self._in_h1:
            self._in_h1_a = False

        if self._in_content_div:
            if tag == "div":
                self._div_depth -= 1
                if self._div_depth <= 0:
                    self._in_content_div = False
                    return
            if tag in ("figure", "figcaption", "img"):
                return
            self._buffer.append(f"</{tag}>")

    def handle_data(self, data):
        if self._skip_style:
            return

        if self._in_h1:
            self.title += data
        elif self._in_created:
            self.created_date += data
            self._in_created = False
        elif self._in_published:
            self.published_date += data
            self._in_published = False
        elif self._in_content_div:
            self._buffer.append(html.escape(data))

    def get_content(self):
        return "".join(self._buffer)


def parse_linkedin_html(filepath):
    """Parse a LinkedIn HTML file and return structured data."""
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    parser = LinkedInHTMLParser()
    try:
        parser.feed(content)
    except Exception as e:
        print(f"  Warning: Parse error in {filepath}: {e}")

    # Clean up title
    title = parser.title.strip().strip('"').strip('\u201c\u201d').strip('"').strip("'").strip()
    # Remove unicode bold/italic formatting characters
    cleaned = []
    for ch in title:
        cp = ord(ch)
        # Bold uppercase A-Z: U+1D400 to U+1D419
        if 0x1D400 <= cp <= 0x1D419:
            cleaned.append(chr(ord('A') + cp - 0x1D400))
        # Bold lowercase a-z: U+1D41A to U+1D433
        elif 0x1D41A <= cp <= 0x1D433:
            cleaned.append(chr(ord('a') + cp - 0x1D41A))
        else:
            cleaned.append(ch)
    title = ''.join(cleaned)
    # Remove any remaining surrounding quotes
    title = title.strip('"').strip("'").strip('\u201c\u201d').strip()

    # Parse dates
    date_str = parser.published_date or parser.created_date
    date_match = re.search(r'(\d{4}-\d{2}-\d{2})', date_str)
    pub_date = None
    if date_match:
        try:
            pub_date = datetime.strptime(date_match.group(1), "%Y-%m-%d")
        except ValueError:
            pub_date = None

    raw_content = parser.get_content()

    return {
        "title": title,
        "date": pub_date,
        "hero_image": parser.hero_image,
        "raw_content": raw_content,
    }


def clean_content(raw_content):
    """Clean and improve the extracted content."""
    content = raw_content

    # Remove empty paragraphs
    content = re.sub(r'<p>\s*</p>', '', content)

    # Remove LinkedIn hashtag paragraphs - single hashtag per <p>
    content = re.sub(r'<p>#\w+</p>', '', content)

    # Remove paragraphs that are mostly hashtags (multiple hashtags in one <p>)
    content = re.sub(r'<p>(#\w+\s*)+</p>', '', content)

    # Remove trailing hashtag lines (not in <p> tags)
    content = re.sub(r'(?:#\w+\s*){3,}$', '', content)

    # Clean up excessive whitespace
    content = re.sub(r'\n{3,}', '\n\n', content)

    # Remove empty divs
    content = re.sub(r'<div>\s*</div>', '', content)

    # Remove leading/trailing empty tags
    content = content.strip()

    return content


def extract_first_paragraph_text(content):
    """Extract text from the first paragraph for subtitle/description."""
    match = re.search(r'<p>(.*?)</p>', content, re.DOTALL)
    if match:
        text = re.sub(r'<[^>]+>', '', match.group(1))
        text = html.unescape(text).strip()
        return text
    return ""


def calculate_read_time(content):
    """Estimate read time in minutes based on word count."""
    text = re.sub(r'<[^>]+>', '', content)
    text = html.unescape(text)
    words = len(text.split())
    minutes = max(1, round(words / 200))
    return minutes


def categorize_article(title, content):
    """Categorize article based on title and content keywords."""
    search_text = (title + " " + re.sub(r'<[^>]+>', '', content)).lower()

    scores = {}
    for category, keywords in CATEGORY_RULES:
        score = 0
        for kw in keywords:
            if kw in search_text:
                score += 1
        scores[category] = score

    # Return category with highest score, default to 'philosophy'
    if not any(scores.values()):
        return "philosophy"

    best = max(scores, key=scores.get)
    # Map 'life' to 'philosophy' for the tag display
    if best == "life":
        return "philosophy"
    return best


def generate_slug(title, linkedin_filename):
    """Generate a clean URL slug from the title."""
    # Clean the title for slug generation
    slug = title.lower()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[-\s]+', '-', slug).strip('-')

    # Limit length
    if len(slug) > 60:
        slug = slug[:60].rsplit('-', 1)[0]

    return slug


def format_date(dt):
    """Format datetime as 'Month Day, Year'."""
    if not dt:
        return "2025"
    return dt.strftime("%B %d, %Y").replace(" 0", " ")


def format_date_short(dt):
    """Format datetime as 'Mon DD, YYYY' for cards."""
    if not dt:
        return "2025"
    return dt.strftime("%b %d, %Y").replace(" 0", " ")


def make_subtitle(title, first_para):
    """Generate a subtitle from the first paragraph."""
    if not first_para:
        return ""

    # Skip unhelpful first paragraphs
    skip_patterns = [
        "disclosure:", "disclaimer:", "note:", "editor's note",
        "this article is", "the following", "published on",
    ]
    lower_para = first_para.lower()
    for pattern in skip_patterns:
        if lower_para.startswith(pattern):
            return ""

    # Truncate to a reasonable subtitle length
    if len(first_para) > 120:
        # Try to cut at a sentence boundary
        sentences = re.split(r'[.!?]', first_para)
        if sentences and len(sentences[0].strip()) > 10 and len(sentences[0]) <= 120:
            return sentences[0].strip() + "."
        return first_para[:117].rsplit(' ', 1)[0] + "..."

    return first_para


def make_description(first_para):
    """Generate meta description from first paragraph."""
    if not first_para:
        return ""
    if len(first_para) > 155:
        return first_para[:152].rsplit(' ', 1)[0] + "..."
    return first_para


def load_image_mapping():
    """Load the image mapping JSON file."""
    mapping_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "image_mapping.json")
    if os.path.exists(mapping_path):
        with open(mapping_path, "r") as f:
            return json.load(f)
    return {}


def replace_linkedin_images(content, linkedin_filename, image_mapping):
    """Replace LinkedIn CDN image URLs with local image paths."""
    if linkedin_filename not in image_mapping:
        return content

    article_info = image_mapping[linkedin_filename]
    images = article_info.get("images", [])

    # Build a lookup: MD5 hash of URL -> local path
    def replace_img_src(match):
        url = match.group(1)
        url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
        for img in images:
            if url_hash in img["filename"]:
                local_path = "../" + img["path"]
                return f'src="{local_path}"'
        # If no match found, remove the image (CDN link is dead)
        return match.group(0)

    content = re.sub(r'src="(https://media\.licdn\.com/[^"]*)"', replace_img_src, content)

    # Remove img tags that still point to LinkedIn CDN (failed downloads)
    content = re.sub(r'<img src="https://media\.licdn\.com/[^"]*"[^>]*>', '', content)

    return content


def get_hero_image_path(linkedin_filename, image_mapping):
    """Get the cover/hero image for the article (prefers actual cover over inline)."""
    if linkedin_filename not in image_mapping:
        return None

    images = image_mapping[linkedin_filename].get("images", [])
    # Prefer cover images (fetched from og:image) over inline images
    for img in images:
        if img.get("type") == "hero" and "cover-" in img.get("filename", ""):
            return "../" + img["path"]
    # Fall back to first hero type
    for img in images:
        if img.get("type") == "hero":
            return "../" + img["path"]
    return None


def format_article_content(raw_content):
    """Format the article content for PaddySpeaks, adding drop-cap to first paragraph."""
    content = clean_content(raw_content)

    # Add drop-cap to first paragraph
    content = re.sub(
        r'<p>(.*?)</p>',
        r'<p class="drop-cap">\1</p>',
        content,
        count=1,
    )

    # Format content with proper indentation
    lines = []
    for part in content.split('\n'):
        part = part.strip()
        if part:
            lines.append(f"            {part}")

    return "\n\n".join(lines)


def generate_article_html(article_data, slug):
    """Generate the full PaddySpeaks article HTML page."""
    title = article_data["title"]
    date = article_data["date"]
    category = article_data["category"]
    read_time = article_data["read_time"]
    subtitle = article_data["subtitle"]
    description = article_data["description"]
    formatted_content = article_data["formatted_content"]
    hero_image = article_data.get("hero_image_path", "")

    date_display = format_date(date)

    encoded_title = html.escape(title)
    encoded_desc = html.escape(description)
    url_title = title.replace(' ', '%20')

    hero_image_html = ""
    if hero_image:
        hero_image_html = f'\n<div class="article-hero-image"><img src="{hero_image}" alt="{encoded_title}" loading="lazy"></div>'

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{encoded_title} — PaddySpeaks</title>
    <meta name="description" content="{encoded_desc}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600&amp;family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,500;0,8..60,600;1,8..60,300;1,8..60,400&amp;family=JetBrains+Mono:wght@300;400;500&amp;display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../style.css">
</head>
<body>

<div class="page-frame"></div>
<div class="reading-progress" id="readingProgress"></div>
<div class="top-bar"><span>Est. 2026</span><span>Philosophy · Technology · Wisdom</span><a href="https://linkedin.com/in/paddyiyer" target="_blank" rel="noopener">LinkedIn ↗</a></div>
<header class="masthead"><h1><a href="../index.html">Paddy<span>Speaks</span></a></h1><p class="masthead-tagline">Where ancient wisdom meets the architecture of tomorrow</p>
<div class="masthead-rule"></div>
</header>
<nav class="nav-bar"><a href="../index.html">Journal</a><a href="../index.html#philosophy">Philosophy</a><a href="../index.html#technology">Technology</a><a href="../index.html#ai">AI &amp; Future</a><a href="../index.html#archive">Archive</a><a href="../about.html">About</a></nav>
<div class="article-page">
<a class="back-to-home" href="../index.html">← All Articles</a>
<div>
<div class="article-hero"><span class="tag">{category}</span><h1>{encoded_title}</h1><p class="subtitle">{html.escape(subtitle)}</p>
<div class="article-meta"><span>By Paddy</span><span class="dot"></span><span>{date_display}</span><span class="dot"></span><span>{read_time} min read</span></div>
</div>{hero_image_html}
<div class="article-content">

{formatted_content}

</div>
<div class="article-share article-share--padded"><span>Share</span><a class="share-btn" href="https://twitter.com/intent/tweet?text={url_title}&amp;url=https://paddyspeaks.com/articles/{slug}" target="_blank" rel="noopener">𝕏</a><a class="share-btn" href="https://www.linkedin.com/sharing/share-offsite/?url=https://paddyspeaks.com/articles/{slug}" target="_blank" rel="noopener">in</a></div>
</div>
</div>
<footer class="site-footer">
<div class="footer-ornament">❧</div>
<div class="footer-links"><a href="https://linkedin.com/in/paddyiyer" target="_blank" rel="noopener">LinkedIn</a><a href="../about.html">About</a><a href="mailto:paddy@paddyspeaks.com">Contact</a></div>
<p class="footer-copy">© 2026 PaddySpeaks. All rights reserved.</p></footer>
<script>window.addEventListener('scroll',function(){{var b=document.getElementById('readingProgress');b.style.width=(window.scrollY/(document.documentElement.scrollHeight-window.innerHeight))*100+'%';}});</script>
</body></html>'''


def generate_scroll_card(article, slug):
    """Generate a scroll card for the index page."""
    title = html.escape(article["title"])
    desc = html.escape(article["subtitle"][:120] if article["subtitle"] else "")
    date_short = format_date_short(article["date"])
    read_time = article["read_time"]
    category = article["category"]
    cat_display = {"ai": "AI & Future", "technology": "Technology", "philosophy": "Philosophy", "life": "Life & Society"}.get(category, "Philosophy")

    return f'''            <a href="{slug}" class="scroll-card">
                <div class="scroll-card-image scroll-card-placeholder">
                    <div class="scroll-card-placeholder-inner">❧</div>
                    <span class="scroll-card-tag">{cat_display}</span>
                </div>
                <div class="scroll-card-body">
                    <h4>{title}</h4>
                    <p>{desc}</p>
                    <div class="article-meta">
                        <span>{date_short}</span>
                        <span class="dot"></span>
                        <span>{read_time} min</span>
                    </div>
                </div>
            </a>'''


def main():
    """Main conversion pipeline."""
    source_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), SOURCE_DIR)
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), OUTPUT_DIR)

    os.makedirs(output_dir, exist_ok=True)

    # Load image mapping
    image_mapping = load_image_mapping()
    print(f"Image mapping loaded: {len(image_mapping)} articles with images")

    # Get all LinkedIn HTML files
    linkedin_files = sorted([
        f for f in os.listdir(source_dir)
        if f.endswith('.html')
    ])

    print(f"Found {len(linkedin_files)} LinkedIn article exports")

    all_articles = []
    skipped = 0
    converted = 0
    errors = 0
    images_embedded = 0

    for filename in linkedin_files:
        filepath = os.path.join(source_dir, filename)

        # Skip if already converted
        if filename in LINKEDIN_TO_EXISTING:
            print(f"  SKIP (already exists): {filename} -> {LINKEDIN_TO_EXISTING[filename]}")
            skipped += 1
            continue

        print(f"  Processing: {filename}")

        try:
            data = parse_linkedin_html(filepath)

            if not data["title"]:
                print(f"    WARNING: No title found, using filename")
                data["title"] = filename.replace("-paddy-iyer-", " ").replace(".html", "").replace("-", " ").title()

            if not data["raw_content"] or len(data["raw_content"]) < 50:
                print(f"    WARNING: Very little content extracted ({len(data['raw_content'])} chars)")

            # Generate slug
            slug = generate_slug(data["title"], filename)

            # Check for slug collisions
            output_filename = f"{slug}.html"
            if output_filename in EXISTING_ARTICLES:
                print(f"    SKIP: slug collision with existing article: {output_filename}")
                skipped += 1
                continue

            # Categorize
            category = categorize_article(data["title"], data["raw_content"])

            # Extract first paragraph
            first_para = extract_first_paragraph_text(data["raw_content"])

            # Replace LinkedIn image URLs with local paths
            raw_content_with_images = replace_linkedin_images(
                data["raw_content"], filename, image_mapping
            )

            # Get hero image
            hero_image_path = get_hero_image_path(filename, image_mapping)

            # Count images embedded
            if filename in image_mapping:
                images_embedded += len(image_mapping[filename].get("images", []))

            # Build article data
            article = {
                "title": data["title"],
                "date": data["date"],
                "category": category,
                "read_time": calculate_read_time(raw_content_with_images),
                "subtitle": make_subtitle(data["title"], first_para),
                "description": make_description(first_para),
                "formatted_content": format_article_content(raw_content_with_images),
                "hero_image_path": hero_image_path or "",
                "slug": output_filename,
                "linkedin_source": filename,
            }

            # Generate HTML
            article_html = generate_article_html(article, output_filename)

            # Write output
            output_path = os.path.join(output_dir, output_filename)
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(article_html)

            all_articles.append(article)
            converted += 1
            print(f"    -> {output_filename} [{category}] ({article['read_time']} min)")

        except Exception as e:
            print(f"    ERROR: {e}")
            errors += 1

    # Sort articles by date (newest first)
    all_articles.sort(key=lambda a: a["date"] or datetime(2020, 1, 1), reverse=True)

    # Save article metadata for index generation
    metadata = []
    for a in all_articles:
        # Convert hero image path from article-relative to root-relative
        hero = a.get("hero_image_path", "")
        if hero.startswith("../"):
            hero = hero[3:]  # Remove "../" prefix for root-relative path
        metadata.append({
            "title": a["title"],
            "date": a["date"].isoformat() if a["date"] else None,
            "category": a["category"],
            "read_time": a["read_time"],
            "subtitle": a["subtitle"],
            "slug": a["slug"],
            "hero_image": hero,
        })

    meta_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "article_metadata.json")
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"\n{'='*60}")
    print(f"CONVERSION COMPLETE")
    print(f"  Converted: {converted}")
    print(f"  Skipped:   {skipped}")
    print(f"  Errors:    {errors}")
    print(f"  Images embedded: {images_embedded}")
    print(f"  Total new articles: {len(all_articles)}")
    print(f"\nMetadata saved to: {meta_path}")


if __name__ == "__main__":
    main()
