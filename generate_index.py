#!/usr/bin/env python3
"""Generate updated articles/index.html and index.html with all articles."""

import json
import html
from datetime import datetime

# Load new article metadata
with open("article_metadata.json", "r") as f:
    new_articles = json.load(f)

# Existing manually-crafted articles (keep their original data)
existing_articles = [
    {
        "title": "The Great AI Job Apocalypse: Who Pays the Bills?",
        "date": "2026-02-25T00:00:00",
        "category": "ai",
        "read_time": 6,
        "subtitle": "You cannot fire your customer base and expect quarterly growth",
        "slug": "the-great-ai-job-apocalypse.html",
        "has_image": True,
        "image": "ai-jobless-hero.png",
        "excerpt": "Everyone is screaming that 50% of entry-level jobs will vanish. Fine. But then tell me — who exactly is going to buy the products?",
    },
    {
        "title": "Employee of the Year: The One Who Doesn't Need a Visa, RSUs, or Sleep",
        "date": "2026-02-06T00:00:00",
        "category": "ai",
        "read_time": 25,
        "subtitle": "Anthropic just launched something that might kill half of SaaS",
        "slug": "employee-of-the-year.html",
        "has_image": True,
        "image": "employee-of-year-hero.png",
        "excerpt": "Anthropic just launched something that might kill half of SaaS. This wasn't another AI feature. This was a new kind of worker.",
    },
    {
        "title": "The AI-Era Professional Network That Works",
        "date": "2026-02-15T00:00:00",
        "category": "ai",
        "read_time": 18,
        "subtitle": "LinkedIn is becoming a career landfill. ProveIt is a trust-first career survival system for the AI age.",
        "slug": "proveit-career-survival-platform.html",
        "has_image": True,
        "image": "proveit-hero.png",
        "excerpt": "LinkedIn is becoming a career landfill. ProveIt is a trust-first career survival system for the AI age.",
    },
    {
        "title": "AI Buzzwords Decoded",
        "date": "2026-02-10T00:00:00",
        "category": "technology",
        "read_time": 15,
        "subtitle": "LLMs, RAG, AI Agents, MCP, A2A — explained like you're chatting with a friend",
        "slug": "ai-buzzwords-decoded.html",
        "has_image": True,
        "image": "ai-buzzwords-hero.png",
        "excerpt": "LLMs, RAG, AI Agents, MCP, A2A — explained like you're chatting with a friend, not reading a textbook.",
    },
    {
        "title": "Less is More: The Timeless Wisdom of Breathing",
        "date": "2026-01-27T00:00:00",
        "category": "philosophy",
        "read_time": 22,
        "subtitle": "Your breath determines your life",
        "slug": "less-is-more-breathing.html",
        "has_image": True,
        "image": "breathing-hero.png",
        "excerpt": "Eastern wisdom traditions understood a truth modern science is only now rediscovering: your breath determines your life.",
    },
    {
        "title": "Dharmakshetre, Kurukshetre",
        "date": "2025-01-06T00:00:00",
        "category": "philosophy",
        "read_time": 12,
        "subtitle": "The modern software industry resembles Kurukshetra",
        "slug": "dharmakshetre-kurukshetre.html",
        "has_image": True,
        "image": "dharmakshetre-hero.png",
        "excerpt": "The modern software industry resembles Kurukshetra. Every team needs a Krishna — a guiding force to uphold dharma.",
    },
    {
        "title": "Welcome to PaddySpeaks",
        "date": "2026-02-25T00:00:00",
        "category": "philosophy",
        "read_time": 3,
        "subtitle": "A space where ancient wisdom meets modern technology",
        "slug": "welcome-to-paddyspeaks.html",
        "has_image": False,
        "excerpt": "The beginning of a journey at the intersection of timeless wisdom and the evolving landscape of technology.",
    },
]

# Combine all articles
all_articles = []

# Add existing articles
for a in existing_articles:
    all_articles.append(a)

