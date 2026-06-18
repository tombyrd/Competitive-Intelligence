# LinkedIn Ad Intelligence Dashboard — Claude Code Build Specification

**Version:** 1.0  
**Author:** IFS Competitive & Marketing Intelligence  
**Purpose:** Internal competitive intelligence platform for analysing competitor LinkedIn Ads Library data scraped via Apify  
**Target Users:** IFS CI team, Product Marketing, Sales Enablement  

---

## 1. Overview

Build a self-contained, single-file HTML dashboard (`linkedin-ad-intelligence.html`) that ingests one or more LinkedIn Ad Library JSON datasets scraped from Apify and provides a fully interactive competitive intelligence platform. The dashboard must be suitable for internal IFS use and follow the Nexus Black (NxB) visual design system.

The platform has **no backend**. All data loading, filtering, analysis, and rendering happens in the browser via vanilla JavaScript. The user loads their JSON files directly into the browser.

---

## 2. Data Schema Reference

Each dataset is a JSON array. The following fields may appear on each record (not all fields are present on every record):

| Field | Type | Description |
|---|---|---|
| `adId` | string | Unique LinkedIn ad identifier |
| `adLibraryUrl` | string | Direct URL to the ad in LinkedIn's Ad Library |
| `advertiserName` | string | Name of the company running the ad |
| `advertiserUrl` | string | URL to the advertiser's LinkedIn company page |
| `advertiserLogo` | string (URL) | CDN URL for the advertiser's logo |
| `body` | string | Main ad copy / body text |
| `headline` | string | Ad headline (single-image / video ads) |
| `ctas` | array of strings | Call-to-action labels e.g. "Learn more", "Download" |
| `format` | string | Ad format: `SINGLE_IMAGE`, `CAROUSEL`, `VIDEO`, `DOCUMENT`, `MESSAGE`, `TEXT`, `LINKEDIN_ARTICLE`, `JOB` |
| `paidBy` | string | Legal entity paying for the ad |
| `slides` | array of `{headline, imageUrl}` | Carousel/document slides |
| `imageUrl` | string (URL) | Single image ad creative URL |
| `imageUrls` | array of strings | Multiple image URLs |
| `videoUrl` | string (URL) | Video ad URL |
| `documentUrl` | string (URL) | Document ad URL |
| `clickUrl` | string (URL) | Destination URL of the ad |
| `availability` | `{start, end}` | Active date range (ISO dates) |
| `impressions` | string | Impression band e.g. `"1k-5k"`, `"10k-20k"`, `"100k-150k"`, `"< 1k"` |
| `impressionsPerCountry` | array of `{country, impressions}` | Country-level impression breakdown |
| `targeting` | `{language, location}` | Audience targeting data |
| `senderImageUrl` | string (URL) | Sender profile image (Message ads) |
| `thoughtLeaderMemberName` | string | Thought leadership author name |
| `thoughtLeaderMemberUrl` | string | Thought leadership author LinkedIn URL |
| `thoughtLeaderJobTitle` | string | Author job title |
| `thoughtLeaderMemberImageUrl` | string (URL) | Author profile photo |
| `startUrl` | string | The Apify scrape entry URL |

---

## 3. Design System — Nexus Black (NxB)

Apply these design tokens consistently across the entire platform.

### 3.1 CSS Variables

```css
:root {
  --black:   #000000;
  --bg:      #050505;
  --surface: #0a0a0a;
  --surface2:#111111;
  --border:  #1a1a1a;
  --border2: #222222;
  --white:   #ffffff;
  --grey:    #777777;
  --light:   #bbbbbb;
  --green:   #00C67A;
  --amber:   #F59E0B;
  --red:     #EF4444;
  --blue:    #60A5FA;
  --purple:  #A78BFA;
  --teal:    #2DD4BF;
}
```

### 3.2 Typography

- **Primary font:** Inter (weights 300, 400, 500, 600, 700, 800) — load from Google Fonts
- **Mono font:** JetBrains Mono (weights 400, 500) — load from Google Fonts
- Hero title: `clamp(2rem, 5vw, 3.2rem)`, weight 800, letter-spacing -0.04em
- Section titles: `1.5rem`, weight 700, letter-spacing -0.03em
- Body text: `0.85rem`, weight 400
- Labels / tags: JetBrains Mono, `0.55rem`, uppercase, letter-spacing 0.15em
- Stat values: `1.6rem`, weight 700

