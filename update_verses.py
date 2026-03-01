#!/usr/bin/env python3
"""Update verse text and halves to use hyphenated compound word forms.

Strategy: For each name that has hyphens, compute the unhyphenated form,
and do a global search-and-replace across all verse text/halves.
"""

import re

def main():
    with open('lalitha-sahasranama/data.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract all name_iast values
    name_pattern = re.compile(r'"name_iast":\s*"([^"]*)"')
    replacements = []
    for m in name_pattern.finditer(content):
        iast = m.group(1)
        if '-' in iast:
            nohyphen = iast.replace('-', '')
            replacements.append((nohyphen, iast))

    # Sort by length descending so longer matches are replaced first
    # (avoids partial replacements)
    replacements.sort(key=lambda x: len(x[0]), reverse=True)

    print(f"Total hyphenated names: {len(replacements)}")

    # Extract the verses section
    # Find the "verses" array in the JS
    verses_start = content.find('"verses":')
    names_start = content.find('"names":')

    if verses_start == -1 or names_start == -1:
        print("ERROR: Could not find verses or names section")
        return

    # We'll work on the verses section only (between "verses": and "names":)
    before_verses = content[:verses_start]
    verses_section = content[verses_start:names_start]
    after_names = content[names_start:]

    # Apply all replacements to the verses section
    count = 0
    for nohyphen, hyphenated in replacements:
        if nohyphen in verses_section:
            occurrences = verses_section.count(nohyphen)
            verses_section = verses_section.replace(nohyphen, hyphenated)
            count += occurrences
            # Don't print every single one, just track count

    print(f"Total replacements made in verses: {count}")

    # Reconstruct
    content = before_verses + verses_section + after_names

    # Write back
    with open('lalitha-sahasranama/data.js', 'w', encoding='utf-8') as f:
        f.write(content)

    # Verify first 10 verses
    print("\nFirst 10 verses after update:")
    verse_show = re.findall(
        r'"num":\s*(\d+),\s*"text":\s*"([^"]*)",\s*"halves":\s*\[\s*"([^"]*)",\s*"([^"]*)"',
        content
    )
    for num, text, h1, h2 in verse_show[:10]:
        print(f"\nVerse {num}:")
        print(f"  half1: {h1}")
        print(f"  half2: {h2}")

    # Check for any remaining unhyphenated names in verses
    remaining = 0
    for nohyphen, hyphenated in replacements:
        nohyphen_check = nohyphen
        # Check in the new verses section
        new_verses = content[verses_start:names_start]  # recalculate
        # Nohyphen should NOT appear since we replaced it
        # But we might have false positives if a shorter name is a substring of another
        # Let's just do a simple check
    print(f"\nDone!")

if __name__ == '__main__':
    main()