# Add new articles (avoid duplicates)
existing_slugs = {a["slug"] for a in existing_articles}
for a in new_articles:
    if a["slug"] not in existing_slugs:
        hero = a.get("hero_image", "")
        a["has_image"] = bool(hero)
        a["image"] = hero
        a["excerpt"] = a.get("subtitle", "")
        all_articles.append(a)

# Sort by date (newest first)
def sort_key(a):
    if a["date"]:
        return datetime.fromisoformat(a["date"])
    return datetime(2020, 1, 1)

all_articles.sort(key=sort_key, reverse=True)

CAT_DISPLAY = {
    "ai": "AI &amp; Future",
    "technology": "Technology",
    "philosophy": "Philosophy",
}


def format_date(date_str):
    if not date_str:
        return "2025"
    dt = datetime.fromisoformat(date_str)
    return dt.strftime("%B %d, %Y").replace(" 0", " ")


def format_date_short(date_str):
    if not date_str:
        return "2025"
    dt = datetime.fromisoformat(date_str)
    return dt.strftime("%b %d, %Y").replace(" 0", " ")


def make_card(a, prefix=""):
    """Generate a scroll card for an article."""
    title = html.escape(a["title"])
    excerpt = html.escape(a.get("excerpt", a.get("subtitle", ""))[:120])
    slug = a["slug"]
    date_short = format_date_short(a["date"])
    read_time = a["read_time"]
    cat = CAT_DISPLAY.get(a["category"], "Philosophy")

    if a.get("has_image") and a.get("image"):
        img_path = a['image']
        # If path already includes full relative path (e.g. images/articles/...), use as-is with prefix
        # If it's just a filename (e.g. hero.png), prepend images/
        if not img_path.startswith("images/"):
            img_path = f"images/{img_path}"
        image_html = f'''                <div class="scroll-card-image">
                    <img src="{prefix}{img_path}" alt="{title}" loading="lazy">
                    <span class="scroll-card-tag">{cat}</span>
                </div>'''
    else:
        image_html = f'''                <div class="scroll-card-image scroll-card-placeholder">
                    <div class="scroll-card-placeholder-inner">❧</div>
                    <span class="scroll-card-tag">{cat}</span>
                </div>'''

    return f'''            <a href="{prefix}articles/{slug}" class="scroll-card">
{image_html}
                <div class="scroll-card-body">
                    <h4>{title}</h4>
                    <p>{excerpt}</p>
                    <div class="article-meta">
                        <span>{date_short}</span>
                        <span class="dot"></span>
                        <span>{read_time} min</span>
                    </div>
                </div>
            </a>'''


def make_card_for_index(a):
    """Generate a scroll card for articles/index.html (no prefix needed)."""
    title = html.escape(a["title"])
    excerpt = html.escape(a.get("excerpt", a.get("subtitle", ""))[:120])
    slug = a["slug"]
    date_short = format_date_short(a["date"])
    read_time = a["read_time"]
    cat = CAT_DISPLAY.get(a["category"], "Philosophy")

    if a.get("has_image") and a.get("image"):
        img_path = a['image']
        if img_path.startswith("images/"):
            img_path = "../" + img_path
        else:
            img_path = "../images/" + img_path
        image_html = f'''                <div class="scroll-card-image">
                    <img src="{img_path}" alt="{title}" loading="lazy">
                    <span class="scroll-card-tag">{cat}</span>
                </div>'''
    else:
        image_html = f'''                <div class="scroll-card-image scroll-card-placeholder">
                    <div class="scroll-card-placeholder-inner">❧</div>
                    <span class="scroll-card-tag">{cat}</span>
                </div>'''

    return f'''            <a href="{slug}" class="scroll-card">
{image_html}
                <div class="scroll-card-body">
                    <h4>{title}</h4>
                    <p>{excerpt}</p>
                    <div class="article-meta">
                        <span>{date_short}</span>
                        <span class="dot"></span>
                        <span>{read_time} min</span>
                    </div>
                </div>
            </a>'''


