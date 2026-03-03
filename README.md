# ✦ Under Review Skating

A holographic-aesthetic, fully client-side figure skating scores and statistics website. Pulls live data from Google Sheets via the Google Sheets API v4. No backend, no build tools. Deploys to Vercel in one click.

---

## Quick Start

1. **Create your Google Sheet** — see the schema below
2. **Get a Google Sheets API key** — see instructions below
3. **Edit `js/config.js`** with your Sheet ID and API key
4. **Deploy** to Vercel or serve locally

---

## Google Sheets Setup

### Step 1 — Create the Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet
2. Create **four tabs** with exactly these names (case-sensitive):
   - `Skaters`
   - `Competitions`
   - `Results`
   - `Elements`

### Step 2 — Make it Public

Since the app uses an API key (not OAuth), the sheet must be readable by anyone with the link.

1. Click **Share** → **Change to anyone with the link** → **Viewer**
2. Click Done

### Step 3 — Tab Schemas

Add the header row below as row 1 of each tab, then add data from row 2 onwards.

---

#### `Skaters` tab

| Column | Description |
|---|---|
| `id` | Unique slug used in URLs, e.g. `yuna-kim` |
| `name` | Full display name |
| `country` | Country name, e.g. `South Korea` |
| `country_code` | ISO 3166-1 alpha-2, e.g. `KR` (used for flag emoji) |
| `birthday` | ISO date `YYYY-MM-DD`, e.g. `1990-09-05` |
| `bio` | Short biography (plain text) |
| `personal_best_short` | Numeric PB for Short Program |
| `personal_best_free` | Numeric PB for Free Skate |
| `personal_best_total` | Numeric PB combined total |
| `season_best_short` | Numeric season best for Short Program |
| `season_best_free` | Numeric season best for Free Skate |
| `season_best_total` | Numeric season best combined total |
| `photo_url` | Direct URL to a portrait photo (optional) |

**Example row:**
```
yuna-kim, Yu-Na Kim, South Korea, KR, 1990-09-05, Olympic champion and world record holder., 80.69, 150.06, 228.56, 78.50, 144.19, 219.48,
```

---

#### `Competitions` tab

| Column | Description |
|---|---|
| `id` | Unique slug, e.g. `gpf-2024` |
| `name` | Full event name, e.g. `Grand Prix Final 2024` |
| `location` | City / venue |
| `date` | ISO date of event start, e.g. `2024-12-05` |
| `level` | One of: `Grand Prix`, `Nationals`, `Worlds`, `Olympics` or any custom label |
| `season` | Season identifier, e.g. `2024-25` |

**Example row:**
```
gpf-2024, Grand Prix Final 2024, Turin, Italy, 2024-12-05, Grand Prix, 2024-25
```

---

#### `Results` tab

One row per skater per segment per competition.

| Column | Description |
|---|---|
| `id` | Unique slug, e.g. `gpf24-yuna-sp` |
| `skater_id` | Must match a `Skaters.id` |
| `competition_id` | Must match a `Competitions.id` |
| `segment` | Exactly `Short Program` or `Free Skate` |
| `placement` | Integer placement within this segment |
| `total_score` | Segment total (TES + PCS − Deductions) |
| `technical_score` | Technical Element Score (TES) |
| `component_score` | Program Component Score (PCS) |
| `deductions` | Positive number; displayed as negative |

**Example row:**
```
gpf24-yuna-sp, yuna-kim, gpf-2024, Short Program, 1, 82.35, 46.20, 37.15, 1.00
```

---

#### `Elements` tab

One row per element per result.

| Column | Description |
|---|---|
| `id` | Unique slug, e.g. `gpf24-yuna-sp-e1` |
| `result_id` | Must match a `Results.id` |
| `skater_id` | Must match a `Skaters.id` |
| `competition_id` | Must match a `Competitions.id` |
| `segment` | `Short Program` or `Free Skate` |
| `order_number` | Integer position in the program (1, 2, 3…) |
| `element_code` | ISU element code, e.g. `4Lz`, `3A+2T`, `CCSp4` |
| `element_name` | Human-readable, e.g. `Quadruple Lutz` |
| `base_value` | Numeric base value |
| `goe` | Numeric GOE (can be negative) |
| `panel_score` | `base_value + goe` |
| `is_ultra_c` | `TRUE` or `FALSE` |
| `is_second_half` | `TRUE` or `FALSE` |
| `execution` | One of: `Landed`, `Fall`, `Step Out`, `Downgraded`, `Unclear Edge`, `Rotational Fall` |
| `planned_vs_executed` | One of: `Planned`, `Executed`, `Downgraded` |

**Example row:**
```
gpf24-yuna-sp-e1, gpf24-yuna-sp, yuna-kim, gpf-2024, Short Program, 1, 4Lz, Quadruple Lutz, 11.50, 2.07, 13.57, TRUE, FALSE, Landed, Executed
```

