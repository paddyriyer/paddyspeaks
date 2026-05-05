// ════════════════════════════════════════════════════════════
// Demo-block generator for the Python playground.
// Given the current editor source, produce a `# Demo:` block that
// invokes the just-defined function or class so the user can hit Run
// and see real output.
// ════════════════════════════════════════════════════════════

// Sample values keyed by parameter name. Used to produce demo arguments
// that look plausible for the most common interview-style signatures.
const SAMPLES = {
  // arrays of numbers
  nums:    "[1, 1, 1, 2, 3, 4, 5]",
  arr:     "[3, 1, 4, 1, 5, 9, 2, 6]",
  array:   "[3, 1, 4, 1, 5, 9, 2, 6]",
  numbers: "[1, 2, 3, 4, 5]",
  values:  "[10, 20, 30, 40]",
  data:    "[1, 2, 3, 4, 5]",
  items:   "[1, 2, 3, 4]",
  a:       "[1, 2, 3]",
  b:       "[3, 4, 5]",
  // matrices / nested lists
  matrix:    "[[1,2,3],[4,5,6],[7,8,9]]",
  grid:      "[[1,1,0],[1,0,1],[0,1,1]]",
  intervals: "[[1,3],[2,6],[8,10],[15,18]]",
  pairs:     "[[1,2],[2,3],[3,4]]",
  edges:     "[[0,1],[1,2],[2,3]]",
  points:    "[[1,3],[2,2],[3,1]]",
  // strings
  s:        '"anagram"',
  t:        '"nagaram"',
  str:      '"leetcode"',
  string:   '"abcabcbb"',
  text:     '"hello world"',
  word:     '"hello"',
  words:    '["leet","code","leetcode"]',
  strs:     '["eat","tea","tan","ate","nat","bat"]',
  strings:  '["foo","bar","foobar"]',
  pattern:  '"abba"',
  prefix:   '"pre"',
  suffix:   '"_v2"',
  haystack: '"abcabcbb"',
  needle:   '"abc"',
  // ints
  k:         "2",
  target:    "9",
  n:         "5",
  m:         "3",
  x:         "5",
  val:       "7",
  num:       "10",
  capacity:  "2",
  size:      "3",
  width:     "3",
  height:    "3",
  threshold: "5",
  limit:     "10",
  rate:      "1.5",
  // dicts
  d:        "{'a': 1, 'b': 2}",
  mapping:  "{'a': 1, 'b': 2}",
  // sets
  st:       "{1, 2, 3}",
  // booleans
  ascending: "True",
  reverse:   "False",
};

function pickSample(paramName) {
  const p = paramName.toLowerCase().trim();
  if (p in SAMPLES) return SAMPLES[p];
  // fall-backs by suffix / prefix
  if (/_id$|^id$/.test(p)) return "1";
  if (/_list$|s$/.test(p) && p !== "s") return "[1, 2, 3]";
  if (/_str$/.test(p)) return '"sample"';
  if (/_dict$|_map$/.test(p)) return "{'a': 1}";
  // default: small int
  return "1";
}

// Canonical inputs for well-known interview problems. Keyed by exact
// function name so the demo matches the textbook example each candidate
// has already seen — produces output that obviously demonstrates intent.
const FUNC_CANONICAL = {
  // Sliding-window / strings
  minWindow:                  '"ADOBECODEBANC", "ABC"',          // → "BANC"
  lengthOfLongestSubstring:   '"abcabcbb"',                       // → 3
  characterReplacement:       '"AABABBA", 1',                     // → 4
  checkInclusion:             '"ab", "eidbaooo"',                 // → True
  isAnagram:                  '"anagram", "nagaram"',
  longestPalindrome:          '"babad"',
  isPalindrome:               '"A man, a plan, a canal: Panama"',
  groupAnagrams:              '["eat","tea","tan","ate","nat","bat"]',
  ladderLength:               '"hit", "cog", ["hot","dot","dog","lot","log","cog"]',
  wordBreak:                  '"leetcode", ["leet","code"]',
  // Two pointers / arrays
  twoSum:                     '[2, 7, 11, 15], 9',                // → [0, 1]
  threeSum:                   '[-1, 0, 1, 2, -1, -4]',
  maxArea:                    '[1,8,6,2,5,4,8,3,7]',
  trap:                       '[0,1,0,2,1,0,1,3,2,1,2,1]',
  productExceptSelf:          '[1, 2, 3, 4]',
  // `rotate` ambiguous across LeetCode (rotate-array vs rotate-image) — skip.
  // Hash / counting
  containsDuplicate:          '[1, 2, 3, 1]',
  topKFrequent:               '[1,1,1,2,2,3], 2',
  subarraySum:                '[1, 1, 1], 2',                     // → 2
  longestConsecutive:         '[100, 4, 200, 1, 3, 2]',
  // Binary search / sort
  search:                     '[-1, 0, 3, 5, 9, 12], 9',
  searchInsert:               '[1, 3, 5, 6], 5',
  findMin:                    '[3, 4, 5, 1, 2]',
  // Dynamic programming
  climbStairs:                '5',
  fib:                        '10',
  coinChange:                 '[1, 2, 5], 11',
  rob:                        '[2, 7, 9, 3, 1]',
  maxProfit:                  '[7, 1, 5, 3, 6, 4]',
  uniquePaths:                '3, 7',
  longestCommonSubsequence:   '"abcde", "ace"',
  // Trees / graphs (caller has to define a node type — skip if no class)
  numIslands:                 '[["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]',
  canFinish:                  '2, [[1, 0]]',
  alienOrder:                 '["wrt","wrf","er","ett","rftt"]',  // → "wertf"
  // Intervals
  merge:                      '[[1,3],[2,6],[8,10],[15,18]]',
  insert:                     '[[1,3],[6,9]], [2, 5]',
  eraseOverlapIntervals:      '[[1,2],[2,3],[3,4],[1,3]]',
  // Stacks / parsing
  evalRPN:                    '["2", "1", "+", "3", "*"]',         // → 9
  isValid:                    '"()[]{}"',
  decodeString:               '"3[a2[c]]"',
  // Linked list / others (skip — too involved)
};