# === Generate articles/index.html ===
featured = all_articles[0]
cards_html = "\n\n".join(make_card_for_index(a) for a in all_articles)

articles_index = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>All Articles — PaddySpeaks</title>
    <meta name="description" content="All articles from PaddySpeaks — insights at the intersection of ancient wisdom, modern technology, and the future of work.">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600&family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,500;0,8..60,600;1,8..60,300;1,8..60,400&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../style.css">
</head>
<body>

<div class="page-frame"></div>

<div class="top-bar">
    <span>Est. 2026</span>
    <span>Philosophy · Technology · Wisdom</span>
    <a href="https://linkedin.com/in/paddyiyer" target="_blank" rel="noopener">LinkedIn ↗</a>
</div>

<header class="masthead">
    <h1><a href="../index.html">Paddy<span>Speaks</span></a></h1>
    <p class="masthead-tagline">Where ancient wisdom meets the architecture of tomorrow</p>
    <div class="masthead-rule"></div>
</header>

<nav class="nav-bar">
    <a href="../index.html" class="active">Journal</a>
    <a href="../index.html#philosophy">Philosophy</a>
    <a href="../index.html#technology">Technology</a>
    <a href="../index.html#ai">AI &amp; Future</a>
    <a href="../index.html#archive">Archive</a>
    <a href="../about.html">About</a>
</nav>

<div class="content">

    <!-- Featured Article -->
    <div class="featured-article">
        <div class="featured-image">
            {'<img src="../' + (featured['image'] if featured['image'].startswith('images/') else 'images/' + featured['image']) + '" alt="' + html.escape(featured['title']) + '" loading="lazy">' if featured.get('image') else '<div class="scroll-card-placeholder-inner" style="font-size:4rem;display:flex;align-items:center;justify-content:center;height:100%">❧</div>'}
        </div>
        <div class="featured-body">
            <div class="featured-label">Latest</div>
            <h2><a href="{featured['slug']}">{html.escape(featured['title'])}</a></h2>
            <p class="featured-excerpt">{html.escape(featured.get('excerpt', ''))}</p>
            <div class="article-meta">
                <span>{format_date(featured['date'])}</span>
                <span class="dot"></span>
                <span>{featured['read_time']} min read</span>
                <span class="dot"></span>
                <span>{CAT_DISPLAY.get(featured['category'], 'Philosophy')}</span>
            </div>
            <a href="{featured['slug']}" class="read-more">Read Article</a>
        </div>
    </div>

    <!-- Pull Quote -->
    <div class="pull-quote-divider">
        <blockquote>"You have the right to perform your duty, but not to the fruits of your actions. Never consider yourself the cause of the results, and never be attached to inaction."</blockquote>
        <cite>— Bhagavad Gita 2.47</cite>
    </div>

    <!-- All Articles — Horizontal Scroll -->
    <div class="section-header">
        <h3>All Writings</h3>
    </div>
    <div class="articles-scroll-wrap">
        <div class="articles-scroll">

{cards_html}

        </div>
    </div>

</div>

<!-- Subscribe -->
<div class="subscribe-section">
    <h3>Stay in the Conversation</h3>
    <p>Occasional dispatches on philosophy, technology, and the spaces between.</p>
    <div class="subscribe-form">
        <input type="email" placeholder="your@email.com" aria-label="Email address">
        <button type="button">Subscribe</button>
    </div>
</div>

<footer class="site-footer">
    <div class="footer-ornament">❧</div>
    <div class="footer-links">
        <a href="https://linkedin.com/in/paddyiyer" target="_blank" rel="noopener">LinkedIn</a>
        <a href="../about.html">About</a>
        <a href="mailto:paddy@paddyspeaks.com">Contact</a>
    </div>
    <p class="footer-copy">© 2026 PaddySpeaks. All rights reserved.</p>
</footer>

