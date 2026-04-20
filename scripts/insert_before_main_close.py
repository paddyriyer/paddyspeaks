#!/usr/bin/env python3
import sys
path, content_path = sys.argv[1], sys.argv[2]
with open(path) as f: t = f.read()
with open(content_path) as f: new = f.read()
t = t.replace('</main>', new + '\n</main>', 1)
with open(path, 'w') as f: f.write(t)
print(f"inserted {len(new)} bytes into {path}")