// Returns parsed parameter names (no defaults, no *args/**kwargs).
function splitParams(paramSig) {
  if (!paramSig.trim()) return [];
  const names = [];
  let depth = 0, current = "";
  for (const ch of paramSig) {
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    if (ch === "," && depth === 0) {
      names.push(current.trim());
      current = "";
    } else current += ch;
  }
  if (current.trim()) names.push(current.trim());
  return names
    .map((p) => p.replace(/=.*/, "").trim())            // strip default values
    .map((p) => p.replace(/^\*+/, "").trim())           // strip * / **
    .map((p) => p.replace(/:\s*[^,]+/, "").trim())      // strip type hints
    .filter((p) => p && p !== "self" && p !== "cls");
}

const FUNC_RE = /^def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*:/m;
const CLASS_RE = /^class\s+([A-Za-z_]\w*)\s*[(:]/m;
const METHOD_RE = /^\s+def\s+([A-Za-z_]\w*)\s*\(self(?:\s*,\s*([^)]*))?\)\s*:/gm;

function lastMatch(re, src) {
  let m, last = null;
  // Re-anchor without /g — we'll scan manually.
  const rGlobal = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  while ((m = rGlobal.exec(src)) !== null) last = m;
  return last;
}

function callFor(funcName, paramSig) {
  // Canonical textbook inputs win when we recognise the function name —
  // those produce textbook output the candidate immediately recognises.
  if (FUNC_CANONICAL[funcName]) {
    return `print(${funcName}(${FUNC_CANONICAL[funcName]}))`;
  }
  // No canonical mapping: we'd be guessing inputs. A guess that happens to
  // crash is worse for credibility than no demo at all, so return null and
  // let the caller fall back to a hint.
  return null;
}

function detectSpecialContext(src) {
  if (/^\s*from\s+pyspark|\bSparkSession|\bspark\.read|\bspark\.sql/m.test(src)) return "pyspark";
  if (/^\s*import\s+pandas|^\s*from\s+pandas|\bpd\./m.test(src)) return "pandas";
  if (/^\s*import\s+sqlite3|^\s*import\s+sqlalchemy/m.test(src)) return "sqlite";
  return null;
}

/**
 * Build a demo block tailored to the current source.
 * Returns a string starting with two newlines and a comment header,
 * or '' if we can't sensibly demo the code.
 */