</body>
</html>
'''

with open("articles/index.html", "w") as f:
    f.write(articles_index)
print(f"Generated articles/index.html with {len(all_articles)} articles")


# === Generate main index.html (homepage) ===
# Homepage shows featured article + all articles in scroll
homepage_cards = "\n\n".join(make_card(a, prefix="") for a in all_articles)

homepage = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Where Philosophy Meets Technology — PaddySpeaks</title>
    <meta name="description" content="Insights at the intersection of ancient wisdom, modern technology, and the future of work.">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600&family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,500;0,8..60,600;1,8..60,300;1,8..60,400&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
</head>
<body>

<div class="page-frame"></div>

<div class="top-bar">
    <span>Est. 2026</span>
    <span>Philosophy · Technology · Wisdom</span>
    <a href="https://linkedin.com/in/paddyiyer" target="_blank" rel="noopener">LinkedIn ↗</a>
</div>

<header class="masthead">
    <h1><a href="index.html">Paddy<span>Speaks</span></a></h1>
    <p class="masthead-tagline">Where ancient wisdom meets the architecture of tomorrow</p>
    <div class="masthead-rule"></div>
</header>

<nav class="nav-bar">
    <a href="index.html" class="active">Journal</a>
    <a href="index.html#philosophy">Philosophy</a>
    <a href="index.html#technology">Technology</a>
    <a href="index.html#ai">AI &amp; Future</a>
    <a href="index.html#archive">Archive</a>
    <a href="about.html">About</a>
</nav>

<div class="content">

    <!-- Featured Article -->
    <div class="featured-article">
        <div class="featured-image">
            {'<img src="' + (featured['image'] if featured['image'].startswith('images/') else 'images/' + featured['image']) + '" alt="' + html.escape(featured['title']) + '" loading="lazy">' if featured.get('image') else '<div class="scroll-card-placeholder-inner" style="font-size:4rem;display:flex;align-items:center;justify-content:center;height:100%">❧</div>'}
        </div>
        <div class="featured-body">
            <div class="featured-label">Latest</div>
            <h2><a href="articles/{featured['slug']}">{html.escape(featured['title'])}</a></h2>
            <p class="featured-excerpt">{html.escape(featured.get('excerpt', ''))}</p>
            <div class="article-meta">
                <span>{format_date(featured['date'])}</span>
                <span class="dot"></span>
                <span>{featured['read_time']} min read</span>
                <span class="dot"></span>
                <span>{CAT_DISPLAY.get(featured['category'], 'Philosophy')}</span>
            </div>
            <a href="articles/{featured['slug']}" class="read-more">Read Article</a>
        </div>
    </div>

    <!-- Pull Quote -->
    <div class="pull-quote-divider">
        <blockquote>"You have the right to perform your duty, but not to the fruits of your actions. Never consider yourself the cause of the results, and never be attached to inaction."</blockquote>
        <cite>— Bhagavad Gita 2.47</cite>
    </div>

    <!-- All Articles — Horizontal Scroll -->
    <div class="section-header">
        <h3>All Writings</h3>
    </div>
    <div class="articles-scroll-wrap">
        <div class="articles-scroll">

{homepage_cards}

        </div>
    </div>

</div>

<!-- Subscribe -->
<div class="subscribe-section">
    <h3>Stay in the Conversation</h3>
    <p>Occasional dispatches on philosophy, technology, and the spaces between.</p>
    <div class="subscribe-form">
        <input type="email" placeholder="your@email.com" aria-label="Email address">
        <button type="button">Subscribe</button>
    </div>
</div>

<footer class="site-footer">
    <div class="footer-ornament">❧</div>
    <div class="footer-links">
        <a href="https://linkedin.com/in/paddyiyer" target="_blank" rel="noopener">LinkedIn</a>
        <a href="about.html">About</a>
        <a href="mailto:paddy@paddyspeaks.com">Contact</a>
    </div>
    <p class="footer-copy">© 2026 PaddySpeaks. All rights reserved.</p>
</footer>

</body>
</html>
'''

with open("index.html", "w") as f:
    f.write(homepage)
print(f"Generated index.html (homepage) with {len(all_articles)} articles")