### 3.3 Colour Semantics

| Colour | Use Case |
|---|---|
| Purple (`#A78BFA`) | Primary accent, AI/Intelligence, brand highlight |
| Green (`#00C67A`) | Positive signal, high impressions, active ads |
| Amber (`#F59E0B`) | Warning, attention, mid-range metrics |
| Red (`#EF4444`) | Competitive threat, critical flag |
| Blue (`#60A5FA`) | Informational, neutral data, links |
| Teal (`#2DD4BF`) | Secondary accent (use sparingly) |
| Grey (`#777`) | Labels, inactive, secondary |

### 3.4 Component Patterns

- Cards: `background: var(--surface)`, `border: 1px solid var(--border2)`, `border-radius: 8px`
- Section labels: JetBrains Mono, uppercase, grey, small — e.g. `COMPETITIVE INTELLIGENCE`
- Section titles: use `<em>` tag on a key word, styled `color: var(--purple); font-style: normal`
- Sidebar nav: 220px fixed left, collapsible on mobile
- Charts: ECharts 5 via CDN, `backgroundColor: 'transparent'`, tooltip dark theme
- No emojis anywhere

---

## 4. External Dependencies (CDN)

Load all from CDN — no npm/build step:

```html
<!-- Google Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">

<!-- ECharts 5 -->
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
```

No other external dependencies required.

---

## 5. Application Architecture

### 5.1 Layout

Use a **sidebar navigation** layout:

```
┌──────────────────────────────────────────────────────────┐
│  TOP HEADER BAR — Brand name, dataset info, load button  │
├──────────┬───────────────────────────────────────────────┤
│          │                                               │
│ SIDEBAR  │   MAIN CONTENT AREA                          │
│  NAV     │   (section rendered based on nav selection)  │
│ 220px    │                                               │
│ fixed    │                                               │
│          │                                               │
└──────────┴───────────────────────────────────────────────┘
```

### 5.2 State Management

All application state is managed in a single global `AppState` object:

```javascript
const AppState = {
  rawData: [],          // All records across all loaded files
  filteredData: [],     // Records after filters applied
  selectedAd: null,     // Currently open ad detail
  filters: {
    advertiser: [],     // Multi-select
    format: [],         // Multi-select
    impressionBand: [], // Multi-select
    cta: [],            // Multi-select
    language: [],       // Multi-select
    dateRange: { start: null, end: null },
    keyword: '',        // Full-text search
    hasImage: null,     // true/false/null
    hasVideo: null,
  },
  sortBy: 'impressions_desc',
  activeSection: 'overview',
};
```

Whenever filters change, call `applyFilters()` → `renderActiveSection()`. No page reloads.

### 5.3 File Loading

Support **multiple JSON file loads**. On each load, append to `rawData` (deduplicate by `adId`). Display a badge showing total ads loaded and number of source files.

```javascript
// File input — accept .json files, multiple
// On load: JSON.parse → validate schema → merge → applyFilters() → renderAll()
```

Provide a **"Load Sample Data"** button that loads a hardcoded minimal dataset of 3 records for first-time demo purposes, so the dashboard is not blank on first open.

---

## 6. Sections & Features

### 6.1 Section: Overview (default landing page)

**Purpose:** Executive summary of the loaded dataset.

**Components:**

**Stat Bar (5 metrics):**
- Total Ads Loaded
- Number of Unique Advertisers
- Most Active Format (with count)
- Highest Impression Ad (advertiser + band)
- Date Range Span (earliest start → latest end)

**Charts — render 3 charts in a 3-column grid:**

1. **Ad Format Distribution** — Horizontal bar chart. Bars coloured by format type (SINGLE_IMAGE=blue, CAROUSEL=purple, VIDEO=amber, DOCUMENT=teal, MESSAGE=grey, TEXT=grey, others=grey). Show count and % label on each bar.

2. **Top Advertisers by Ad Count** — Horizontal bar chart, top 10 advertisers, sorted descending. Colour bars purple. On bar click, filter the dashboard to that advertiser.

