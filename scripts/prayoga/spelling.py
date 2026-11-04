"""The Taittirīya spelling of the witnesses and the standard spelling the word
division is proven against (used by import.py and check.py)."""
import re
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'upanishads'))
from textlib import strip_accents  # noqa: E402

VOW = 'ा-ौअ-औ'


def plain_ts(dev):
    """The Taittirīya spelling of the witnesses in the standard spelling the word
    division is proven against. Only spelling: check.py requires the result to
    have the same collation skeleton as the base."""
    s = strip_accents(dev).replace('‌', '').replace('‍', '')
    s = s.replace('ᳵ', 'ः').replace('ᳶ', 'ः').replace('ꣳ', 'ं').replace('ऱ', 'र')
    s = re.sub(r'([वयल])्ँ\s*(?=\1)', 'ं', s)            # सव्ँविच्च → संविच्च
    s = re.sub(r'([वयल])्ँ', 'ं', s)
    s = re.sub(r'ँ(?=[शषसहर\s])', 'ं', s)                  # रक्षाँसि → रक्षांसि
    s = re.sub(r'(?<=[' + VOW + r'क-ह])(श्श|ष्ष|स्स)', lambda m: 'ः' + m.group(1)[-1], s)  # visarga written as the sibilant
    s = re.sub(r'(?<=्)([क-ह])्\1', r'\1', s)             # a consonant doubled inside a cluster (व्ण्ण, र्त्त)
    s = s.replace('द्ध्य', 'ध्य').replace('श्ञ', 'श्न')
    return re.sub(r'\s+', ' ', s).strip()
