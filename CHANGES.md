# CLIMARIS — change log

## v2.0 — open-data engine (replaces the heuristic engine)

The previous engine produced hazard values from rough rules (regional boxes, estimated elevation,
estimated distance to coast). It has been removed entirely. Every value is now computed for the exact
point from open, citable data using published methods. Where no open source exists, the hazard says
"Not assessed"; there are no default or fallback numbers anywhere.

### Data (fetched live in the browser, cached per ~100 m for 90 days)
| Source | Used for |
|---|---|
| Copernicus DEM GLO-90 (Open-Meteo) | elevation, slope (Horn 3×3), height above local low ground |
| ECMWF ERA5 1981–2024 (Open-Meteo) | heat, heatwave, frost, rain, gusts, snow, drought, aridity baselines |
| CMIP6 HighResMIP EC-Earth3P-HR + MRI-AGCM3-2-S (Open-Meteo) | future change (2036–49 vs 1995–2014), wet-bulb, fire weather |
| Copernicus GloFAS v4 1984–2024 (Open-Meteo) | river flood (100-yr discharge) |
| Météo-France SMOC sea level incl. tides (Open-Meteo) | coastal flood water level |
| Copernicus CAMS (Open-Meteo) | dust days |
| USGS ComCat M4.5+ since 1973 | earthquake PSHA |
| NOAA IBTrACS (ArcGIS mirror) | tropical cyclone return winds and loss |
| NOAA NCEI tsunami run-ups | tsunami |
| Natural Earth 1:10m coastline (bundled) | distance to coast |
| Smithsonian GVP Holocene volcanoes (bundled) | volcano |
| IPCC AR6 warming + Table 9.9 sea level | scenario scaling, sea-level rise |
| OpenStreetMap Nominatim | address search and loan geocoding |

### Methods
Gumbel L-moment return levels; delta-change bias correction; Stull (2011) wet-bulb; ETCCDI WSDI;
SPEI-type 12-month water balance with Hargreaves PET; UNEP aridity index; Canadian FWI (Van Wagner 1987);
historic-parametric PSHA with Campbell (1997) ground motion; peaks-over-threshold cyclone winds with
Kaplan–DeMaria inland decay; IPCC pattern scaling to SSP1-2.6/2-4.5/3-7.0/5-8.5 and 2025–2090.
Scores use published class limits (IMD, GSHAP, UNEP, EFFIS, ISO wet-bulb limits).
Rupee losses only where a published damage curve exists: Emanuel (2011) wind, JRC 2017 Asia flood curves.

### Hazards
21 assessed: river flood, coastal flood, heavy rain, sea level rise, extreme heat, heatwaves, humid heat
stress, cold, permafrost, heavy snowfall, tropical cyclone, windstorm, dust, drought, water scarcity,
wildfire weather, earthquake, tsunami, volcano, landslide, avalanche.
8 listed, not assessed (no open global point data): hail, tornado, lightning, subsidence, groundwater
decline, saline intrusion, coastal erosion, glacial lake outburst.

### Product
- Name: CLIMARIS. All money in ₹ (lakh / crore). Themes: Light, Dark, Ocean.
- Location: type an address / PIN / place → fly to it → all hazards for that point, with method and
  source per row; scenario and year; loan amount + tenure → ₹ loss; add to portfolio.
- Upload: CSV with name, ID, address, district, state, PIN, country, lat/lon, amount, tenure, sanction
  date, sector. Columns auto-matched. Unreadable rows are flagged, never filled.
- Portfolio: map + loans table + exposure cards. Each loan can be scored at its own maturity year.
  CSV export of every hazard score per loan.
- Methodology page with every source, method, class limit and limitation; optional Open-Meteo API key.
- Removed: all sample/demo portfolios, sovereign and company reference tables, the old heuristic engine.

### Tests
`npm test` → scripts/test_engine.ts: published reference values (Stull, Campbell, Emanuel, JRC, Horn,
Hargreaves, FWI, Gumbel), scenario tables, ₹/CSV parsing, the full pipeline with mocked API responses,
and an outage test proving a failed source shows "Data error" instead of a number.

## v3.0 — high-resolution open datasets + transition risk

Physical hazards now read pixel-by-pixel from the publishers' own maps, live in the browser (HTTP Range):
- River flood: JRC / Copernicus CEMS-GloFAS hazard maps v2.1.2, 90 m, RP10–500 (COGs on source.coop). Expected annual loss with JRC depth-damage curves.
- Coastal flood: Deltares Global Flood Maps, 90 m NASADEM, 2018 + 2050 sea level (Zarr chunks via Kerchunk index, Planetary Computer).
- Tropical cyclone: STORM 10 km wind return periods, present + 4 HighResMIP GCMs (deflated GeoTIFFs streamed out of the Zenodo zip). IBTrACS kept as labelled fallback.
- New assessed hazards: land subsidence (Davydzenka et al. 2024, ~1 km), lightning (WWLLN WGLC, read with h5wasm), groundwater decline (WRI Aqueduct 4.0 + water-table depth), water stress (Aqueduct 4.0 basin baseline + province 2030/50/80 futures).
- Landslide: India Landslide Susceptibility Map (IIT Bombay, 100 m) inside India.
- Large reference data (indexes, decoded tiles, lightning grid) cached in IndexedDB after first use.

Transition risk:
- UNEP FI "Beyond the Horizon" sector heatmap (62 segments) matched from the loan's sector text.
- NGFS Phase V carbon price (GCAM, REMIND, MESSAGE) for the site's country at loan maturity, 7 scenarios, in US$2010 and ₹/t.
- Climate TRACE emitting assets within 50 km.

Not used: GEM global seismic hazard (non-commercial licence), NASA LHASA and Aqueduct rasters (not readable cross-origin).
Tests: 48 checks; scripts/make_fixtures.py builds synthetic files in every live format (COG deflate+predictor 3, strip TIFF, BigTIFF float64, LZW+predictor 2 inside deflate, Zarr shuffle+zlib, HDF5).
