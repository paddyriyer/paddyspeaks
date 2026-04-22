"""
Hand-crafted pure-HTML/CSS replacements for specific ASCII diagrams.
NO SVG. All shapes are divs; connectors are CSS + unicode arrow glyphs.

Each entry is a (signature, replacement_html) pair. The combiner calls
apply() before viz_transform so specific signatures win.
"""

# ─── Part 0: The Ads Value Chain — 3-lane swimlane ───────────
ADS_VALUE_CHAIN = '''<figure class="viz viz-swimlane" aria-label="The ads value chain">
<div class="viz-label">The Ads Value Chain</div>
<div class="sw-grid">
  <div class="sw-head sw-head-adv">Advertiser</div>
  <div class="sw-head sw-head-plat">Platform</div>
  <div class="sw-head sw-head-user">User / Conversion</div>

  <div class="sw-num">1</div>
  <div class="sw-box sw-box-adv">Campaign creation</div>
  <div class="sw-box sw-box-plat">Campaign entity store</div>
  <div class="sw-spacer"></div>

  <div class="sw-num">2</div>
  <div class="sw-box sw-box-adv">Audience targeting</div>
  <div class="sw-box sw-box-plat">Audience engine / graph</div>
  <div class="sw-spacer"></div>

  <div class="sw-num">3</div>
  <div class="sw-spacer"></div>
  <div class="sw-box sw-box-plat">Auction → impression</div>
  <div class="sw-box sw-box-user">Impression served</div>

  <div class="sw-num">4</div>
  <div class="sw-spacer"></div>
  <div class="sw-box sw-box-plat">Impression log</div>
  <div class="sw-spacer"></div>

  <div class="sw-num">5</div>
  <div class="sw-spacer"></div>
  <div class="sw-box sw-box-plat">Delivery → click log</div>
  <div class="sw-box sw-box-user">Engagement (click, like, view)</div>

  <div class="sw-num">6</div>
  <div class="sw-spacer"></div>
  <div class="sw-box sw-box-plat">Conversion log</div>
  <div class="sw-box sw-box-user">User converts (pixel, SDK, server)</div>

  <div class="sw-num">7</div>
  <div class="sw-box sw-box-adv">Advertiser dashboards · billing · ML feedback</div>
  <div class="sw-box sw-box-plat">Reporting &amp; optimization</div>
  <div class="sw-spacer"></div>
</div>
<div class="sw-legend">Seven stages flow through three actors. Each numbered row shows who holds the data at that step.</div>
</figure>'''


# ─── Part 0: Campaign → Ad Set → Ad hierarchy ───────────────
CAMPAIGN_HIERARCHY = '''<figure class="viz viz-boxchain" aria-label="Campaign Ad Set Ad hierarchy">
<div class="viz-label">Campaign · Ad Set · Ad</div>
<div class="bc-row">
  <div class="bc-box">
    <div class="bc-box-title">Campaign</div>
    <div class="bc-box-desc">objective</div>
  </div>
  <div class="bc-rel"><span class="bc-rel-label">1 : N</span><span class="bc-rel-arrow">→</span></div>
  <div class="bc-box">
    <div class="bc-box-title">Ad Set</div>
    <div class="bc-box-desc">targeting · budget · bid</div>
  </div>
  <div class="bc-rel"><span class="bc-rel-label">1 : N</span><span class="bc-rel-arrow">→</span></div>
  <div class="bc-box">
    <div class="bc-box-title">Ad</div>
    <div class="bc-box-desc">creative · landing page</div>
  </div>
</div>
</figure>'''


# ─── Part 0: Streaming medallion architecture (vertical stack) ──
MEDALLION_ARCH = '''<figure class="viz viz-stack" aria-label="Streaming medallion architecture">
<div class="viz-label">Streaming → Medallion → Serving</div>
<div class="st-flow">
  <div class="st-box st-tier-source">
    <div class="st-box-title">Serving / Product</div>
    <div class="st-box-meta">JSON / Protobuf events · ~5–50 KB each</div>
  </div>
  <div class="st-arrow">↓</div>
  <div class="st-box st-tier-spine">
    <div class="st-box-title">Event Streaming Spine</div>
    <div class="st-box-meta">Kafka / Kinesis / Pub-Sub · ~1 M msg/sec aggregate</div>
  </div>
  <div class="st-branches">
    <div class="st-branch">
      <div class="st-arrow st-arrow-side">→</div>
      <div class="st-side-box">
        <div class="st-side-title">Real-time OLAP</div>
        <div class="st-side-meta">Druid / Pinot / ClickHouse · sub-second dashboards</div>
      </div>
    </div>
    <div class="st-branch">
      <div class="st-arrow st-arrow-side">→</div>
      <div class="st-side-box">
        <div class="st-side-title">Stateful Stream Processor</div>
        <div class="st-side-meta">Flink / Kafka Streams · EOS · online features · ML serving</div>
      </div>
    </div>
  </div>
  <div class="st-arrow">↓</div>
  <div class="st-box st-tier-bronze">
    <div class="st-box-title">Bronze</div>
    <div class="st-box-meta">S3 / GCS + Iceberg / Delta · 1:1 with source · partitioned by event_date, hour</div>
  </div>
  <div class="st-arrow">↓</div>
  <div class="st-box st-tier-silver">
    <div class="st-box-title">Silver</div>
    <div class="st-box-meta">Dedup · schema standardization · dim joins · SCD2 · source-of-truth facts</div>
  </div>
  <div class="st-arrow">↓</div>
  <div class="st-box st-tier-gold">
    <div class="st-box-title">Gold</div>
    <div class="st-box-meta">Business-aggregate marts · daily_ad_performance · weekly_advertiser_roas</div>
  </div>
  <div class="st-arrow">↓</div>
  <div class="st-box st-tier-serving">
    <div class="st-box-title">Serving</div>
    <div class="st-consumer-grid">
      <div class="st-consumer">BI tools (Tableau / Looker) → gold</div>
      <div class="st-consumer">Advertiser APIs → gold</div>
      <div class="st-consumer">Finance / billing → silver (row-level truth)</div>
      <div class="st-consumer">ML training → silver or gold</div>
    </div>
  </div>
</div>
</figure>'''


