# climatrix

> **AI-Enhanced Physical Climate Risk Analytics Platform**  
> Comprehensive global physical climate risk assessment modeled on IPCC CMIP6 Shared Socioeconomic Pathways (SSP1-1.9 through SSP5-8.5), covering 12 acute and chronic hazards, sub-hectare spatial downscaling (up to 90m), non-linear vulnerability damage functions, spatial Gaussian copula tail risk modeling, and universal statutory compliance (TCFD, CSRD ESRS E1, SEC Reg S-K, ISSB IFRS S2, EU Taxonomy, NGFS Phase IV).

---

## Key Platform Capabilities

### 1. 12 Global Climate Change Hazards
* **Acute Hazards:** Coastal Flood (with IPCC AR6 Sea Level Rise curves), Fluvial (Riverine) Flood, Pluvial (Surface/Flash) Flood, Tropical Cyclone (aerodynamic MPI-capped), Wildfire.
* **Chronic Hazards:** Drought (Signed SPEI preservation), Water Stress, Extreme Heat, Heat Stress (Wet-Bulb Globe Temperature), Extreme Cold & Cryosphere, Subsidence & Soil Compaction, Landslide & Slope Instability.

### 2. Science-Based Multi-Model Climate Projections
* **Scenarios:** SSP1-1.9 (1.5°C Paris Goal), SSP1-2.6 (Sub-2°C), SSP2-4.5 (Middle-of-the-Road), SSP3-7.0 (Regional Rivalry), SSP5-8.5 (Fossil-Fueled Development).
* **Decadal Horizons:** 2025 through 2090 in 10-year resolution.
* **Return Periods:** Unconditional Average Annual Loss (AAL) frequency-severity integral, 10-year, 50-year, 100-year, 250-year, and 500-year Probable Maximum Loss (PML).

### 3. Multi-Tier Spatial Downscaling & Hypsometry
* **25 km (0.25°):** CMIP6 HighResMIP Global Grid (±14.5% CI)
* **10 km (0.10°):** CORDEX Dynamical Regional Downscaling (±9.8% CI)
* **1 km (0.01°):** NASA NEX-GDDP High-Resolution Statistical Grid (±5.2% CI)
* **90 m (3-arc-sec):** Copernicus GLO-30 & USGS SRTM Hydro-DEM Topographic Grid (±2.1% CI)
* **Zero Fake Data Guardrail:** Strict topographic hypsometry and geodesic distance cutoffs (e.g. coastal surge strictly $0\text{m}$ if $>60\text{km}$ inland or elevation $>30\text{m}$).

### 4. Financial Impact & Tail Risk Modeling
* **Engineering Damage Fragility Curves:** Non-linear sigmoid vulnerability functions calibrated for $>250$ facility asset classifications (Semiconductor Fabs, Hyperscale Data Centers, Commercial Real Estate, Clean Energy Microgrids, Marine Container Terminals).
* **Spatial Gaussian Copula Tail Dependence:**
  $$\rho_{ij} = \min\left(1.0, \, \exp\left(-\frac{d_{ij}}{750\text{ km}}\right) + (\text{sameHazard} \, ? \, 0.20 : 0.0)\right)$$
  Calculates portfolio geographic clustering index $C_{\text{copula}} \in [0, 1]$ and calibrates $\text{VaR}_{95}$ and $\text{VaR}_{99.5}$ capital requirements (Solvency II 1-in-200yr benchmark).

### 5. Universal Regulatory Disclosure Modules
* **TCFD:** 4 pillars (Governance, Strategy, Risk Management, Metrics & Targets) with multi-decade adaptation ROI.
* **CSRD / ESRS E1:** Double materiality, Gross & Net Carrying Value at acute vs chronic risk, and CapEx adaptation plans.
* **SEC Reg S-K (Items 1502/1504):** Automated 1% severe weather footnote materiality test with county-level disclosure.
* **ISSB / IFRS S2:** Short-, medium-, and long-term physical capital resilience.
* **EU Taxonomy:** Appendix A DNSH screening across all 4 environmental dimensions.
* **NGFS Phase IV:** Central bank supervisory stress testing with sovereign bond spread escalation (bps).

### 6. Sovereigns, Municipalities & Corporate Linking
* Coverage across **200+ Sovereign Nations**, **2,100 Subnational Jurisdictions**, and all **3,100 U.S. Counties** (with FEMA NRI integration).
* Proprietary corporate intelligence linking physical asset facilities to parent corporations and ultimate parent entities (UPEs) spanning 99% of global market capitalization.
* Live global coordinate verification sandbox to test any latitude and longitude on Earth.

---

## Tech Stack
* **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons
* **Mapping:** Leaflet & React-Leaflet with custom downscaled reticle bounding boxes
* **Analytics Engine:** Pure TypeScript deterministic climate physics engine & geospatial hypsometry

---

## Getting Started

### Prerequisites
* Node.js 18+
* npm or pnpm

### Installation
```bash
# Clone the repository
git clone https://github.com/37OMKAR/climatrix.git
cd climatrix

# Install dependencies
npm install

# Start local development server
npm run dev
```

Visit `http://localhost:5173/` to launch the terminal.

### Production Build
```bash
npm run build
```

### Climate Science Audit Verification Test Suite
```bash
npx tsx scripts/audit_climate_science.ts
```

---

## License
MIT License
