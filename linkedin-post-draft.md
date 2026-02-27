# LinkedIn Article Draft
## How I Extracted 91 LinkedIn Articles in Under an Hour with AI

---

**Post this on LinkedIn as an article or long-form post:**

---

I had 91 articles trapped inside LinkedIn. Six years of writing about philosophy, technology, data architecture, and AI — all locked behind a platform I don't control.

So I broke them free. In under an hour.

Here's what happened.

### The Problem

LinkedIn lets you export your data (Settings > Data Privacy > Get a copy of your data). What you get is a zip file of raw HTML files — one per article. The markup is LinkedIn's proprietary format: inconsistent class names, embedded styles, metadata scattered everywhere.

It's your data, technically. But it's not *usable* data.

### The Solution: Claude + Python + GitHub Pages

I used Claude (Anthropic's AI) as my co-pilot for the entire migration:

**1. Parse** — Claude wrote a custom Python HTML parser that handles LinkedIn's messy export format. It extracts titles, dates, hero images, and full article content.

**2. Clean & Categorize** — The pipeline strips empty paragraphs, removes LinkedIn hashtag spam, and auto-categorizes every article into topics (AI, Philosophy, Technology) using keyword matching.

**3. Generate** — Claude didn't just dump content into plain HTML. It generated a complete website with horizontal-scrolling cards, reading progress bars, responsive design, and a literary aesthetic. 91 perfectly formatted pages.

**4. Deploy** — Static HTML + CSS on GitHub Pages. No frameworks. No build tools. No dependencies. Push to GitHub, enable Pages, done.

paddyspeaks.com was live.

### The Numbers

📄 91 articles extracted
⏱️ Under 1 hour total
🔧 2 Python scripts + 1 CSS file
📦 0 frameworks used
💰 $0 hosting cost (GitHub Pages)

### What Surprised Me

The speed was obvious. But what surprised me was the *quality of judgment*:

- It correctly categorized articles about the Bhagavad Gita under Philosophy and data mesh articles under Technology — without me labeling a single one
- It handled edge cases (no dates, duplicate filenames, malformed HTML) without breaking
- It designed a consistent aesthetic across 91 pages that looked like a human designer spent days on it

This wasn't "AI generates slop." This was genuine collaboration. I provided vision and direction. Claude handled the tedious, error-prone work.

### The Bigger Point

This is what AI should be. Not replacing your thinking — **amplifying your ability to act on it**.

I'd been meaning to do this for years. The thought of manually migrating 91 articles always felt like a project that would stretch into weeks. So I never did it.

With Claude, I went from "I should do this someday" to "it's live" in under an hour.

### Your Turn

1. Export your LinkedIn data (Settings > Data Privacy > Get a copy of your data)
2. Use an AI assistant to parse and transform the HTML
3. Deploy on GitHub Pages — free hosting, custom domain, zero maintenance

The entire pipeline is open source. Two Python scripts and a CSS file. No React. No Next.js. No npm install downloading half the internet.

**Your words deserve a home you own.**

Six years. Ninety-one articles. One hour. One AI. Zero excuses.

→ paddyspeaks.com

---

#AI #Claude #Anthropic #ContentCreation #GitHubPages #LinkedIn #Writing #WebDevelopment #Python #OpenSource
