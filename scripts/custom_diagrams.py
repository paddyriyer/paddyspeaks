"""
Hand-crafted pure-HTML/CSS replacements for specific ASCII diagrams.
NO SVG. All shapes are divs; connectors are CSS + unicode arrow glyphs.

Each entry is a (signature, replacement_html) pair. The combiner calls
apply() before viz_transform so specific signatures win.
"""

# ─── Part 0: The Ads Value Chain — 3-lane swimlane ───────────
ADS_VALUE_CHAIN = '''<figure class="viz viz-swimlane" aria-label="The ads value chain">
<div class="viz-label">The Ads Value Chain</div>
<div class="sw-headers">
  <div class="sw-num-col" aria-hidden="true"></div>
  <div class="sw-lane-head sw-lane-adv">Advertiser</div>
  <div class="sw-lane-head sw-lane-plat">Platform</div>
  <div class="sw-lane-head sw-lane-user">User / Conversion</div>
</div>
<div class="sw-row">
  <div class="sw-num">1</div>
  <div class="sw-cell sw-adv"><div class="sw-box">Campaign creation</div></div>
  <div class="sw-cell sw-plat"><div class="sw-box">Campaign entity store</div></div>
  <div class="sw-cell sw-user"><span class="sw-dash">—</span></div>
</div>
<div class="sw-row">
  <div class="sw-num">2</div>
  <div class="sw-cell sw-adv"><div class="sw-box">Audience targeting</div></div>
  <div class="sw-cell sw-plat"><div class="sw-box">Audience engine / graph</div></div>
  <div class="sw-cell sw-user"><span class="sw-dash">—</span></div>
</div>
<div class="sw-row">
  <div class="sw-num">3</div>
  <div class="sw-cell sw-adv"><span class="sw-dash">—</span></div>
  <div class="sw-cell sw-plat"><div class="sw-box">Auction → impression</div></div>
  <div class="sw-cell sw-user"><div class="sw-box">Impression served</div></div>
</div>
<div class="sw-row">
  <div class="sw-num">4</div>
  <div class="sw-cell sw-adv"><span class="sw-dash">—</span></div>
  <div class="sw-cell sw-plat"><div class="sw-box">Impression log</div></div>
  <div class="sw-cell sw-user"><span class="sw-dash">—</span></div>
</div>
<div class="sw-row">
  <div class="sw-num">5</div>
  <div class="sw-cell sw-adv"><span class="sw-dash">—</span></div>
  <div class="sw-cell sw-plat"><div class="sw-box">Delivery → click log</div></div>
  <div class="sw-cell sw-user"><div class="sw-box">Engagement (click, like, view)</div></div>
</div>
<div class="sw-row">
  <div class="sw-num">6</div>
  <div class="sw-cell sw-adv"><span class="sw-dash">—</span></div>
  <div class="sw-cell sw-plat"><div class="sw-box">Conversion log</div></div>
  <div class="sw-cell sw-user"><div class="sw-box">User converts (pixel, SDK, server)</div></div>
</div>
<div class="sw-row">
  <div class="sw-num">7</div>
  <div class="sw-cell sw-adv"><div class="sw-box">Advertiser dashboards · billing · ML feedback</div></div>
  <div class="sw-cell sw-plat"><div class="sw-box">Reporting &amp; optimization</div></div>
  <div class="sw-cell sw-user"><span class="sw-dash">—</span></div>
</div>
<div class="sw-legend">Seven stages flow through three actors. Each row shows who holds the data at that step.</div>
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
    ('client SDK / browser / server CAPI', '''<figure class="viz viz-pipeline-arch" aria-label="Ads telemetry pipeline architecture">
<div class="viz-label">Ads Telemetry Pipeline</div>
<div class="pa-top">
  <div class="pa-box pa-box-src">
    <div class="pa-box-title">Client SDK · browser · server CAPI</div>
  </div>
  <div class="pa-arrow">↓</div>
  <div class="pa-box pa-box-spine">
    <div class="pa-box-title">Event streaming spine</div>
    <div class="pa-box-meta">Kafka-style · 1-day retention · ~600 K events/sec peak</div>
  </div>
