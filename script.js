/* =========================================================
   Site config — edit these values.
   ========================================================= */
const CONFIG = {
  // Contract address. Leave empty to show "Coming soon".
  ca: "",

  // Total ELYSEAN burnt (placeholder until live data is wired up).
  totalBurnt: 12486320,

  // Cumulative burn history used for the sparkline (any length, oldest first).
  burnHistory: [
    0.4, 0.6, 0.7, 0.9, 1.1, 1.2, 1.5, 1.7, 1.8, 2.1, 2.4, 2.6, 2.7,
    3.1, 3.4, 3.6, 3.9, 4.0, 4.4, 4.9, 5.2, 5.4, 5.9, 6.5, 6.8, 7.3,
    7.9, 8.4, 9.0, 9.8, 10.6, 11.4, 12.49,
  ],
};

(function () {
  const fmt = new Intl.NumberFormat("en-US");

  /* ---------- Count-up for total burnt ---------- */
  const valueEl = document.getElementById("burn-value");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const target = CONFIG.totalBurnt;

  if (reduce) {
    valueEl.textContent = fmt.format(target);
  } else {
    const duration = 1800;
    const start = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      valueEl.textContent = fmt.format(Math.round(target * ease(t)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Sparkline ---------- */
  const W = 600, H = 140, PAD_TOP = 14, PAD_BOTTOM = 18;
  const data = CONFIG.burnHistory;
  if (data.length > 1) {
    const min = Math.min(...data), max = Math.max(...data);
    const span = max - min || 1;
    const pts = data.map((v, i) => [
      (i / (data.length - 1)) * W,
      PAD_TOP + (1 - (v - min) / span) * (H - PAD_TOP - PAD_BOTTOM),
    ]);
    // Smooth path (Catmull-Rom → cubic Bézier)
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
    }
    const line = document.getElementById("burn-line");
    line.setAttribute("d", d);
    document.getElementById("burn-area").setAttribute("d", `${d} L${W},${H} L0,${H} Z`);

    if (!reduce) document.getElementById("burn-chart").classList.add("reveal");
  }

  /* ---------- Contract address ---------- */
  const caValue = document.getElementById("ca-value");
  const caCopy = document.getElementById("ca-copy");
  if (CONFIG.ca) {
    caValue.textContent = CONFIG.ca;
    caValue.title = CONFIG.ca;
    caCopy.disabled = false;
    caCopy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(CONFIG.ca);
        caCopy.textContent = "Copied";
      } catch {
        caCopy.textContent = "Failed";
      }
      setTimeout(() => (caCopy.textContent = "Copy"), 1600);
    });
  }

  /* ---------- Video: fall back to poster if it fails to load ---------- */
  const video = document.querySelector(".hero-video");
  if (video) {
    const p = video.play && video.play();
    if (p && p.catch) p.catch(() => {});
  }
})();
