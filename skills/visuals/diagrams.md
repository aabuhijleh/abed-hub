# Diagrams

Shapes for logic, structure and time. Each example is a whole frame body: put it between the
`<link>` and the `<script>` from SKILL.md step 3. The Mermaid ones need `render.js`, and the
rest are plain HTML on `frame.css`.

## Flow

A state or step sequence that runs in a line. One `.lane` per side, steps as `.node`, edges
as `.to` with an optional label. Unchanged steps line up across the lanes, and a step the
fix removes is left out of the after lane. A `<mark class="node">` is the step the claim is
about.

```html
<h1>A declined card now waits for payment instead of cancelling</h1>
<div class="panel">
<div class="side before"><span class="tag">Before</span>
  <div class="lane"><span class="node">Placed</span><span class="to">card declined</span><mark class="node">Cancelled</mark></div></div>
<div class="side after"><span class="tag">After</span>
  <div class="lane"><span class="node">Placed</span><span class="to">card declined</span><mark class="node">Awaiting payment</mark><span class="to">paid within 3 days</span><span class="node">Paid</span></div></div>
</div>
```

## Branching flow

A decision, a retry loop, or paths that split. Mermaid `flowchart LR`, drawn by `render.js`.
End a node with `:::mark` for the cause, `:::good` for a win, `:::quiet` for a path that
never runs. Keep node text to a few words.

```html
<h1>Webhooks that fail 5 times are dropped, not queued</h1>
<div class="panel">
<pre class="mermaid">
flowchart LR
  A[Webhook arrives] --> B{Delivered?}
  B -- yes --> C[Done]
  B -- no --> D[Retry with backoff]
  D --> E{5th failure?}
  E -- no --> B
  E -- yes --> F[Dropped, no trace]:::mark
  E -. never reached .-> G[Dead-letter queue]:::quiet
</pre>
</div>
```

## Sequence

Messages between services, with the hop that fails. Mermaid `sequenceDiagram`. Name each
part with `participant X as Name`. Wrap the failing messages in `rect rgb(255, 138, 107)`
... `end`, and use `--x` for a message that dies. A `Note over A,B` carries the condition.

```html
<h1>Imports fail at 60 s because the proxy drops idle requests</h1>
<div class="panel">
<pre class="mermaid">
sequenceDiagram
  participant B as Browser
  participant P as Proxy
  participant S as Import server
  B->>P: Upload acme-orders.csv
  P->>S: Forward
  rect rgb(255, 138, 107)
  Note over B,P: 60 s with no bytes sent
  P--xB: 504 Gateway Timeout
  end
  S-->>P: Import finished at 198 s, nobody listening
</pre>
</div>
```

## Box diagram

Which part of a system, with nesting or fan-out. Mermaid `flowchart LR` with a `subgraph`
per region, service or layer. `[(Name)]` draws a store, `-.->` a background link. Mark the
one component at fault.

```html
<h1>Only eu-west reads invoices from the stale replica</h1>
<div class="panel">
<pre class="mermaid">
flowchart LR
  U[Billing page] --> LB[Load balancer]
  subgraph us[us-east]
    A1[API] --> R1[(Replica, 0 s lag)]
  end
  subgraph eu[eu-west]
    A2[API] --> R2[(Replica, 41 min lag)]:::mark
  end
  LB --> A1
  LB --> A2
  R1 -.-> P[(Primary)]
  R2 -.-> P
</pre>
</div>
```

## Tree

A path through a hierarchy: a bundle, a call tree, a dependency tree, a folder. Nested
`ul.tree` lists. A `<mark>` on each node of the path, a `<small>` for its size or count.
Show the siblings of the path and cut the rest.

```html
<h1>Two thirds of the 2.1 MB bundle come from one icon import</h1>
<div class="panel">
<ul class="tree">
  <li><span>app.js</span><small>2.1 MB</small>
    <ul>
      <li><span>dashboard/</span><small>1.6 MB</small>
        <ul>
          <li><mark>Sidebar.tsx</mark><small>1.4 MB</small>
            <ul><li><mark>import * from "acme-icons"</mark><small>1.4 MB, 2,300 icons for 6 used</small></li></ul></li>
          <li><span>Chart.tsx</span><small>180 kB</small></li>
        </ul></li>
      <li><span>settings/</span><small>310 kB</small></li>
      <li><span>vendor/react</span><small>140 kB</small></li>
    </ul></li>
</ul>
</div>
```

