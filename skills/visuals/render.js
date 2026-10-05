// Draws the frame's Mermaid diagrams and Vega-Lite charts in frame.css colours. gh-attach shot waits on window.rendered.
window.rendered = (async () => {
  const css = getComputedStyle(document.documentElement);
  const color = (name) => css.getPropertyValue(name).trim();
  const ink = color("--ink");
  const font = "Archivo, system-ui, sans-serif";
  const diagrams = [...document.querySelectorAll("pre.mermaid")];
  const charts = [
    ...document.querySelectorAll('script[type="application/vega-lite+json"]'),
  ];

  async function drawDiagrams() {
    const { default: mermaid } = await import(
      "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs"
    );
    const marks = [
      `classDef mark fill:${color("--was")},stroke:${ink},stroke-width:3px,color:${ink},font-weight:900`,
      `classDef good fill:${color("--now")},stroke:${ink},stroke-width:3px,color:#fff,font-weight:900`,
      `classDef quiet fill:#f2f2f2,stroke:${color("--quiet")},color:${color("--quiet")},stroke-dasharray:5 4`,
    ].join("\n");
    for (const pre of diagrams) {
      const [head, ...rest] = pre.textContent.trim().split("\n");
      if (/^\s*(flowchart|graph)\b/.test(head))
        pre.textContent = [head, marks, ...rest].join("\n");
    }
    mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      fontFamily: font,
      flowchart: { curve: "linear", padding: 14 },
      sequence: { mirrorActors: false, actorMargin: 70, messageMargin: 44 },
      themeVariables: {
        fontFamily: font,
        fontSize: "15px",
        primaryColor: "#fff",
        primaryBorderColor: ink,
        primaryTextColor: ink,
        lineColor: ink,
        clusterBkg: color("--paper"),
        clusterBorder: ink,
        actorBkg: "#fff",
        actorBorder: ink,
        actorLineColor: ink,
        signalColor: ink,
        signalTextColor: ink,
        noteBkgColor: color("--ground"),
        noteBorderColor: ink,
        edgeLabelBackground: color("--paper"),
      },
      themeCSS: `
        .node rect, .node polygon, .node circle, .node path, rect.actor { stroke-width: 2.5px !important; filter: drop-shadow(4px 4px 0 ${ink}); }
        .node rect, rect.actor { rx: 0; ry: 0; }
        .cluster rect { stroke-width: 2.5px !important; stroke-dasharray: 6 4; }
        .flowchart-link, .messageLine0, .messageLine1 { stroke-width: 2.5px !important; }
        .nodeLabel, .cluster-label, .actor, .messageText, .noteText, .edgeLabel { font-weight: 700 !important; }
        .note { stroke-width: 2.5px !important; }`,
    });
    await mermaid.run({ nodes: diagrams });
  }

  async function drawCharts() {
    const { default: embed } = await import(
      "https://cdn.jsdelivr.net/npm/vega-embed@7/+esm"
    );
    const config = {
      background: null,
      font,
      view: { stroke: null },
      axis: {
        labelFont: font,
        titleFont: font,
        labelFontSize: 13,
        titleFontSize: 13,
        labelColor: color("--quiet"),
        titleColor: ink,
        domainColor: ink,
        domainWidth: 2,
        tickColor: ink,
        gridColor: "#ececec",
      },
      axisX: { tickCount: 8, labelFlush: true },
      legend: { labelFont: font, titleFont: font, labelFontSize: 13 },
      title: { font, fontSize: 15, color: ink },
      range: {
        category: [ink, color("--now"), color("--was"), color("--quiet")],
      },
      line: { color: ink, strokeWidth: 3 },
      point: { color: ink, filled: true, size: 70, opacity: 1 },
      bar: { color: ink },
      rule: { color: color("--was-ink"), strokeWidth: 3, strokeDash: [6, 4] },
      text: { font, fontSize: 13, fontWeight: 700, color: ink },
    };
    for (const script of charts) {
      const spec = JSON.parse(script.textContent);
      const host = document.createElement("div");
      host.className = "chart";
      script.replaceWith(host);
      await embed(
        host,
        {
          width: "container",
          height: 260,
          ...spec,
          config: { ...config, ...spec.config },
        },
        { actions: false, renderer: "svg" },
      );
    }
  }

  await Promise.all([
    diagrams.length && drawDiagrams(),
    charts.length && drawCharts(),
  ]);
  await document.fonts.ready;
})();