export function generateDemo(src) {
  if (!src || !src.trim()) return "";
  const special = detectSpecialContext(src);

  // Class-based questions — chain common method calls when possible.
  const classM = lastMatch(CLASS_RE, src);
  const funcM = lastMatch(FUNC_RE, src);

  // Prefer class demo if a class is the dominant construct (and no top-level
  // `def` follows it that overrides what to demo).
  if (classM && (!funcM || classM.index > funcM.index)) {
    return classDemo(src, classM[1]);
  }
  if (funcM) {
    const funcName = funcM[1];
    const paramSig = funcM[2];
    if (special === "pyspark") {
      return `\n\n# ─── Demo ───\n# PySpark isn't available in Pyodide. Read the schema and run this\n# code locally inside a Spark notebook (or PaddySpeaks SQL playground\n# for SQL-equivalent versions).\nprint("PySpark required — solution shown for reference; not runnable in-browser.")\n`;
    }
    if (special === "pandas") {
      const params = splitParams(paramSig);
      if (!params.length) {
        return `\n\n# ─── Demo ───\n# Toggle '+pandas/numpy' above and re-run.\nprint(${funcName}())\n`;
      }
      return `\n\n# ─── Demo ───\n# Toggle '+pandas/numpy' above first. Construct an input, e.g.:\n#   df = pd.DataFrame({'a': [1, 2, 3]})\n#   ${funcName}(df)\n`;
    }
    const call = callFor(funcName, paramSig);
    if (call) return `\n\n# ─── Demo (auto-generated) ───\n${call}\n`;
    // No canonical demo — show a clear hint instead of guessing args.
    const ps = splitParams(paramSig).map((p) => `<${p}>`).join(", ") || "...";
    return `\n\n# ─── Demo ───\n# Define inputs that match the question, then call:\n#   print(${funcName}(${ps}))\n`;
  }

  // No def/class — maybe top-level expression code that already runs.
  if (special === "pyspark") {
    return `\n\n# Note: pyspark isn't available in Pyodide. Try the pandas equivalent.\n`;
  }
  if (special === "pandas") {
    return `\n\n# Note: this snippet expects file paths that don't exist in the\n# browser. Toggle '+pandas/numpy' above and try a small in-memory example:\n#   import pandas as pd\n#   df = pd.DataFrame({'region': ['NA','EU','NA'], 'amount': [10, 20, 30]})\n#   print(df.groupby('region', as_index=False)['amount'].sum())\n`;
  }
  if (special === "sqlite") {
    return `\n\n# Note: sqlite3 needs a file. In Pyodide use ':memory:':\n#   con = sqlite3.connect(':memory:')\n#   con.execute('CREATE TABLE t (id INTEGER, x INTEGER)')\n#   con.executemany('INSERT INTO t VALUES (?, ?)', [(1, 10), (2, 20)])\n#   for row in con.execute('SELECT * FROM t'): print(row)\n`;
  }
  return "";
}

function classDemo(src, className) {
  // Parse __init__ signature
  const initRe = /^\s+def\s+__init__\s*\(self(?:\s*,\s*([^)]*))?\)\s*:/m;
  const initM = initRe.exec(src);
  const initParams = initM ? splitParams(initM[1] || "") : [];
  const initArgs = initParams.map(pickSample).join(", ");

  // Find public method names (those not starting with _) and their signatures
  const methods = [];
  let m;
  const r = new RegExp(METHOD_RE.source, METHOD_RE.flags);
  while ((m = r.exec(src)) !== null) {
    const name = m[1];
    if (name === "__init__" || name.startsWith("_")) continue;
    methods.push({ name, params: splitParams(m[2] || "") });
  }

  if (!methods.length) {
    return `\n\n# ─── Demo (auto-generated) ───\nobj = ${className}(${initArgs})\nprint(obj)\n`;
  }

  // Recognise common patterns
  const names = new Set(methods.map((x) => x.name));
  const lines = [`obj = ${className}(${initArgs})`];

  if (names.has("put") && names.has("get")) {
    // Cache-style (LFU/LRU)
    lines.push(`obj.put(1, 100)`);
    lines.push(`obj.put(2, 200)`);
    lines.push(`print("get(1) =", obj.get(1))`);
    lines.push(`print("get(2) =", obj.get(2))`);
    lines.push(`obj.put(3, 300)         # may evict`);
    lines.push(`print("after put(3), get(1) =", obj.get(1))`);
  } else if (names.has("next")) {
    // Streaming/moving-average
    lines.push(`for v in [1, 10, 3, 5, 8]:`);
    lines.push(`    print("next(", v, ") =", obj.next(v))`);
  } else if (names.has("add") && names.has("top")) {
    lines.push(`for v in [3, 1, 4, 1, 5, 9, 2, 6]:`);
    lines.push(`    obj.add(v)`);
    lines.push(`print("top:", obj.top())`);
  } else if (names.has("add")) {
    lines.push(`for v in [3, 1, 4, 1, 5]:`);
    lines.push(`    obj.add(v)`);
    lines.push(`print(obj)`);
  } else if (names.has("push") && names.has("pop")) {
    lines.push(`obj.push(1); obj.push(2); obj.push(3)`);
    lines.push(`print("pop:", obj.pop())`);
    lines.push(`print("pop:", obj.pop())`);
  } else if (names.has("partition")) {
    lines.push(`for k in ["alpha", "beta", "alpha", "gamma"]:`);
    lines.push(`    print(k, "->", obj.partition(k))`);
  } else {
    // Fallback: call the first non-init method with auto args
    const m0 = methods[0];
    lines.push(`# Available methods: ${methods.map((x) => x.name).join(", ")}`);
    const args = m0.params.map(pickSample).join(", ");
    lines.push(`print(obj.${m0.name}(${args}))`);
  }
  return `\n\n# ─── Demo (auto-generated) ───\n` + lines.join("\n") + "\n";
}