3. **Impression Band Distribution** — Donut chart. Bands ordered: `< 1k`, `1k-5k`, `5k-10k`, `10k-20k`, `20k-30k`, `30k-50k`, `100k-150k`. Colour-coded: green = high, amber = mid, grey = low.

**Insight Callouts (below charts):**
- Automatically generate 3-4 insight callouts based on data patterns. Example logic:
  - If one advertiser has >40% of all ads → red callout: "Advertiser X dominates this dataset with N% share of ads"
  - If VIDEO format is low (<5%) → amber callout: "Video adoption is low across this competitor set"
  - If impressions data is sparse → info callout: "X% of ads have no impression data — LinkedIn may throttle this for newer ads"
  - Most common CTA → info callout: "Most common CTA is 'X' — appearing in N% of ads"

---

### 6.2 Section: Ad Explorer

**Purpose:** Browse, filter, and inspect every individual ad in the dataset.

#### 6.2.1 Filter Panel (persistent left sub-panel or collapsible top bar)

Provide the following filters, all of which update results live on change:

| Filter | Type | Options |
|---|---|---|
| **Keyword search** | Text input | Searches across `body`, `headline`, all slide `headline` fields, `advertiserName`, `paidBy` |
| **Advertiser** | Multi-select checkbox list | All unique advertiser names, sorted alphabetically. Show ad count next to each. |
| **Format** | Multi-select checkbox list | All format values present in dataset |
| **Impression Band** | Multi-select checkbox list | All impression bands, ordered numerically |
| **CTA** | Multi-select checkbox list | All unique CTA strings |
| **Language** | Multi-select checkbox list | All unique `targeting.language` values |
| **Has Image** | Toggle (Yes / No / Any) | Filter by whether `imageUrl` or `imageUrls` is present |
| **Has Video** | Toggle (Yes / No / Any) | Filter by whether `videoUrl` is present |
| **Date Range** | Two date inputs (Start / End) | Filter by `availability.start` and `availability.end` |
| **Active Only** | Toggle | If enabled, only show ads where `availability.end` >= today |

Include a **"Clear All Filters"** button and a **live result count** e.g. `Showing 147 of 713 ads`.

Include a **Sort By** dropdown:
- Impressions (High → Low)
- Impressions (Low → High)
- Advertiser (A-Z)
- Format
- Most Recent (by `availability.start`)
- Oldest First

#### 6.2.2 Ad Grid

Display filtered ads in a **responsive card grid** (3 columns desktop, 2 columns tablet, 1 column mobile).

**Each Ad Card must show:**

- Advertiser logo (if `advertiserLogo` present) — 32px circle, fallback to first letter of `advertiserName` in a coloured circle
- Advertiser name — link to `advertiserUrl` (opens new tab)
- Format badge — pill tag with format name, colour coded
- Impression band badge — if present, coloured pill (green for high, amber for mid, grey for low/none)
- Ad body text — truncated to 3 lines with `text-overflow`, expandable on hover
- Headline (if present)
- **Primary creative preview:**
  - If `SINGLE_IMAGE` / `CAROUSEL` first slide: show image thumbnail (lazy-loaded, `object-fit: cover`, fixed 180px height, click opens lightbox)
  - If `VIDEO`: show a play-icon overlay on a dark placeholder card. If `imageUrl` also present, use that as poster
  - If `DOCUMENT`: show a document icon with `documentUrl` link
  - If `MESSAGE`: show envelope icon
  - If `CAROUSEL`: show a filmstrip row of up to 4 thumbnail images from `slides[].imageUrl`
- CTA label(s) — displayed as small tag(s)
- `paidBy` entity — small grey text below advertiser name
- Active date range from `availability` (if present)
- **"View Full Ad"** button — opens the Ad Detail Modal

#### 6.2.3 Ad Detail Modal

When clicking **"View Full Ad"** on any card, open a full-screen modal overlay with:

