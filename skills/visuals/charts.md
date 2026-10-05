# Charts

Shapes for numbers. Each example is a whole frame body: put it between the `<link>` and the
`<script>` from SKILL.md step 3. Line charts need `render.js`, and the rest are plain HTML
on `frame.css`.

## Stat card

One number moving, or two or three that move together. Each `.stat` has a `<small>` label,
the old value in `<s>`, the new one in `<mark>` (or `<b>` when it is unchanged), and the
delta in `<em>` (`<em class="bad">` when it got worse). A finding with one number drops the
`<s>`.

```html
<h1>Search is 7× faster after the index on <mark class="good">title</mark></h1>
<div class="panel">
<div class="stats">
  <div class="stat"><small>p95 search time</small><s>1.8 s</s><mark class="good">240 ms</mark><em>−87%</em></div>
  <div class="stat"><small>Searches over 1 s, per day</small><s>4,120</s><mark class="good">31</mark><em>−99%</em></div>
  <div class="stat"><small>Results for "acme"</small><b>24</b><em>unchanged</em></div>
</div>
</div>
```

## Bars

Numbers across cases. `--max` is the scale and each bar's `--v` its value, in one unit. A
`<mark>` on the bar the claim is about. The label goes inside the bar.

```html
<h1>Checkout in ap-south takes 4× as long as in us-east</h1>
<div class="panel">
<div class="bars" style="--max:2400">
  <i>us-east</i><span style="--v:610">610 ms</span>
  <i>eu-west</i><span style="--v:1120">1,120 ms</span>
  <i>sa-east</i><span style="--v:1340">1,340 ms</span>
  <i>ap-south</i><mark style="--v:2380">2,380 ms, 1,900 of it a cold start</mark>
</div>
</div>
```

## Bars, before and after

The same cases measured twice. Pair `.was` and `.now` bars under one label, with an empty
`<i></i>` before the second, and a `.key` of tags on top.

```html
<h1>Batching cut every import, most of all the large ones</h1>
<div class="panel">
<div class="key"><span class="tag before">Before</span><span class="tag after">After</span></div>
<div class="bars" style="--max:198">
  <i>500 rows</i><span class="was" style="--v:9">9 s</span>
  <i></i><span class="now" style="--v:4">4 s</span>
  <i>3,441 rows</i><span class="was" style="--v:62">62 s</span>
  <i></i><span class="now" style="--v:14">14 s</span>
  <i>20,000 rows</i><span class="was" style="--v:198">198 s</span>
  <i></i><mark class="good" style="--v:31">31 s, 6× faster</mark>
</div>

</div>
```

## Columns

Counts per day, week or release, where time runs left to right. Vega-Lite `bar`, drawn by
`render.js`. Give the bars a `stroke` and set `"sort": null` so the days keep their order.
A `condition` on `color` fills the bar the claim is about, and a `text` layer puts each
count on top. When the question asked for the total, a stat card with it sits above.

```html
<h1>The nightly import created 48,210 records in 5 days, almost none on Saturday</h1>
<div class="panel">
<div class="stats">
  <div class="stat"><small>Records created, Sep 30 to Oct 4</small><b>48,210</b></div>
  <div class="stat"><small>On Saturday, Oct 4</small><mark>180</mark><em class="bad">vs 12,000 a day before it</em></div>
</div>
<script type="application/vega-lite+json">
{
  "height": 300,
  "data": {"values": [
    {"day":"Tue, Sep 30","n":12480},{"day":"Wed, Oct 1","n":11920},{"day":"Thu, Oct 2","n":12760},
    {"day":"Fri, Oct 3","n":10870},{"day":"Sat, Oct 4","n":180,"cause":true}
  ]},
  "encoding": {
    "x": {"field":"day","type":"ordinal","sort":null,"title":null,"axis":{"labelAngle":0,"labelFontSize":14,"labelColor":"#111","labelFontWeight":700}},
    "y": {"field":"n","type":"quantitative","title":"Records created","axis":{"format":",d"}}
  },
  "layer": [
    {"mark": {"type":"bar","stroke":"#111","strokeWidth":2.5,"width":{"band":0.6}},
     "encoding": {"color": {"condition":{"test":"datum.cause","value":"#ff8a6b"},"value":"#fff"}}},
    {"mark": {"type":"text","dy":-10,"fontSize":15,"fontWeight":900}, "encoding": {"text":{"field":"n","format":",d"}}}
  ]
}
</script>
</div>
```

## Line + marker

A metric over time around an event: a deploy, an incident, a config change. Vega-Lite, drawn
by `render.js`, which supplies the theme, a container width and a 260px height. A `rule`
layer marks the event and a `rect` band shades the time after it. Times are full ISO
timestamps on a plain `temporal` field.

