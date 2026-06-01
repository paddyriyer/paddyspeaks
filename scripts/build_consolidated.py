#!/usr/bin/env python3
"""
Produce a CONSOLIDATED, self-contained data-modeling.html:
  - the studio experience (cards / tabs / compare / dark mode) with all 20
    scenarios' content baked in (from data-modeling.studio.html), and
  - the ORIGINAL data-modeling.html's SEO <head> (title, canonical, OG,
    Twitter, Schema.org, robots=index, favicons), so ranking is preserved.

De-prototyped: no `noindex`, no `.studio` URL, no "PROTOTYPE" flag, no
self-referencing "Full write-up" links, no prototype footnote.

Output is written to a candidate path; it does NOT overwrite the live file.
The intended use: replace interview.app/design/data-modeling.html with it.
"""
import re, pathlib

HERE   = pathlib.Path(__file__).resolve().parent.parent
STUDIO = HERE / "interview.app/design/data-modeling.studio.html"
ORIG   = HERE / "interview.app/design/data-modeling.html"
OUT    = HERE / "interview.app/design/_consolidated-data-modeling.html"

studio = STUDIO.read_text(encoding="utf-8")
orig   = ORIG.read_text(encoding="utf-8")

# ---- 1. SEO head from the original (keep meta/title/canonical/og/twitter/schema/favicons) ----
orig_head = re.search(r"<head>(.*?)</head>", orig, re.S).group(1)
keep = orig_head
keep = re.sub(r'<meta charset[^>]*>\s*', '', keep, flags=re.I)
keep = re.sub(r'<meta name="viewport"[^>]*>\s*', '', keep, flags=re.I)
keep = re.sub(r'<meta name="color-scheme"[^>]*>\s*', '', keep, flags=re.I)
keep = re.sub(r'<link[^>]*rel="stylesheet"[^>]*>\s*', '', keep, flags=re.I)
keep = re.sub(r'<link[^>]*href="https://fonts\.[^"]*"[^>]*>\s*', '', keep, flags=re.I)
keep = re.sub(r'<link rel="preconnect"[^>]*>\s*', '', keep, flags=re.I)
keep = re.sub(r'<style>.*?</style>', '', keep, flags=re.S)
keep = re.sub(r'\n\s*\n', '\n', keep).strip()

# ---- 2. Studio design system: preconnects + font stylesheet + the scoped <style> ----
studio_head = re.search(r"<head>(.*?)</head>", studio, re.S).group(1)
preconnect = re.findall(r'<link rel="preconnect"[^>]*>', studio_head)
fonts      = re.findall(r'<link[^>]*href="https://fonts\.googleapis\.com/css2[^"]*"[^>]*>', studio_head)
style      = re.search(r"<style>.*?</style>", studio_head, re.S).group(0)

head_top = ('<meta charset="UTF-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
            '<meta name="color-scheme" content="light dark">')
new_head = "<head>\n" + head_top + "\n" + keep + "\n" + "\n".join(preconnect + fonts) + "\n" + style + "\n</head>"

# ---- 3. Studio body, de-prototyped ----
body = re.search(r"<body>(.*)</body>", studio, re.S).group(1)
body = body.replace('<span class="proto-flag">PROTOTYPE</span>', '')
body = re.sub(r'\s*<a class="btn" href="data-modeling\.html#[^"]+">Full write-up[^<]*</a>', '', body)
body = body.replace('Interview Studio · Design · a PaddySpeaks prototype',
                    'Interview Studio · Design · PaddySpeaks')
body = re.sub(r'<p class="footnote" id="footnote">.*?</p>', '', body, flags=re.S)
# JS: drop the compare "Full write-up" link and stop overriding the SEO <title>
body = re.sub(r"\s*p\.push\('<a class=\"btn\" href=\"data-modeling\.html#'\+id\+'\">Full write-up ↗</a>'\);", '', body)
body = re.sub(r'\s*document\.title = "Data Modeling Studio \(prototype\) · PaddySpeaks";', '', body)

out = ('<!DOCTYPE html>\n<html lang="en" data-theme="">\n'
       + new_head + "\n<body>" + body + "</body>\n</html>\n")
OUT.write_text(out, encoding="utf-8")
print("wrote %s  (%d KB)" % (OUT.name, len(out) // 1024))