---

### Step 4 — Find your Sheet ID

The Sheet ID is the long string in the URL of your spreadsheet:

```
https://docs.google.com/spreadsheets/d/ [THIS PART] /edit
```

Example: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms`

---

## Get a Google Sheets API Key

### 1. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. In the sidebar: **APIs & Services → Library**
4. Search for **Google Sheets API** → click **Enable**

### 2. Create an API key

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → API key**
3. Copy the key shown

### 3. Restrict the key (recommended)

1. Click your new key to edit it
2. **Application restrictions** → HTTP referrers → add:
   - `https://your-app.vercel.app/*`
   - `http://localhost:*` (for local dev)
3. **API restrictions** → Restrict key → select **Google Sheets API**
4. Click Save

---

## Configure the App

Open `js/config.js` and fill in your values:

```js
const CONFIG = {
  SHEET_ID: 'your-sheet-id-here',
  API_KEY:  'your-api-key-here',
  TABS: {
    SKATERS:      'Skaters',
    COMPETITIONS: 'Competitions',
    RESULTS:      'Results',
    ELEMENTS:     'Elements',
  },
};
```

If the tab names in your sheet differ from the defaults, update the `TABS` object accordingly.

---

## Local Development

The app makes fetch requests to the Sheets API, so you need a local HTTP server (not `file://` protocol):

```bash
# Python
python3 -m http.server 8080

# Node (npx)
npx serve .

# VS Code: install the "Live Server" extension and click "Go Live"
```

Then open `http://localhost:8080`

---

## Deploy to Vercel

### Option A — One-click (recommended)

1. Push this folder to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Import your GitHub repo
4. No build settings needed — it's a static site
5. Click **Deploy**

The included `vercel.json` already handles client-side routing rewrites.

### Option B — Vercel CLI

```bash
npm i -g vercel
cd under-review-skating
vercel
```

---

## File Structure

```
under-review-skating/
├── index.html                   # Single HTML entry point
├── vercel.json                  # Vercel SPA rewrite rules + security headers
├── README.md                    # This file
├── css/
│   └── main.css                 # All styles — holographic aesthetic
└── js/
    ├── config.js                # ← EDIT THIS with your Sheet ID & API key
    ├── sheets.js                # Google Sheets data layer + in-memory cache
    ├── router.js                # Hash-based client-side router
    ├── app.js                   # Bootstrap: registers routes, renders nav
    ├── components/
    │   ├── nav.js               # Navigation, search, dark/light toggle
    │   ├── charts.js            # SVG chart drawing (line, bar, dot — no libs)
    │   └── sparkles.js          # Ambient sparkle decoration utility
    └── pages/
        ├── home.js              # Home / Competition Hub
        ├── skater.js            # Skater profile page
        ├── competition.js       # Event / competition page
        ├── protocol.js          # Protocol sheet (element-by-element)
        └── stats.js             # Global statistics
```

---

## Pages & Routes

| URL | Page |
|---|---|
| `#/` | Home — animated hero, live leaderboard, recent events, featured skaters |
| `#/skater/:id` | Skater profile — PBs, career stats, score progression chart, competition history |
| `#/competition/:id` | Event — SP & FS tables, score distribution, best moments panel |
| `#/protocol/:result_id` | Protocol sheet — element-by-element with GOE, execution badges, Ultra-C landing rates |
| `#/stats` | Statistics — top combined scores, PCS leaders, UC landing rates, clutch ratings, UC frequency map |

---

## Design

The background uses CSS `@property` to register `--hue-shift` as a `<number>`, which lets `@keyframes` animate it numerically — smoothly cycling `hsl()` color stops through the full color wheel every 22 seconds. Layered on top is an SVG `feTurbulence` grain texture at `mix-blend-mode: overlay`. All cards use `backdrop-filter: blur(16px)` frosted glass.

**Dark mode** swaps from soft pastels to deep jewel tones (indigo, teal, magenta) via `.dark` on `<body>`, toggled by the nav button and persisted to `localStorage`.

**Ultra-C elements** get a rainbow shimmer via `background-clip: text` on the label and a masked gradient pseudo-element border with `animation: shimmer-move`.

---

## Extending

- **New page**: create `js/pages/mypage.js`, add `Router.add('/mypath', () => renderMyPage())` in `js/app.js`
- **New sheet tab**: add a `fetchTab()` call in `sheets.js → loadAll()`, expose a getter function
- **Change fonts**: update the Google Fonts link in `index.html` and `--font-display` / `--font-body` in `css/main.css`
- **Change gradient colors**: edit the `hsl()` values in `body:not(.dark)` and `body.dark` in `css/main.css`

---

*Pure HTML, CSS, and vanilla JavaScript. No build tools, no frameworks, no bundler.*
