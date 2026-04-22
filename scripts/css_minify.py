"""Minimal CSS minifier — strips comments, collapses whitespace.
Safe for the kind of CSS we emit (no nested media query hacks).
"""
import re


def minify(css: str) -> str:
    # Remove /* ... */ comments (non-greedy, multi-line)
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.DOTALL)
    # Collapse whitespace (incl newlines) to single space
    css = re.sub(r"\s+", " ", css)
    # Remove whitespace around : ; { } , (non-string context)
    css = re.sub(r"\s*([{};:,])\s*", r"\1", css)
    # Remove trailing ; before }
    css = re.sub(r";}", "}", css)
    return css.strip()


def minify_inline_style_blocks(html: str) -> str:
    """Find every <style>...</style> block in html and minify its contents."""
    def _sub(m):
        return "<style>" + minify(m.group(1)) + "</style>"
    return re.sub(r"<style[^>]*>(.*?)</style>", _sub, html, flags=re.DOTALL)