- Close button (top right, keyboard Escape also closes)
- Advertiser logo + name + link to LinkedIn page
- `paidBy` entity
- Ad format badge
- Impression band + per-country breakdown table (country | impression %)
- Targeting info: language, location
- Availability date range
- Full `body` text (no truncation)
- `headline`
- All CTA labels
- **Full creative display:**
  - SINGLE_IMAGE: full image (max 100% width, click to open in new tab)
  - CAROUSEL: horizontal scrollable slide strip — each slide shows `imageUrl` + `headline`
  - VIDEO: `<video>` element with controls if `videoUrl` is a direct video URL; otherwise a linked button to the URL
  - DOCUMENT: download/open link button
  - MESSAGE: show `senderImageUrl` + body copy
  - Thought leadership fields: show author name, job title, avatar if `thoughtLeaderMemberName` present
- `clickUrl` — shown as a "Destination URL" field with a copy button
- `adLibraryUrl` — "View on LinkedIn" button (opens new tab)
- Navigation arrows (previous / next ad within current filtered set)

---

### 6.3 Section: Competitive Analysis

**Purpose:** Side-by-side and aggregated analysis comparing advertisers.

#### 6.3.1 Advertiser Comparison Table

A sortable table with one row per advertiser. Columns:

| Column | Logic |
|---|---|
| Logo | `advertiserLogo` (32px) |
| Advertiser | Name, linked to LinkedIn |
| Total Ads | Count of ads |
| Formats Used | Comma-separated unique formats |
| Avg Impression Band | Median band (map bands to numeric midpoint for ranking) |
| Top CTA | Most frequent CTA string |
| Top Language | Most targeted language |
| Active Date Range | Min start → Max end |
| Carousel Use % | % of ads that are CAROUSEL |
| Video Use % | % of ads that are VIDEO |

Make all columns sortable by clicking the header (ascending/descending toggle with caret indicator).

#### 6.3.2 Format Strategy Heatmap

A matrix heatmap:
- Rows: Advertisers (top 10 by ad count)
- Columns: Ad Formats
- Cell value: Number of ads for that advertiser × format combination
- Colour scale: white (0) → purple (max), using the NxB purple

Hovering a cell shows a tooltip: `[Advertiser] ran [N] [FORMAT] ads`.

#### 6.3.3 Impression Share Chart

Stacked horizontal bar chart showing estimated impression share by advertiser. For each ad, map the impression band to a numeric midpoint (e.g. `1k-5k` → 3000, `10k-20k` → 15000, `< 1k` → 500). Sum per advertiser. Display as a % share bar, coloured by advertiser. Only include advertisers with impression data.

Add an info callout below: "Impression data is provided as bands by LinkedIn's Ad Library. Numeric estimates use band midpoints and are directional only."

#### 6.3.4 CTA Strategy Panel

For each advertiser (top 10), show a small card with their top 3 CTAs and counts. Laid out in a 2×5 grid. Useful for understanding what actions competitors are driving.

---

### 6.4 Section: Creative Intelligence

**Purpose:** Visual gallery and messaging analysis of ad creatives.

#### 6.4.1 Image Gallery

A masonry-style grid of all ad images across the dataset (from `imageUrl`, `imageUrls`, and `slides[].imageUrl`). Each image shows:
- Advertiser logo overlay (bottom left, small)
- Format badge (top right)
- Impression band badge (top left, if present)
- On click: opens the parent Ad Detail Modal

Include a filter at the top:
- Filter by Advertiser (dropdown)
- Filter by Format (multi-select)
- A **"Show only high-impression ads"** toggle (10k+ only)

Use `loading="lazy"` on all images. Handle broken image URLs gracefully — show a placeholder card with advertiser name and format instead of a broken image icon.

#### 6.4.2 Headline & Copy Analysis

A word frequency analysis panel:

- Extract all unique words from `body` and `headline` fields (normalise to lowercase, strip punctuation, filter English stopwords)
- Display as a **ranked table**: Rank | Word | Frequency | % of Ads it appears in
- Table is sortable, and rows are colour-coded: top 10 words highlighted purple
- Separate tabs for: **All Advertisers** | **Per Advertiser** (dropdown selector)

Below the table, a **key themes section**: group common marketing themes automatically:
- AI / Intelligence terms: "AI", "artificial intelligence", "machine learning", "intelligent", "agentic"
- Cloud / Digital terms: "cloud", "digital", "transformation", "platform", "SaaS"
- ROI / Business terms: "efficiency", "productivity", "cost", "ROI", "savings", "growth"
- Show a count of ads mentioning each theme cluster, by advertiser

#### 6.4.3 CTA Frequency Chart