</div>
<div class="pa-fan-arrows" aria-hidden="true">↙ &nbsp; ↓ &nbsp; ↓ &nbsp; ↘</div>
<div class="pa-four">
  <div class="pa-col">
    <div class="pa-box pa-box-bronze"><div class="pa-box-title">Bronze (raw)</div><div class="pa-box-meta">Iceberg · hourly</div></div>
    <div class="pa-arrow pa-arrow-sm">↓</div>
    <div class="pa-box pa-box-silver"><div class="pa-box-title">Silver</div><div class="pa-box-meta">Clean · dedup · joined to dim</div></div>
    <div class="pa-arrow pa-arrow-sm">↓ daily</div>
    <div class="pa-box pa-box-gold"><div class="pa-box-title">Gold · semantic layer</div><div class="pa-box-meta">Metric definitions</div></div>
  </div>
  <div class="pa-col">
    <div class="pa-box pa-box-stream"><div class="pa-box-title">Stream processor</div><div class="pa-box-meta">Flink · micro-batch</div></div>
    <div class="pa-stub"></div>
    <div class="pa-stub"></div>
    <div class="pa-stub"></div>
    <div class="pa-stub"></div>
  </div>
  <div class="pa-col">
    <div class="pa-box pa-box-olap"><div class="pa-box-title">Real-time OLAP</div><div class="pa-box-meta">Druid / Pinot · sec-level</div></div>
    <div class="pa-arrow pa-arrow-sm">↓</div>
    <div class="pa-terminal">Advertiser UI</div>
  </div>
  <div class="pa-col">
    <div class="pa-box pa-box-kv"><div class="pa-box-title">Pacing counter KV</div><div class="pa-box-meta">Redis · sub-sec</div></div>
    <div class="pa-arrow pa-arrow-sm">↓</div>
    <div class="pa-terminal">Auction gate</div>
  </div>
</div>
<div class="pa-fanout-head">Gold feeds ↓</div>
<div class="pa-terminal-grid">
  <div class="pa-terminal pa-term-blue">metrics registry</div>
  <div class="pa-terminal pa-term-blue">dashboards</div>
  <div class="pa-terminal pa-term-green">feature store</div>
  <div class="pa-terminal pa-term-rust">exec scorecard</div>
</div>
</figure>'''),
    ('streaming: 1-min windows', '''<figure class="viz viz-tree-v2" aria-label="Bronze aggregation pipeline tree">
<div class="viz-label">The Aggregation Pipeline</div>
<div class="tv2-root">
  <div class="tv2-node tv2-node-root"><div class="tv2-name">Bronze · raw events</div></div>
  <div class="tv2-branches">
    <div class="tv2-branch">
      <div class="tv2-edge">↘ streaming</div>
      <div class="tv2-node tv2-node-stream"><div class="tv2-name">1-minute windows</div><div class="tv2-meta">→ Real-time OLAP · serves pacing, near-real-time UI</div></div>
    </div>
    <div class="tv2-branch">
      <div class="tv2-edge">↘ batch</div>
      <div class="tv2-node tv2-node-batch"><div class="tv2-name">hourly → silver → daily rollup → gold</div></div>
      <div class="tv2-subedge">└ gold marts</div>
      <div class="tv2-leaves">
        <div class="tv2-leaf">metric_campaign_daily</div>
        <div class="tv2-leaf">metric_creative_daily</div>
        <div class="tv2-leaf">metric_audience_daily</div>
        <div class="tv2-leaf tv2-leaf-exec">metric_platform_daily · exec</div>
      </div>
    </div>
  </div>
</div>
</figure>'''),
    ('streaming win events', '''<figure class="viz viz-pacing" aria-label="Pacing dual-write architecture">
<div class="viz-label">Streaming Pacing ⇆ Batch Ground Truth</div>
<div class="pc-stack">
  <div class="pc-src">
    <span class="pc-src-label">Streaming win events</span>
    <span class="pc-src-arrow">↓</span>
  </div>
  <div class="pc-box pc-box-realtime">
    <div class="pc-box-title">Real-time spend counter · KV</div>
    <div class="pc-box-meta">campaign_id → spent_today</div>
    <div class="pc-box-read"><span class="pc-arrow-in">←</span> read by auction pacing gate <span class="pc-latency">(sub-100 ms lookup)</span></div>
  </div>
  <div class="pc-between">
    <span class="pc-between-arrow">⇅</span>
    <span class="pc-between-label">hourly correction</span>
  </div>
  <div class="pc-box pc-box-batch">
    <div class="pc-box-title">Ground-truth batch pipeline</div>
    <div class="pc-box-meta">impressions ⋈ conversions ⋈ IVT</div>
    <div class="pc-box-meta pc-mono">campaign_id, hour → $spent</div>
    <div class="pc-box-read"><span class="pc-arrow-in">←</span> source of truth for billing</div>
  </div>
</div>
</figure>'''),
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