# ─── Part 0: Metric registry fans out to 3 pipelines ───────────
METRIC_REGISTRY = '''<figure class="viz viz-fanout" aria-label="Metric registry fanning out to pipelines">
<div class="viz-label">Metric Registry → Pipelines → Consumers</div>
<div class="fo-head">
  <div class="fo-head-title">Metric Registry · YAML</div>
  <pre class="fo-head-code">spend:
  source: silver.fact_impression
  expr: SUM(charge_cents)/100.0
  dimensions: [campaign_id, ad_set_id, surface, country]
  privacy_tier: T3
  owners: [ads-billing-de]</pre>
</div>
<div class="fo-fan" aria-hidden="true">↓ &nbsp; ↓ &nbsp; ↓</div>
<div class="fo-pipes">
  <div class="fo-pipe fo-pipe-batch">
    <div class="fo-pipe-title">Batch</div>
    <div class="fo-pipe-tech">Spark</div>
    <div class="fo-pipe-sep"></div>
    <div class="fo-pipe-out">Daily gold marts</div>
  </div>
  <div class="fo-pipe fo-pipe-stream">
    <div class="fo-pipe-title">Streaming</div>
    <div class="fo-pipe-tech">Flink</div>
    <div class="fo-pipe-sep"></div>
    <div class="fo-pipe-out">Real-time feeds</div>
  </div>
  <div class="fo-pipe fo-pipe-adhoc">
    <div class="fo-pipe-title">Ad-hoc SQL</div>
    <div class="fo-pipe-tech">Trino</div>
    <div class="fo-pipe-sep"></div>
    <div class="fo-pipe-out">Explorer queries</div>
  </div>
</div>
<div class="fo-fan" aria-hidden="true">↓ &nbsp; ↓ &nbsp; ↓</div>
<div class="fo-audience">
  <div class="fo-audience-label">Advertiser &amp; analyst surfaces</div>
</div>
</figure>'''


# ─── Part 0: Correctness / Latency / Cost tradeoff triangle ────
TRADEOFF_TRIANGLE = '''<figure class="viz viz-tritri" aria-label="Correctness latency cost tradeoff">
<div class="viz-label">The Core Tradeoff</div>
<div class="tt-wrap">
  <div class="tt-vertex tt-top">
    <div class="tt-axis">Correctness</div>
    <ul class="tt-notes"><li>billable</li><li>reconcilable</li><li>auditable</li></ul>
  </div>
  <div class="tt-edges" aria-hidden="true">
    <span class="tt-edge tt-edge-top-left"></span>
    <span class="tt-edge tt-edge-top-right"></span>
    <span class="tt-edge tt-edge-bottom"></span>
  </div>
  <div class="tt-vertex tt-left">
    <div class="tt-axis">Latency</div>
    <ul class="tt-notes"><li>real-time</li><li>near-real-time</li><li>batch</li></ul>
  </div>
  <div class="tt-vertex tt-right">
    <div class="tt-axis">Cost</div>
    <ul class="tt-notes"><li>storage</li><li>compute</li><li>engineering time</li><li>operational burden</li></ul>
  </div>
</div>
<div class="tt-caption">Pick any two; the third pays for them.</div>
</figure>'''


REPLACEMENTS = [
    ('[ADVERTISER]', ADS_VALUE_CHAIN),
    ('Campaign ── 1 : N ── Ad Set', CAMPAIGN_HIERARCHY),
    ('[EVENT STREAMING SPINE]', MEDALLION_ARCH),
    ('METRIC REGISTRY', METRIC_REGISTRY),
    ('CORRECTNESS', TRADEOFF_TRIANGLE),
]


def apply(article_html: str) -> str:
    import re
    import html as htmllib

    def sub(m):
        raw = htmllib.unescape(m.group(2))
        for sig, repl in REPLACEMENTS:
            if sig in raw:
                return repl
        return m.group(0)

    return re.sub(r'<pre([^>]*)>(.*?)</pre>', sub, article_html, flags=re.DOTALL)