Horizontal bar chart of all CTA values, sorted by frequency. Colour bars by whether the CTA is acquisition-oriented (Download, Register, Apply → green), awareness-oriented (Learn more, See more → blue), or other (grey).

---

### 6.5 Section: Geographic Intelligence

**Purpose:** Understand where competitors are targeting.

#### 6.5.1 Country Coverage Table

Parse all `impressionsPerCountry` arrays across the dataset. Build a table:
- Row per country
- Columns: Country | Total Ads Targeting It | Advertisers Active Here | Impression Density (% of ads with >1% impression share)

Sortable by any column. Highlight UK, USA, Germany, France, Netherlands in blue (IFS's core markets).

#### 6.5.2 Advertiser × Country Matrix

Heatmap (same style as 6.3.2):
- Rows: Top 10 advertisers
- Columns: Top 15 countries by ad coverage
- Cell = number of ads with impressions in that country
- Colour: white → teal scale

#### 6.5.3 Targeting Language Breakdown

Donut chart of `targeting.language` distribution. Below it, a table: Language | Count | % | Top Advertisers using it.

---

### 6.6 Section: Thought Leadership Tracker

**Purpose:** Track individual employees or executives at competitors running thought leadership ads.

Show all ads where `thoughtLeaderMemberName` is present.

For each unique thought leader, show a card:
- Profile photo (`thoughtLeaderMemberImageUrl`)
- Name (linked to `thoughtLeaderMemberUrl`)
- Job title (`thoughtLeaderJobTitle`)
- Company (via `advertiserName`)
- Number of sponsored posts
- Preview of post body text (first 100 chars)
- Date range of posts

Include a filter by advertiser/company. This section is useful for tracking which competitor executives are being amplified via paid LinkedIn.

---

### 6.7 Section: Raw Data Table

**Purpose:** Full tabular view with export.

A paginated, sortable, searchable table of all records. Columns:

`adId` | `advertiserName` | `format` | `impressions` | `headline` | `body` (truncated 80 chars) | `ctas` | `paidBy` | `availability.start` | `availability.end` | `targeting.location` | `targeting.language` | Ad Library Link

- Pagination: 50 rows per page with page controls
- Global search input (filters all text columns)
- Column header sort (click to toggle asc/desc)
- **Export buttons:**
  - **Export to CSV** — exports all currently filtered rows to a `.csv` file download
  - **Export to JSON** — exports filtered rows as a `.json` file download
- **Copy Row** — clicking a row copies key fields to clipboard as tab-separated text (useful for pasting into Excel)

---

## 7. Global Controls & UX

### 7.1 Top Header Bar

Fixed at top, full width. Contains:

- **Brand mark:** `NxB` in purple mono font + `LinkedIn Ad Intelligence` in white
- **Dataset info:** e.g. `713 ads · 3 files loaded · Last loaded: 18 Jun 2026`
- **Load Data button:** Opens file picker for `.json` files (multiple select). On load, show a progress indicator (file name + record count parsed)
- **Clear All Data button:** Resets `AppState.rawData` to empty, clears all views
- **Keyboard shortcuts hint:** Small `?` icon — on click shows a modal listing shortcuts

### 7.2 Sidebar Navigation

Fixed 220px left sidebar. Links:
- Overview
- Ad Explorer
- Competitive Analysis
- Creative Intelligence
- Geographic Intelligence
- Thought Leadership
- Raw Data

Active section highlighted with purple left border. Clicking a nav item renders that section in the main content area without full page reload.

On mobile (< 768px): sidebar collapses to a hamburger menu.

### 7.3 Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `/` | Focus keyword search in Ad Explorer |
| `Escape` | Close open modal |
| `←` / `→` | Navigate prev/next ad in open detail modal |
| `1`–`7` | Jump to section by number |

### 7.4 Toast Notifications

Show non-blocking toast messages (bottom right, auto-dismiss 3s) for:
- File loaded successfully: `"Loaded 713 ads from [filename]"`
- Duplicate ads skipped: `"47 duplicate ad IDs skipped"`
- No results from filter: `"No ads match current filters"`
- CSV export complete: `"Exported 147 rows to CSV"`

### 7.5 Empty States

Every section must handle gracefully when `filteredData` is empty or `rawData` is empty:
- Show a clear placeholder card: "No data loaded — use the Load Data button to import your Apify JSON export"
- No broken charts or JavaScript errors

---

## 8. Performance Requirements

- All images must use `loading="lazy"` — do not preload all LinkedIn CDN images on mount
- ECharts instances must be destroyed and re-initialised when sections change (prevent memory leaks)
- Filtering must be synchronous and feel instant up to ~5,000 records
- For datasets >5,000 records, paginate the Ad Grid (100 cards per page)
- Large JSON files (>10MB) should show a loading spinner during parse

---

## 9. File Structure

The deliverable is a **single self-contained HTML file**:

```
linkedin-ad-intelligence.html
```

All CSS, JavaScript, and HTML in one file. No external files required at runtime beyond CDN resources (Google Fonts, ECharts).

Structure the code within the file as:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <!-- meta, fonts, echarts CDN -->
  <style>
    /* All CSS — design tokens first, then layout, then components */
  </style>
</head>
<body>
  <!-- Header -->
  <!-- Sidebar -->
  <!-- Main content container -->
  <!-- Modal overlay -->
  <!-- Toast container -->

  <script>
    // 1. Constants & design tokens
    // 2. AppState
    // 3. Data loading & parsing functions
    // 4. Filter functions
    // 5. Chart rendering functions (per section)
    // 6. Section render functions (one per section)
    // 7. Modal functions
    // 8. Export functions
    // 9. Event listeners & keyboard shortcuts
    // 10. Init
  </script>
</body>
</html>
```

---

## 10. Sample Data (Hardcoded for Demo)

Include a minimal hardcoded sample dataset (3 records) that loads when the user clicks "Load Sample Data". This ensures the dashboard is not blank when first opened. Use realistic-looking placeholder data matching the schema — do not invent real LinkedIn URLs. Mark sample data with a visible badge `DEMO DATA` in the header when active.

---

## 11. Browser Compatibility

Target: Chrome 110+, Edge 110+, Firefox 110+, Safari 16+. No IE11 support required.

---

## 12. Acceptance Checklist

Before considering the build complete, verify:

- [ ] JSON files load correctly and merge without duplicates
- [ ] All 7 sections render without JavaScript errors
- [ ] All 3 overview charts render with correct data
- [ ] Ad Explorer keyword search works across body + headline + slides
- [ ] All filter controls update the ad grid live
- [ ] Ad Detail Modal opens with full creative display
- [ ] Image thumbnails load (or show placeholder on 404)
- [ ] CSV and JSON export downloads work
- [ ] Competitive Analysis heatmap renders correctly
- [ ] Impression share chart handles ads with no impression data gracefully
- [ ] Geographic table highlights IFS core markets
- [ ] Thought Leadership section handles empty state (no thought leader ads in dataset)
- [ ] Keyboard shortcuts work
- [ ] Toast notifications appear and dismiss
- [ ] Responsive layout works at 375px mobile width
- [ ] No emojis anywhere in the UI
- [ ] Dark NxB theme applied consistently throughout

---

## 13. Build Instructions for Claude Code

1. Read this entire specification before writing any code
2. Start with the HTML skeleton, CSS design tokens, and layout (header + sidebar + main)
3. Build the data loading and `AppState` management layer
4. Build the Overview section with all 3 charts
5. Build the Ad Explorer with filters and card grid
6. Build the Ad Detail Modal
7. Build the Competitive Analysis section
8. Build the Creative Intelligence section
9. Build the Geographic Intelligence section
10. Build the Thought Leadership section
11. Build the Raw Data table with export
12. Wire up all keyboard shortcuts and toast notifications
13. Test with the provided dataset file (713 SAP-related ads)
14. Verify acceptance checklist

**The target dataset for initial testing is:**  
`dataset_linkedin-ad-library-scraper_2026-06-18_09-36-48-384.json`  
This contains 713 ads predominantly from SAP and SAP ecosystem advertisers, with formats including SINGLE_IMAGE (425), CAROUSEL (84), DOCUMENT (85), VIDEO (63), MESSAGE (30), TEXT (22), and others.

---

*Prepared by IFS Competitive & Marketing Intelligence — NxB Brand Platform*  
*Classification: Internal Use Only*
