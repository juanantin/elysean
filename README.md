# The Elysean

Static landing page. No build step — open `index.html` or serve the folder:

```bash
python3 -m http.server 8000
```

## Edit
- **Contract address / data sources / refresh rate:** `CONFIG` at the top of `script.js`.

## Live dashboard data
Fetched in the visitor's browser and refreshed every 30s (paused while the tab is hidden):

| Metric | Source |
|---|---|
| Total Burnt + chart | Elysium RPC (`rpc.volta.family`): 1,000,000,000 − `totalSupply()`, and burn `Transfer` events to `0x0` |
| Market Cap, 24h Volume | DexScreener token API (most liquid pair; volume summed over pairs) |
| Holders | Volta's Blockscout explorer API (`holders_count`) |

If a source is down, the last value stays on screen.
- **Background video:** `assets/hero.webm` + `assets/hero.mp4` (+ `hero-poster.jpg`). Replace with the same names to swap.
- **Links:** X → https://x.com/elysian_KNTQ, Volta → https://www.volta.family/token/0xb7126d3be7C594b0ad3DC68EED791082A18Cc589 (in `index.html`).
