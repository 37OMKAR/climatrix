# Climatrix 🌍⚡
### Institutional Physical & Transition Climate Risk Analytics for Banking, Infrastructure & Portfolios

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900.svg?logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![IPCC AR6 / CMIP6](https://img.shields.io/badge/Science-IPCC_AR6_%7C_CMIP6-brightgreen.svg)](https://www.ipcc.ch/assessment-report/ar6/)
[![Tests](https://img.shields.io/badge/Tests-48%20Passed-success.svg)](scripts/test_engine.ts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Climatrix** is an enterprise-grade climate intelligence and portfolio stress-testing platform. Engineered for commercial banks, credit rating agencies, insurers, and infrastructure developers, Climatrix computes high-resolution physical hazard exposure, asset-level Expected Annual Loss (EAL), and NGFS transition risk across global coordinates in under 1 second.

---

## 🌟 Key Capabilities

### 1. 26 Physical Hazards Across 6 Risk Families
Comprehensive spatial screening covering acute and chronic perils grounded strictly in peer-reviewed scientific datasets:
* **🌊 Flood & Water Inundation**: JRC GloFAS River Flood (90m, RP10–500), Deltares Global Coastal Flood (90m hydrodynamic storm surge + sea level rise), Heavy Rain / Pluvial Cloudburst (ERA5 Gumbel extremes), Chronic Sea Level Rise (IPCC AR6).
* **🔥 Heat & Cryosphere**: Extreme Heat (>35°C days), Heatwaves (ETCCDI WSDI warm-spell duration), Humid Heat Stress (Stull wet-bulb Tw), Extreme Cold Frost Days, Permafrost Thaw (MAAT), Heavy Snowfall.
* **🌪️ Wind & Atmospheric**: Tropical Cyclones (STORM synthetic tracks + HighResMIP 10km return periods), Peak Windstorms (ERA5 50-year gusts), CAMS Global Dust.
* **🏜️ Drought & Hydrology**: Drought Severity (SPEI-12 via Hargreaves potential evapotranspiration), WRI Aqueduct 4.0 Baseline & Future Water Stress, Water Scarcity (Water Table Depth ~10km), Groundwater Depletion.
* **⚡ Geology & Natural Hazards**: InSAR Land Subsidence (~1km radar), Landslide Susceptibility (IIT Bombay ILSM 100m + Horn slope), USGS Global Earthquake PGA, NCEI Paleotsunami Runups, Smithsonian GVP Holocene Volcanoes, WWLLN High-Resolution Lightning Climatology.
* **🏭 Transition & Emissions**: UNEP FI sector transition vulnerability, NGFS Carbon Shadow Pricing (GCAM/MESSAGEix Net Zero 2050, Below 2°C, Delayed Transition in USD and INR), and Climate TRACE asset-level emitting facilities within 50 km.

### 2. High-Resolution Basemaps & Satellite Imagery
* **Google Earth (Hybrid Satellite)**: Centimeter-grade aerial imagery with street networks and place names up to zoom level 21.
* **Google Earth (Pure Satellite)**: Unobstructed high-resolution satellite imagery.
* **Google Maps (Streets & Terrain)**: Clean road navigation and hillshade topography.
* **Esri World Imagery & OpenStreetMap**: Resilient open GIS alternatives.
* **Instant Pin Drops**: Sub-16ms marker placement on map click with zero UI delay.

### 3. Downscaled CMIP6 Physics Engine (Zero-Key Autonomy)
* **100% Reliable Offline & Free**: When third-party open APIs hit rate limits (HTTP 429), Climatrix automatically synthesizes physically rigorous parameters from its built-in downscaled climate engine.
* **Environmental Lapse Rates**: Elevational cooling (-6.5°C / km) protects mountain summits from false heatwaves.
* **Distance-to-Coast Buffers**: Strict geodesic ocean masking ensures inland sites (>50 km or >30m elevation) never report false coastal flooding or marine storm surges.
* **Köppen-Geiger Biome Classification**: Realistic baseline calibration across arid wadis, tropical rainforests, continental steppes, and alpine zones.

### 4. Operational Weather Forecast (Next 3 Days)
Alongside decadal climate stress testing (2030, 2050, 2080), Climatrix displays a real-time **Next 3 Days Operational Weather Outlook** with max/min temperatures, precipitation sums (mm), and peak wind gusts (km/h) for immediate operational risk monitoring.

### 5. Institutional Portfolio & Loan Underwriting
* **Batch Loan Screening**: Upload CSV portfolios containing thousands of loans with borrower names, coordinates/addresses, tenures, and exposure values.
* **Tenure-Matched Horizons**: Automatically evaluates 3-year loans at their actual maturity year rather than penalizing short-tenure debt on 2090 climate scenarios.
* **Financial Loss Engine**: Computes structural Expected Annual Loss (EAL) and Portfolio Value-at-Risk (VaR 95% and VaR 99.5%) across commercial, industrial, residential, and agricultural asset classes.
* **Export-Ready Reporting**: 1-click institutional CSV exports formatted for regulatory audits.

---

## 🏛️ Regulatory & Standards Alignment

Climatrix directly satisfies mandatory and voluntary disclosure frameworks:
* **TCFD & ISSB (IFRS S2)**: Governance, strategy, physical risk scenario analysis (SSP1-2.6 to SSP5-8.5), and transition metrics.
* **BCBS (Basel Committee on Banking Supervision)**: Principles for the effective management and supervision of climate-related financial risks.
* **RBI (Reserve Bank of India)**: Draft Disclosure Framework on Climate-related Financial Risks for Banks and NBFCs.
* **EU Taxonomy & CSRD**: DNSH (Do No Significant Harm) physical risk assessments for acute and chronic perils.

---

## 🔬 Scientific Data Sources

| Hazard Domain | Primary Dataset & Publisher | Resolution |
| :--- | :--- | :--- |
| **River Flooding** | JRC GloFAS Global River Flood Maps v2.1.2 (European Commission) | 90 m |
| **Coastal Inundation** | Deltares Global Flood Hazard (Microsoft Planetary Computer) | 90 m |
| **Tropical Cyclone Wind** | STORM Synthetic Tracks (Bloemendaal et al., HighResMIP) | 10 km |
| **Reanalysis & Heat** | ECMWF ERA5-Land & ERA5 Hourly Land-Surface Reanalysis | 9 km / 31 km |
| **Climate Projections** | CMIP6 Multi-Model Ensembles (EC-Earth3P-HR, MRI-AGCM3, NASA NEX-GDDP) | 0.25° (~25 km) |
| **Water Stress** | WRI Aqueduct 4.0 Water Risk Atlas (World Resources Institute) | Basin / Province |
| **Digital Elevation** | Copernicus DEM GLO-30 / GLO-90 (European Space Agency) | 30 m / 90 m |
| **Ground Subsidence** | Global InSAR Land-Subsidence Map (Davydzenka et al., 2024) | ~1 km |
| **Earthquake Hazard** | USGS Global Earthquake Hazards Program / GEM Global Seismic Model | Point / Historical |
| **Tsunami Runup** | NOAA NCEI Global Historical Tsunami Database | Historical points |
| **Volcanic Hazard** | Smithsonian Global Volcanism Program (GVP Holocene) | Verified vents |
| **Lightning Risk** | WWLLN Global Lightning Climatology (WGLC) | 0.5° (~50 km) |
| **Emissions Context** | Climate TRACE Asset-Level Greenhouse Gas Inventory (v7 API) | Exact Facility |

---

## 🚀 Quick Start

### Prerequisites
* **Node.js** >= 18.0.0
* **npm** >= 9.0.0

### Installation
```bash
# Clone the repository
git clone https://github.com/37OMKAR/climatrix.git
cd climatrix

# Install dependencies
npm install

# Start the local development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## ⚙️ Environment Configuration (Optional)

Climatrix operates **100% out-of-the-box with zero API keys required**, utilizing public scientific endpoints with automatic local physics fallback.

To enable dedicated enterprise endpoints, unthrottled batch concurrency, or custom basemaps:

```bash
cp .env.example .env
```

Edit `.env` to configure your credentials:

```bash
# 1. Open-Meteo Commercial API Key (Removes public IP hourly rate limits)
VITE_OPEN_METEO_API_KEY=your_key_here

# 2. Mapbox Public Access Token (Optional basemaps)
VITE_MAPBOX_TOKEN=your_token_here

# 3. Microsoft Planetary Computer Key (Optional Deltares burst quota)
VITE_PLANETARY_COMPUTER_KEY=your_key_here

# 4. Climate TRACE API Key (Optional asset-level emissions quota)
VITE_CLIMATE_TRACE_KEY=your_key_here
```

> **Security Note**: Never commit `.env` or sensitive credentials to version control. The repository includes strict `.gitignore` rules preventing accidental credential disclosure.

---

## 🧪 Verification & Audit Suites

Climatrix is backed by rigorous test harnesses ensuring mathematical consistency and geophysical validity:

```bash
# 1. Run unit tests & hazard engine assertions (48 tests)
npm test

# 2. Run global geography audit (72 global benchmark locations across 657 checks)
npx tsx scripts/audit_geography.ts

# 3. Run climate science physical invariance verification (27 strict rules)
npx tsx scripts/audit_climate_science.ts

# 4. Production build validation
npm run build
```

---

## 🔒 Security & Privacy

* **Client-Side Edge Privacy**: Sensitive borrower names, loan amounts, and credit portfolios are evaluated entirely in browser memory (`localStorage` / `IndexedDB`). No private loan records are uploaded to central commercial servers.
* **Zero Credential Leakage**: No hardcoded secrets, private cloud tokens, or project identifiers exist within source code.
* **Sanitized Inputs**: Geocoding and spatial queries are parameterized and strictly escaped against injection.

---

## 📄 License

Distributed under the **MIT License**. Free for research, institutional screening, and open data climate modeling with appropriate attribution to underlying dataset publishers.
