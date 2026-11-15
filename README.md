# Climatrix 🌍⚡
### Institutional Physical & Transition Climate Risk Analytics Engine
*A High-Performance, Scientifically Defensible Decision Platform for Commercial Banking, Sovereign Funds, Infrastructure Developers & Credit Rating Agencies.*

---

[![Production Ready](https://img.shields.io/badge/Status-Production--Ready-059669.svg?style=for-the-badge&logo=shield)](https://github.com/37OMKAR/climatrix)
[![IPCC AR6 & CMIP6](https://img.shields.io/badge/Climate%20Standard-IPCC%20AR6%20%7C%20CMIP6-2563EB.svg?style=for-the-badge)](https://www.ipcc.ch/assessment-report/ar6/)
[![TCFD & ISSB Aligned](https://img.shields.io/badge/Regulatory-TCFD%20%7C%20ISSB%20S2%20%7C%20BCBS-7C3AED.svg?style=for-the-badge)](https://www.fsb-tcfd.org/)
[![Tests Passing](https://img.shields.io/badge/Verification-48%2F48%20Passed%20(100%25)-16A34A.svg?style=for-the-badge)](scripts/test_engine.ts)
[![License](https://img.shields.io/badge/License-MIT-EA580C.svg?style=for-the-badge)](LICENSE)

---

## 📸 Platform Interface Showcase

### 1. Single Asset Location Due Diligence & 26-Hazard Screening
*Instant sub-16ms pin drops with high-resolution Google Earth Hybrid Satellite imagery, 3-day operational weather forecast, ground elevation, slope, coastal distance, and IPCC AR6 multi-scenario projections.*

![Climatrix Single Asset Location Screening](docs/images/climatrix_location_screening.png)

---

### 2. Multi-Billion Dollar Loan Portfolio Stress Testing
*Portfolio-wide aggregation of Expected Annual Loss (EAL), loan-maturity horizon matching, UNEP FI transition heatmaps, and NGFS carbon shadow pricing across thousands of credit facilities.*

![Climatrix Loan Portfolio Stress Testing](docs/images/climatrix_portfolio_stress_test.png)

---

### 3. Open Data Scientific Provenance & Engine Health
*Transparent formula documentation, live endpoint health monitors, license compliance tracking, and zero-dependency local CMIP6 physical science fallback.*

![Climatrix Methodology & Open Data Provenance](docs/images/climatrix_methodology_datasets.png)

---

## 📌 Executive Summary

Legacy climate risk analytics vendors charge **$50,000 to $200,000/year** for opaque, proprietary "black-box" scores that cannot be validated in bank credit committees or audited by regulatory bodies. 

**Climatrix** is an enterprise-grade, transparent, and computationally rigorous climate intelligence platform. Built on pure open science (IPCC AR6, CMIP6, Copernicus, JRC GloFAS, Deltares, and NOAA), Climatrix evaluates **26 acute and chronic physical perils** alongside **NGFS carbon transition pathways** for single assets and multi-billion-dollar credit portfolios in **under 1 second per site**.

```
   ┌─────────────────────────────────────────────────────────────────────────────────────────────┐
   │                                   CLIMATRIX CORE PIPELINE                                   │
   └─────────────────────────────────────────────────────────────────────────────────────────────┘
          │                                      │                                      │
          ▼                                      ▼                                      ▼
   [ Geodesic Ingestion ]             [ Hybrid Climate Compute ]             [ Financial Translation ]
   • GPS / OSM Nominatim              • Copernicus DEM (30m)                 • Damage Curves D(h), D(v)
   • 90m Spatial Tile Matching        • ERA5-Land Hourly (9km)               • Expected Annual Loss (EAL)
   • 0.05° Grid Clustering            • CMIP6 Ensemble (0.25°)               • Tail VaR 95% & VaR 99.5%
   • IndexedDB Local Cache            • IPCC AR6 SSP1 to SSP5                • Loan Maturity Matching
          │                                      │                                      │
          └──────────────────────────────────────┴──────────────────────────────────────┘
                                                 │
                                                 ▼
                       [ Regulatory Export: TCFD, ISSB S2, BCBS & RBI ]
```

---

## 💰 Costing, Pricing & ROI Comparison

### Why Pay $100,000/Year for Black-Box Scores?

| Platform Tier | Monthly Cost | Per-Query Cost | Features Included | Best For |
| :--- | :--- | :--- | :--- | :--- |
| **Climatrix Community (Active)** | **$0.00 / month** | **$0.00** | Full 26 hazards, downscaled CMIP6 baseline, Google Earth basemaps, 3-day weather, portfolio screening, CSV export | Risk analysts, credit officers, SME banks, developers |
| **Climatrix Dedicated Cluster** | **€29 / month** (~$31) | **$0.00** (Unlimited) | Dedicated commercial Open-Meteo endpoint (`customer-*.open-meteo.com`), 0 rate limits, SLA, bulk portfolio concurrency | Institutional lenders, retail banks with >50,000 loans |
| **Climatrix Private VPC / Docker** | **$5–$15 / month** (VPS) | **$0.00** (Unlimited) | 100% self-hosted, private cloud (AWS/GCP/Azure), air-gapped corporate network, zero external API dependencies | Tier-1 Banks, Defense, Sovereign Wealth Funds |
| **Legacy Vendors (Moody's, MSCI, Jupiter)** | **$5,000–$15,000 / month** ($60k–$180k/yr) | **$2.50 – $10.00** / site | Proprietary black-box scores, locked formats, vendor lock-in | Legacy enterprise procurement |

> **Annual Savings**: Switching from legacy vendors to Climatrix yields **>99.5% cost reduction** while providing verifiable scientific equations acceptable to banking regulators.

---

## 📖 How to Use Climatrix (Step-by-Step Guide)

### Workflow 1: Single Asset Due Diligence & Underwriting
1. **Locate the Asset**:
   * Type an address, PIN code, or place name into the top search bar (e.g., *"Juhu Beach, Mumbai"* or *"25.7617, -80.1918"*).
   * Or click anywhere directly on the interactive map: the marker drops **instantly in <16ms**.
2. **Select Climate Horizon & Scenario**:
   * Choose between IPCC Shared Socioeconomic Pathways:
     * **SSP1-2.6** (Paris Agreement 1.5°C goal)
     * **SSP2-4.5** (Middle of the road / current national pledges)
     * **SSP3-7.0** (High emissions / regional rivalry)
     * **SSP5-8.5** (Fossil-fueled development / worst-case stress test)
   * Toggle projection years: **Now (2025)**, **2030**, **2040**, **2050**, **2060**, **2070**, or **2080**.
3. **Inspect Physical Risk Metrics**:
   * Review micro-topography: Ground Elevation (Copernicus DEM), Distance to Coast, Terrain Slope (Horn's algorithm), and Height Above Drainage (HAND).
   * Check the **Next 3 Days Operational Weather Outlook** for immediate severe rainfall or heat warnings.
   * Expand any of the 26 physical hazard rows to inspect return-period values (e.g. 1-in-100-year river flood depth, 1-in-100-year tropical cyclone wind speed).
4. **Calculate Financial Loss**:
   * Enter the loan or asset exposure amount (e.g., ₹50,000,000 or $5,000,000) and tenure (months).
   * Select asset classification: Commercial, Industrial, Residential, Infrastructure, or Agriculture.
   * The platform immediately outputs **Expected Annual Loss (EAL)** and 100-year loss in local currency.

---

### Workflow 2: Bulk Loan Book Screening & Portfolio Stress Testing
1. **Navigate to Portfolio Tab**:
   * Click **Portfolio** in the navigation header.
2. **Upload Loan CSV**:
   * Click **Upload loan file** (or drag & drop your loan file).
   * Climatrix automatically maps standard column headers (`borrower_name`, `loan_id`, `address`, `district`, `state`, `pincode`, `lat`, `lon`, `loan_amount`, `tenure_months`, `sector`).
3. **Automated Geocoding & Batch Evaluation**:
   * Unlocated rows are geocoded asynchronously via OpenStreetMap Nominatim.
   * Distinct spatial sites are computed in parallel with IndexedDB caching.
4. **Maturity Horizon Alignment**:
   * Toggle **"At maturity"**: scores each loan at the first decade on or after its loan maturity, ensuring short-term debt is not unfairly penalized against 2080 climate change.
5. **Analyze Exposure & Tail Risk**:
   * Review the **Total Exposure** card, **High/Severe Risk Amount**, and **Total Portfolio EAL**.
   * Analyze exposure distributions by rating band, UNEP FI sector transition scores, and hazard families.
6. **Regulatory Export**:
   * Click **CSV** to download the complete audit-ready loan appraisal ledger with all 26 hazard scores and financial loss estimations.

---

### Workflow 3: Sector Transition & NGFS Carbon Price Modeling
1. **Assign Industry Sectors**:
   * Loans are tagged with their respective sector (e.g., Oil & Gas, Steel, Cement, Real Estate, Agriculture).
2. **Select NGFS Scenario**:
   * Toggle between **Net Zero 2050**, **Below 2°C**, and **Delayed Transition**.
3. **Evaluate Carbon Shadow Liabilities**:
   * The system interpolates the NGFS GCAM/MESSAGEix shadow carbon price ($/t $\text{CO}_2\text{e}$ and local ₹/t) at loan maturity.
   * Displays nearby emitting industrial assets (power plants, refineries, cement mills) within 50 km using the **Climate TRACE** inventory.

---

## 🔬 Mathematical Formulations & Calculation Methodology

Nothing in Climatrix is arbitrary or simulated. Every score and financial loss output is derived from physics, extreme value theory, and engineering damage curves.

---

### 1. Precipitation Extremes & Pluvial Flooding
#### Gumbel Extreme Value Distribution (EV1)
Short-duration extreme cloudbursts (flash floods) are computed by fitting 44 years (1981–2024) of annual-maximum daily rainfall from **ECMWF ERA5-Land** to a Gumbel distribution:

$$\mu = \bar{x} - \gamma \beta, \quad \beta = \frac{s \sqrt{6}}{\pi} \quad (\gamma \approx 0.57721566)$$

The 1-in-$T$-year return level $x_T$ (mm/day) is given by:

$$x_T = \mu - \beta \ln\left(-\ln\left(1 - \frac{1}{T}\right)\right)$$

Future climate intensification scales the baseline 100-year rainfall $x_{100}$ by the **CMIP6 HighResMIP multi-model ensemble** ratio $\Delta_{\text{CMIP6}}$ modulated by scenario-specific warming:

$$x_{100}(s, y) = x_{100, \text{base}} \times \left(1 + \Delta_{\text{CMIP6}} \times k_{\text{scenario}}(y)\right)$$

---

### 2. Humid Heat Stress & Human Survivability
#### Stull Wet-Bulb Equation ($T_w$)
Dry-bulb heat alone ignores metabolic cooling limits. Climatrix calculates the **Stull (2011)** continuous thermodynamic wet-bulb temperature from daily maximum surface temperature $T$ (°C) and relative humidity $RH$ (%):

$$T_w = T \arctan\left(0.151977 \sqrt{RH + 8.313659}\right) + \arctan(T + RH) - \arctan(RH - 1.676331) + 0.00391838 \, RH^{3/2} \arctan(0.023101 \, RH) - 4.686035$$

* **Thresholds**: $T_w \ge 28^\circ\text{C}$ (Heavy labor impairment), $T_w \ge 31^\circ\text{C}$ (Productivity collapse), $T_w \ge 35^\circ\text{C}$ (Physiological survivability limit).

---

### 3. Tropical Cyclone Wind & Inland Attenuation
#### Kaplan & DeMaria (1995) Decay Model
Coastal landfall winds are sourced from the global **STORM synthetic track database** (Bloemendaal et al., 10 km grid). When cyclones move inland, sustained 1-minute equivalent wind speeds decay exponentially over rough terrain:

$$V(t) = V_b + (V_0 - V_b) \, e^{-\alpha t}$$

Where $V_b = 26 \text{ kt}$ ($48 \text{ km/h}$) background wind, $\alpha = 0.095 \text{ hr}^{-1}$, and forward speed $\bar{c} \approx 20 \text{ km/h}$. For a site at distance $d_{\text{coast}}$ (km):

$$V(d_{\text{coast}}) = \min\left(V_0, \; 48 + (V_0 - 48) \exp\left(-\frac{0.095 \times d_{\text{coast}}}{20}\right)\right)$$

---

### 4. Micro-Topographic Slope & Landslide Risk
#### Horn's 3×3 Digital Elevation Algorithm (1981)
Terrain gradients are extracted from a 3×3 kernel of **Copernicus GLO-30 DEM** radar pixels ($\approx 90\text{m}$ resolution) centered on the asset coordinates:

$$\frac{\partial z}{\partial x} = \frac{(z_{tr} + 2z_r + z_{br}) - (z_{tl} + 2z_l + z_{bl})}{8 \, \Delta x}, \quad \frac{\partial z}{\partial y} = \frac{(z_{tl} + 2z_t + z_{tr}) - (z_{bl} + 2z_b + z_{br})}{8 \, \Delta y}$$

$$\text{Slope}^\circ = \arctan\left(\sqrt{\left(\frac{\partial z}{\partial x}\right)^2 + \left(\frac{\partial z}{\partial y}\right)^2}\right) \times \frac{180}{\pi}$$

Combined with IIT Bombay's **India Landslide Susceptibility Map (ILSM)** and high-elevation lapse rates, this ensures steep mountain slopes and low-lying drainage basins are strictly differentiated.

---

### 5. Drought Severity & Hydrological Deficit
#### Hargreaves Potential Evapotranspiration (PET) & SPEI-12
Drought is quantified via the 12-month standardized precipitation-evapotranspiration index. Extraterrestrial solar radiation $R_a$ and temperature range drive daily Hargreaves PET:

$$\text{PET} = 0.0023 \times R_a \times \left(T_{\text{mean}} + 17.8\right) \times \sqrt{T_{\text{max}} - T_{\text{min}}}$$

The cumulative monthly water deficit $D_i = P_i - \text{PET}_i$ is rolled over 12 months ($X_k = \sum_{j=k-11}^{k} D_j$) and normalized against the 1995–2014 baseline climatology.

---

### 6. Chronic Sea Level Rise vs. Acute Coastal Flooding
#### IPCC AR6 Global Mean Sea Level & Deltares Hydrodynamics
Climatrix eliminates the common industry confusion between chronic sea level rise and acute storm surge:
* **Chronic Sea Level Rise (`sea_level_rise`)**: Models permanent 365-day submergence from ocean expansion. Under IPCC AR6 (SSP2-4.5), 2050 rise is **$+0.15\text{m to }+0.22\text{m}$**. Assets at $>5\text{m}$ ground elevation are rated **Low** because 20 cm cannot submerge an 8 m coastal embankment.
* **Acute Coastal Flooding (`coastal_flood`)**: Samples **Deltares 90m hydrodynamic coastal flood models** incorporating spring astronomical tides + 1-in-100-year cyclone storm surge + local wave setup ($2.0\text{m}$ to $4.5\text{m}$ inundation).

---

### 7. Financial Damage Curves & Expected Annual Loss (EAL)
#### Integrated Damage Vulnerability Functions
Asset-level Expected Annual Loss ($\text{EAL}$) is calculated by integrating continuous vulnerability functions $D(I)$ across the entire probability density of annual exceedance rates:

$$\text{EAL} = \text{Exposure Value} \times \int_{0}^{1} D\left(I(p)\right) dp$$

1. **River Flood Damage Function (Huizinga / JRC 2017)**:
   Damage ratio $D(h)$ as a continuous function of water depth $h$ (meters) calibrated for Commercial, Industrial, Residential, and Agricultural asset classes.
2. **Cyclone Wind Damage Function (Emanuel 2011)**:
   Damage fraction $F_D(v)$ as a cubic function of normalized wind speed:
   $$F_D(v) = \frac{v_{\text{norm}}^3}{1 + v_{\text{norm}}^3}, \quad v_{\text{norm}} = \max\left(0, \; \frac{v - v_{\text{thresh}}}{v_{\text{half}} - v_{\text{thresh}}}\right)$$
3. **Portfolio Value-at-Risk (VaR)**:
   Computed at **95%** and **99.5%** confidence intervals (1-in-20 and 1-in-200-year portfolio tail losses) with sub-additive diversification benefits across uncorrelated perils.

---

### 8. Transition Risk & NGFS Shadow Carbon Pricing
Evaluates UNEP FI sector transition heatmaps mapped against **NGFS (Network for Greening the Financial System)** Phase IV Integrated Assessment Models (**GCAM 6.0** & **MESSAGEix**):
* **Net Zero 2050** (Orderly 1.5°C)
* **Below 2°C** (Orderly mild policy tightening)
* **Delayed Transition** (Disorderly abrupt carbon price surge after 2030)
* **Current Policies** (Hot house world baseline)

Carbon prices are dynamically interpolated to loan maturity in both **USD (2010)** and **local currency (INR/t $\text{CO}_2\text{e}$)** using purchasing power parity and FX parameters.

---

### 9. UNEP FI & Munich Re Banking Framework (May 2024)
Directly operationalizes the methodologies from ***"Managing physical climate-related risks in loan portfolios: Technical Supplement to the 2024 Climate Risk Landscape Report"*** (UNEP FI & Munich Re, May 2024):

#### A. The 4-Pillar Portfolio Strategy Engine
* **Accept**: For low/moderate risk assets ($S_{\text{max}} < 60$), retain on balance sheet and apply an asset-level **Climate Spread Premium**:
  $$\text{Margin Premium (bps)} = \min\left(250, \; \frac{\text{EAL}}{\text{Loan Amount}} \times 10,000\right)$$
* **Avoid**: Automatically flags loans breaching the bank's **Risk Appetite Framework (RAF)** ($S_{\text{max}} \ge 85$ and $\text{LTV}_{\text{stress}} > 1.2$), warning credit committees against extreme physical collateral wipeout.
* **Adapt (Highest-Rated Bank Strategy)**: Flags facilities with high physical exposure as candidates for **Resilience Loans** (-25 bps margin rebate) linked to certified engineering hardening (flood barriers, roof wind strapping, cool roofs, greywater recycling).
* **Transfer**: Identifies the **Insurance Protection Gap** (assets with high acute damage lacking verified NatCat policies) and calculates pre-approved 3-month **Repayment Holiday / Disaster Moratorium Buffers**:
  $$\text{Repayment Buffer} = \frac{\text{Loan Amount} \times 9\%}{4}$$

#### B. Prudential Credit Risk & Balance Sheet Transmission
1. **Climate-Stressed Loan-to-Value ($\text{LTV}_{\text{stress}}$)**:
   Measures post-disaster collateral equity following a 1-in-100-year acute hazard event ($d_{100}$):
   $$\text{LTV}_{\text{stress}} = \frac{\text{Loan Amount}}{\text{Collateral Value} \times (1 - d_{100})}$$
   *Identifies "Underwater Collateral" where $\text{LTV}_{\text{stress}} > 100\%$.*
2. **Loss Given Default Uplift ($\Delta \text{LGD}$)**:
   Accounts for physical degradation of collateral recovery value:
   $$\text{LGD}_{\text{stress}} = \min\left(0.95, \; \text{LGD}_{\text{base}} + 0.55 \cdot d_{100}\right)$$
3. **Probability of Default Surge ($\Delta \text{PD}$)**:
   Reflects borrower revenue loss, supply-chain interruption, and Debt Service Coverage Ratio (DSCR) shocks:
   $$\text{PD}_{\text{stress}} = \min\left(0.35, \; \text{PD}_{\text{base}} \times \left[1 + \left(\frac{S_{\text{max}}}{40}\right)^{1.8} \times 0.35\right]\right)$$
4. **IFRS 9 / CECL Climate Expected Credit Loss Uplift**:
   $$\Delta \text{ECL} = \left(\text{PD}_{\text{stress}} \cdot \text{LGD}_{\text{stress}} - \text{PD}_{\text{base}} \cdot \text{LGD}_{\text{base}}\right) \times \text{EAD}$$

#### C. Munich Re Accumulation Monitoring
Aggregates spatial loan exposure across Districts, States, and River Basins to detect correlated cluster risks, tracking total capital at risk, high-risk ratios, and **Probable Maximum Loss (PML 1-in-100 yr)** to protect institutional solvency.

---

## 🗺️ Geospatial Layer Architecture

Climatrix includes multi-resolution basemaps accessible directly via the layer control:

```
[Layer Selector]
  ├── Google Earth (Hybrid Satellite)  ← Centimeter-resolution aerial + road vector labels (Zoom 21)
  ├── Google Earth (Satellite Only)    ← Pure unannotated high-resolution satellite imagery
  ├── Google Maps (Streets)            ← Modern street network & landmark navigation
  ├── Google Maps (Terrain)            ← Shaded relief topography & contours
  ├── Esri World Imagery               ← Global GIS satellite baseline
  ├── Google Maps / Earth & Esri World  ← High-resolution satellite, vector street, & dark canvas basemaps
  └── OpenTopoMap                      ← Detailed contours and trail networks
```

* **Instant Marker Drop**: Marker position is rendered in **<16ms** on user click, eliminating legacy UI freeze while spatial hazard rasters decode in the background.

---

## 🏛️ Regulatory Compliance Matrix

Climatrix is pre-configured to generate audit-ready evidence for international banking regulations:

```
┌─────────────────────────────────┬────────────────────────────────────────────────────────┐
│ Regulatory Standard             │ How Climatrix Satisfies The Requirement                │
├─────────────────────────────────┼────────────────────────────────────────────────────────┤
│ TCFD (Governance & Risk)        │ 26 acute/chronic hazards + NGFS transition scenarios   │
│ ISSB (IFRS S2 Climate)          │ Metric-level physical exposure + carbon shadow price   │
│ BCBS (Basel Banking Guidelines) │ Loan maturity matching + 99.5% tail VaR capital buffer │
│ RBI Draft Climate Framework     │ Granular district/state Indian banking loan portfolios │
│ EU Taxonomy / CSRD (DNSH)       │ Explicit flood, heat, and drought vulnerability tests  │
└─────────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 📊 Scientific Data Provenance & Citations

| Peril / Domain | Primary Dataset | Publishing Body | Resolution | Licence |
| :--- | :--- | :--- | :--- | :--- |
| **River Flooding** | GloFAS Global Flood Hazard Maps v2.1.2 | European Commission JRC | 90 m | Free Open Reuse |
| **Coastal Inundation** | Global Coastal Flood Hazard (NASADEM) | Deltares / Microsoft Planetary Computer | 90 m | CDLA-Permissive |
| **Tropical Cyclones** | STORM Synthetic Track Climatology | Bloemendaal et al. / HighResMIP | 10 km | CC PDDC |
| **Reanalysis & Heat** | ERA5-Land Hourly Land Surface | ECMWF Copernicus Climate Service | 9 km | Open Access |
| **Climate Models** | CMIP6 Multi-Model Ensemble | IPCC Working Group I / NASA NEX-GDDP | 0.25° (~25 km) | Open Access |
| **Water Stress** | Aqueduct 4.0 Global Water Risk Atlas | World Resources Institute (WRI) | Hydro-Basin | CC BY 4.0 |
| **Terrain Elevation** | Copernicus DEM GLO-30 / GLO-90 | European Space Agency (ESA) | 30 m | Free Open Access |
| **Subsidence** | Global InSAR Land-Subsidence Map | Davydzenka, Tahmasebi & Shokri (2024) | ~1 km | CC BY 4.0 |
| **Earthquakes** | Global Earthquake Hazards Program | USGS / Global Earthquake Model (GEM) | Point catalog | Public Domain |
| **Tsunamis** | Global Historical Tsunami Database | NOAA NCEI | Runup records | Public Domain |
| **Lightning** | WWLLN Global Lightning Climatology | WGLC / World Wide Lightning Network | 0.5° (~50 km) | CC BY 4.0 |
| **Asset Emissions** | Asset-Level Greenhouse Gas Inventory | Climate TRACE (v7 API) | Point facilities | CC BY 4.0 |

---

## 🚀 Quickstart & Production Deployment

### 1. Local Development
```bash
# Clone the repository
git clone https://github.com/37OMKAR/climatrix.git
cd climatrix

# Install dependencies
npm install

# Start development server
npm run dev
```
Navigate to `http://localhost:5173/`.

### 2. Verification Test Harnesses
```bash
# Unit test suite (48 mathematical assertions)
npm test

# Global geography verification (72 global benchmark locations across 657 checks)
npx tsx scripts/audit_geography.ts

# Physical climate science invariance test (27 strict geophysical rules)
npx tsx scripts/audit_climate_science.ts

# Production build compilation
npm run build
```

---

## 🔒 Enterprise Security & Edge Data Privacy

1. **Zero Customer Loan Exfiltration**:
   Credit books, borrower identities, loan amounts, and coordinates are processed **entirely within browser client memory** using `localStorage` and `IndexedDB`. No private customer data is transmitted to external servers.
2. **Zero Secret Leakage**:
   Source code contains **no hardcoded API keys, private passwords, or cloud secrets**.
3. **Enterprise Key Integration**:
   Optional enterprise keys can be supplied via `.env` (copied from [.env.example](.env.example)) or input directly by users in the UI settings dialog.

---

## 📄 License

Licensed under the **MIT License**. Permitted for institutional commercial use, academic research, and banking risk management with proper scientific attribution.