```html
<h1>Checkout errors tripled after the 14:02 deploy</h1>
<div class="panel">
<script type="application/vega-lite+json">
{
  "data": {"values": [
    {"t":"2026-01-05T13:30","rate":0.8},{"t":"2026-01-05T13:40","rate":0.9},{"t":"2026-01-05T13:50","rate":0.7},{"t":"2026-01-05T14:00","rate":0.8},
    {"t":"2026-01-05T14:10","rate":2.6},{"t":"2026-01-05T14:20","rate":2.4},{"t":"2026-01-05T14:30","rate":2.7},{"t":"2026-01-05T14:40","rate":2.5}
  ]},
  "encoding": {"x": {"field":"t","type":"temporal","title":null,"axis":{"format":"%H:%M"}}},
  "layer": [
    {"data": {"values":[{"from":"2026-01-05T14:02","to":"2026-01-05T14:40"}]},
     "mark": {"type":"rect","color":"#ffe1d8"},
     "encoding": {"x":{"field":"from","type":"temporal"},"x2":{"field":"to"}}},
    {"data": {"values":[{"t":"2026-01-05T14:02","label":"14:02 deploy v4.12"}]},
     "layer": [
       {"mark": "rule"},
       {"mark": {"type":"text","align":"left","baseline":"bottom","dx":8,"y":{"expr":"height - 8"},"color":"#9a3a22","fontSize":14,"fontWeight":900}, "encoding": {"text":{"field":"label"}}}
     ]},
    {"mark": "line", "encoding": {"y": {"field":"rate","type":"quantitative","title":"Errors, % of checkouts"}}},
    {"mark": "point", "encoding": {"y": {"field":"rate","type":"quantitative"}}}
  ]
}
</script>
</div>
```

## Matrix

Where it fails across two dimensions: browser by login method, version by region. A table
with `td.ok` and `td.no` cells. The `<mark>` goes in the failing cell and carries the
reason.

```html
<h1>Login fails only on Safari with SSO</h1>
<div class="panel">
<table>
  <thead><tr><th>Browser</th><th>Password</th><th>Magic link</th><th>SSO</th></tr></thead>
  <tr><td>Chrome</td><td class="ok">✓</td><td class="ok">✓</td><td class="ok">✓</td></tr>
  <tr><td>Firefox</td><td class="ok">✓</td><td class="ok">✓</td><td class="ok">✓</td></tr>
  <tr><td>Safari</td><td class="ok">✓</td><td class="ok">✓</td><td class="no"><mark>✗ cookie blocked</mark></td></tr>
  <tr><td>Edge</td><td class="ok">✓</td><td class="ok">✓</td><td class="ok">✓</td></tr>
</table>
</div>
```

## Funnel

Where items drop out of a pipeline. `--max` is what went in and each stage's `--v` what is
left. A `.drop` line between stages names each loss, and `.drop.cause` the one the claim is
about.

```html
<h1>3,200 of 10,000 rows are lost to duplicate keys</h1>
<div class="panel">
<div class="funnel" style="--max:10000">
  <span style="--v:10000">10,000 rows uploaded</span>
  <span class="drop">−800 unparseable dates</span>
  <span style="--v:9200">9,200 parsed</span>
  <span class="drop cause">−3,200 duplicate order_id, silently skipped</span>
  <mark style="--v:6000">6,000 saved</mark>
</div>
</div>
```

## Record diff

Which fields differ between two records, one that works and one that does not. `table.diff`,
a column per record named by its id, `tr.same` for the fields that match. A `<mark>` on the
value that differs.

```html
<h1>The order that fails to sync has no currency</h1>
<div class="panel">
<table class="diff">
  <thead><tr><th>Field</th><th>ABC-123, syncs</th><th>ABC-124, fails</th></tr></thead>
  <tr class="same"><td>status</td><td>"paid"</td><td>"paid"</td></tr>
  <tr class="same"><td>total</td><td>40.00</td><td>40.00</td></tr>
  <tr><td>currency</td><td>"USD"</td><td><mark>null</mark></td></tr>
  <tr class="same"><td>customer_id</td><td>8812</td><td>8813</td></tr>
</table>
</div>
```

## Vega-Lite gotchas

- Times need a full ISO timestamp (`"2026-01-05T14:02"`). A bare `"14:02"` parses as
  nothing, and every point lands on the y axis.
- Leave `timeUnit` off ISO times. It bins them all to midnight.
- Set `color` only on the layer that is the cause, such as the event label. The theme
  draws everything else in ink.
- A spec error reaches `gh-attach shot`, which fails with the message. Fix the spec and
  render again.
