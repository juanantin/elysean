/* =========================================================
   Site config
   ========================================================= */
const CONFIG = {
  // Token contract on Elysium (chain id 99901).
  ca: "0xb7126d3be7C594b0ad3DC68EED791082A18Cc589",

  // Every Volta token launches with exactly 1,000,000,000 supply.
  // Burns reduce totalSupply, so Total Burnt = initial supply − current supply.
  initialSupply: 1000000000n * 10n ** 18n,

  // Live data sources (all public, all allow browser requests).
  rpc: "https://rpc.volta.family",
  explorerApi: "https://explorer-backend-production-8ca1.up.railway.app/api/v2",
  dexscreener: "https://api.dexscreener.com/latest/dex/tokens/",

  // How often the dashboard refreshes, in milliseconds.
  refreshMs: 30000,
};

(function () {
  const fmt = new Intl.NumberFormat("en-US");
  const usd = new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2,
  });
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (id) => document.getElementById(id);

  const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const ZERO_TOPIC = "0x" + "0".repeat(64);
  const toTokens = (wei) => Number(wei / 10n ** 12n) / 1e6; // keeps 6 decimals

  /* ---------- Data fetching ---------- */
  async function rpcBatch(calls) {
    const body = calls.map(([method, params], id) => ({ jsonrpc: "2.0", id, method, params }));
    const res = await fetch(CONFIG.rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("rpc " + res.status);
    const out = await res.json();
    const byId = [];
    for (const r of out) {
      if (r.error) throw new Error(r.error.message);
      byId[r.id] = r.result;
    }
    return byId;
  }

  // Total burnt + burn history (cumulative, by block) straight from the chain.
  async function loadBurns() {
    const [supplyHex, latestHex, burnLogs, mintLogs] = await rpcBatch([
      ["eth_call", [{ to: CONFIG.ca, data: "0x18160ddd" }, "latest"]],
      ["eth_blockNumber", []],
      ["eth_getLogs", [{ address: CONFIG.ca, fromBlock: "0x0", toBlock: "latest", topics: [TRANSFER, null, ZERO_TOPIC] }]],
      ["eth_getLogs", [{ address: CONFIG.ca, fromBlock: "0x0", toBlock: "latest", topics: [TRANSFER, ZERO_TOPIC] }]],
    ]);
    const supply = BigInt(supplyHex);
    const latest = parseInt(latestHex, 16);
    const start = mintLogs.length ? parseInt(mintLogs[0].blockNumber, 16) : null;

    let cum = 0n;
    const points = [];
    if (start != null) points.push([start, 0]);
    for (const log of burnLogs) {
      cum += BigInt(log.data);
      points.push([parseInt(log.blockNumber, 16), toTokens(cum)]);
    }
    if (!points.length) points.push([latest - 1, 0]);
    points.push([latest, toTokens(cum)]);

    return { burnt: toTokens(CONFIG.initialSupply - supply), points };
  }

  // Market cap + 24h volume from DexScreener (the most liquid pair).
  async function loadMarket() {
    const res = await fetch(CONFIG.dexscreener + CONFIG.ca);
    if (!res.ok) throw new Error("dexscreener " + res.status);
    const pairs = (await res.json()).pairs || [];
    if (!pairs.length) return { marketCap: null, volume24h: null };
    const main = pairs.reduce((a, b) => ((b.liquidity?.usd || 0) > (a.liquidity?.usd || 0) ? b : a));
    return {
      marketCap: main.marketCap ?? main.fdv ?? null,
      volume24h: pairs.reduce((s, p) => s + (p.volume?.h24 || 0), 0),
    };
  }

  // Holder count from Volta's Blockscout explorer.
  async function loadHolders() {
    const res = await fetch(`${CONFIG.explorerApi}/tokens/${CONFIG.ca}`);
    if (!res.ok) throw new Error("explorer " + res.status);
    const t = await res.json();
    return t.holders_count != null ? Number(t.holders_count) : null;
  }

  /* ---------- Rendering ---------- */
  const valueEl = $("burn-value");
  let shownBurnt = 0;

  function animateBurnt(target) {
    const from = shownBurnt;
    shownBurnt = target;
    if (reduce || from === target) {
      valueEl.textContent = fmt.format(Math.round(target));
      return;
    }
    const duration = from === 0 ? 1800 : 1000;
    const t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      valueEl.textContent = fmt.format(Math.round(from + (target - from) * ease(t)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  const setText = (id, text) => {
    const el = $(id);
    if (el.textContent !== text) el.textContent = text;
  };

  // Step chart: burns happen in discrete buybacks, so the line steps up at each one.
  const W = 600, H = 140, PAD_TOP = 14, PAD_BOTTOM = 18;
  let chartRevealed = false;

  function drawChart(points) {
    const x0 = points[0][0], x1 = points[points.length - 1][0];
    const max = Math.max(...points.map((p) => p[1])) || 1;
    const sx = (b) => ((b - x0) / (x1 - x0 || 1)) * W;
    const sy = (v) => PAD_TOP + (1 - v / max) * (H - PAD_TOP - PAD_BOTTOM);

    let d = `M0,${sy(points[0][1])}`;
    for (let i = 1; i < points.length; i++) {
      const x = sx(points[i][0]);
      d += ` L${x},${sy(points[i - 1][1])} L${x},${sy(points[i][1])}`;
    }
    $("burn-line").setAttribute("d", d);
    $("burn-area").setAttribute("d", `${d} L${W},${H} L0,${H} Z`);

    if (!chartRevealed && !reduce) {
      $("burn-chart").classList.add("reveal");
      chartRevealed = true;
    }
  }

  async function refresh() {
    const [burns, market, holders] = await Promise.allSettled([loadBurns(), loadMarket(), loadHolders()]);

    if (burns.status === "fulfilled") {
      animateBurnt(burns.value.burnt);
      const pct = (burns.value.burnt / 1e9) * 100; // share of the 1B initial supply
      const pctEl = $("burn-pct");
      pctEl.textContent = `${pct.toFixed(pct < 1 ? 3 : 2)}% of supply`;
      pctEl.hidden = false;
      drawChart(burns.value.points);
    } else console.warn("burn data:", burns.reason);

    if (market.status === "fulfilled") {
      const { marketCap, volume24h } = market.value;
      setText("stat-mc", marketCap == null ? "—" : usd.format(marketCap));
      setText("stat-vol", volume24h == null ? "—" : usd.format(volume24h));
    } else console.warn("market data:", market.reason);

    if (holders.status === "fulfilled") {
      setText("stat-holders", holders.value == null ? "—" : fmt.format(holders.value));
    } else console.warn("holders:", holders.reason);
  }

  refresh();
  let timer = setInterval(refresh, CONFIG.refreshMs);
  // Pause while the tab is hidden; refresh right away when it comes back.
  document.addEventListener("visibilitychange", () => {
    clearInterval(timer);
    if (!document.hidden) {
      refresh();
      timer = setInterval(refresh, CONFIG.refreshMs);
    }
  });

  /* ---------- Contract address ---------- */
  const caValue = $("ca-value");
  const caCopy = $("ca-copy");
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

  /* ---------- Background video ---------- */
  const video = document.querySelector(".hero-video");
  if (video) {
    const p = video.play && video.play();
    if (p && p.catch) p.catch(() => {});
  }
})();