## Timeline

What runs when, at once, or past a deadline. `.time` rails on a shared clock. `--span` and
every `--at` and `--to` are in one unit, here seconds. A `.cut` marks a deadline such as a
timeout. On the after side, `.wait` draws polling or a queue, `.win` the moment it works,
and `.end` right-aligns a bar to its `--at`, which keeps one at the end of the span inside
the panel. End with one `.axis` row.

```html
<h1>Imports now poll, so the 60 s proxy limit no longer applies</h1>
<div class="panel">
<div class="side before"><span class="tag">Before</span>
  <div class="time" style="--span:210">
    <i>Browser</i><div class="rail"><span style="--at:0;--to:60">One request, waiting</span><span class="fail" style="--at:62">Network error</span></div>
    <i>Server</i><div class="rail"><span style="--at:0;--to:198">Import finishes, nobody listening</span></div>
    <div class="cut" style="--at:60"><b>Proxy drops idle requests at 60 s</b></div>
  </div></div>
<div class="side after"><span class="tag">After</span>
  <div class="time" style="--span:210">
    <i>Browser</i><div class="rail"><span class="wait" style="--at:0;--to:190">Polls every 5 s</span><span class="win end" style="--at:210">Done</span></div>
    <i>Server</i><div class="rail"><span style="--at:0;--to:198">Import runs as a job</span></div>
    <div class="cut" style="--at:60"><b>Proxy limit, no longer hit</b></div>
  </div></div>
<div class="time" style="--span:210"><span></span><div class="axis"><span style="--at:0">0</span><span style="--at:60">1 min</span><span style="--at:120">2 min</span><span style="--at:180">3 min</span></div></div>
</div>
```

## Order strip

Where a column, record or step lands in an order. A `.cols` strip. A `.gap` marks one that
is missing, and a `<small>` inside a cell explains it.

```html
<h1>Payment now comes before shipping, and review is gone</h1>
<div class="panel">
<div class="side before"><span class="tag">Before</span>
  <div class="cols"><span>Cart</span><span>Shipping</span><span>Review</span><mark>Payment</mark></div></div>
<div class="side after"><span class="tag">After</span>
  <div class="cols"><span>Cart</span><mark>Payment<small>before shipping</small></mark><span>Shipping</span><span class="gap">no review</span></div></div>
</div>
```

## Table

A rule that treats cases differently. Cases down the side, a `before` and an `after` column,
and a `tfoot` total when a count proves the fix. Mark only the cells that change.

```html
<h1>Renewals are charged the first-year price again</h1>
<div class="panel">
<table>
  <thead><tr><th>Invoice</th><th class="before">Before</th><th class="after">After</th></tr></thead>
  <tr><td>Monthly</td><td>$40</td><td>$40</td></tr>
  <tr><td>Annual, first year</td><td>$408</td><td>$408</td></tr>
  <tr><td>Annual, renewal</td><td class="before"><mark>$480</mark></td><td class="after"><mark>$408</mark></td></tr>
</table>
</div>
```

## Mermaid gotchas

- `:::mark`, `:::good` and `:::quiet` work in a `flowchart` only. `render.js` adds them. A
  `sequenceDiagram` takes no classes, so mark it with a `rect` block.
- A label holding `(`, `)`, `:` or `"` breaks the parse. Quote it: `A["Retry (5x)"]`.
- A parse error makes `gh-attach shot` fail with the message. In a `flowchart`, its line
  number counts the three `classDef` lines `render.js` adds after the first line.
- A `<br/>` in a label is dropped and the words run together. Put the second part in
  parentheses or shorten the label.
- `flowchart LR` suits 948px. Switch to `TB` only when the chain is longer than about six
  nodes.
