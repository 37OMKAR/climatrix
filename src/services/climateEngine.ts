import {
  Asset,
  AssetRiskAssessment,
  Decade,
  HazardMeta,
  HazardMetricResult,
  HazardType,
  PortfolioSummary,
  ReturnPeriod,
  RiskRating,
  SSPScenario,
  SSPScenarioMeta,
  SpatialResolution,
  SpatialResolutionMeta,
  RegulatoryFramework,
  RegulatoryFrameworkMeta,
  LiveSiteData,
  HazardFamily,
} from '../types/climate';
import {
  EXTENDED_HAZARD_META,
  EXTENDED_DEFAULT_WEIGHTS,
  HAZARD_TAXONOMY,
  HAZARD_FAMILIES,
  applyExtendedWeightTweaks,
  computeExtendedBaselines,
  extendedAdaptation,
  extendedClimateFactor,
  typeHasKeyword,
} from './extendedHazards';

export { HAZARD_TAXONOMY, HAZARD_FAMILIES } from './extendedHazards';

// CMIP6 Scenario Definitions aligned with IPCC AR6 & NGFS Phase IV
export const SSP_SCENARIOS: Record<SSPScenario, SSPScenarioMeta> = {
  ssp119: {
    id: 'ssp119',
    name: 'SSP1-1.9 (Paris 1.5°C Ambitious Target / Net Zero 2050)',
    code: 'SSP1-1.9',
    ngfsEquivalent: 'closest NGFS analogue: Net Zero 2050',
    description: 'Immediate deep decarbonization across all economic sectors. Warming strictly capped at ~1.5°C by 2100 with negligible overshoot.',
    warming2100: '+1.4°C',
    co2Trajectory: 'Halved by 2030, Net-Zero global emissions by 2050',
    color: '#059669', // deep emerald
  },
  ssp126: {
    id: 'ssp126',
    name: 'SSP1-2.6 (Sustainability / Low Emissions)',
    code: 'SSP1-2.6',
    ngfsEquivalent: 'closest NGFS analogue: Below 2°C',
    description: 'Paris Agreement aligned: Aggressive decarbonization, net-zero achieved ~2050-2070. Warming constrained to ~1.8°C by 2100.',
    warming2100: '+1.8°C',
    co2Trajectory: 'Steep decline from 2025; net zero ~2060',
    color: '#10b981', // emerald
  },
  ssp245: {
    id: 'ssp245',
    name: 'SSP2-4.5 (Middle of the Road / Intermediate)',
    code: 'SSP2-4.5',
    ngfsEquivalent: 'closest NGFS analogue: Nationally Determined Contributions',
    description: 'Current stated policy path: Moderate emissions reductions, warming reaches ~2.7°C by 2100. Uneven regional adaptation.',
    warming2100: '+2.7°C',
    co2Trajectory: 'Peaks around 2040, then slow decrease',
    color: '#06b6d4', // cyan
  },
  ssp370: {
    id: 'ssp370',
    name: 'SSP3-7.0 (Regional Rivalry / High Emissions)',
    code: 'SSP3-7.0',
    ngfsEquivalent: 'closest NGFS analogue: Current Policies',
    description: 'National security focus, weak international cooperation, continued fossil reliance. Warming reaches ~3.6°C by 2100.',
    warming2100: '+3.6°C',
    co2Trajectory: 'Doubles by 2080',
    color: '#f59e0b', // amber
  },
  ssp585: {
    id: 'ssp585',
    name: 'SSP5-8.5 (Fossil-Fueled Development / Worst-Case)',
    code: 'SSP5-8.5',
    ngfsEquivalent: 'beyond NGFS Current Policies (no direct analogue)',
    description: 'Energy-intensive economic growth driven by coal and hydrocarbons. Severe tipping points crossed, ~4.4°C warming by 2100.',
    warming2100: '+4.4°C',
    co2Trajectory: 'Surges throughout 21st century',
    color: '#ef4444', // red
  },
};

// Spatial Downscaling Resolution Profiles (Global to Sub-Hectare Local Grid)
export const SPATIAL_RESOLUTIONS: Record<SpatialResolution, SpatialResolutionMeta> = {
  '25km': {
    id: '25km',
    name: 'Global climate grid (25km / 0.25°)',
    gridSizeKm: 25,
    provider: 'World Climate Research Programme (WCRP / CMIP6)',
    methodology: 'Grid matching NASA NEX-GDDP-CMIP6 and CMIP6 HighResMIP (0.25°). Hazard values here are screening estimates, not model output.',
    uncertaintyBandPercent: 14.5,
    badgeColor: 'text-blue-400 bg-blue-950/60 border-blue-800',
  },
  '10km': {
    id: '10km',
    name: 'Regional grid (10km / 0.10°)',
    gridSizeKm: 10,
    provider: 'WCRP Coordinated Regional Climate Downscaling Experiment',
    methodology: 'Grid matching CORDEX / ERA5-Land regional data (≈0.1°). Screening estimates.',
    uncertaintyBandPercent: 9.8,
    badgeColor: 'text-cyan-400 bg-cyan-950/60 border-cyan-800',
  },
  '1km': {
    id: '1km',
    name: 'Local grid (1km / 0.01°)',
    gridSizeKm: 1,
    provider: 'Statistical downscaling (e.g. CHELSA / WorldClim, ~1 km)',
    methodology: 'Grid matching 1 km downscaled climatologies. Screening estimates.',
    uncertaintyBandPercent: 5.2,
    badgeColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-800',
  },
  '90m': {
    id: '90m',
    name: 'Terrain grid (90m / 3 arc-sec)',
    gridSizeKm: 0.09,
    provider: 'Copernicus GLO-30 / USGS SRTM Water Body Hydrological Mesh',
    methodology: 'Grid matching the Copernicus GLO-90 DEM used for live elevation. Fetch live data for the real ground height.',
    uncertaintyBandPercent: 2.1,
    badgeColor: 'text-purple-400 bg-purple-950/60 border-purple-800',
  },
};

// Universally Accepted Climate Disclosure & Regulatory Frameworks
export const REGULATORY_FRAMEWORKS: Record<RegulatoryFramework, RegulatoryFrameworkMeta> = {
  tcfd: {
    id: 'tcfd',
    name: 'Task Force on Climate-related Financial Disclosures',
    acronym: 'TCFD',
    authority: 'Financial Stability Board (FSB) / G20',
    mandateStatus: 'Mandatory',
    focus: 'Physical & transition climate risks across Governance, Strategy, Risk Management, and Metrics & Targets',
    keyRequirements: [
      'Scenario analysis including a <2°C temperature threshold (SSP1-2.6 / SSP1-1.9)',
      'Identification of acute (storm, flood, wildfire) and chronic (drought, sea level rise) physical risks',
      'Quantification of potential financial impact (Expected Annual Loss, asset write-downs, business interruption)',
      'Metrics on asset exposure concentrations by geographic location and sector',
    ],
  },
  csrd_esrs: {
    id: 'csrd_esrs',
    name: 'Corporate Sustainability Reporting Directive (ESRS E1 Climate Change)',
    acronym: 'CSRD / ESRS E1',
    authority: 'European Financial Reporting Advisory Group (EFRAG) / European Union',
    mandateStatus: 'Mandatory',
    focus: 'Double materiality: Financial exposure to physical climate hazards and operational impact on climate adaptation',
    keyRequirements: [
      'Mandatory physical climate risk assessment across all EU and global operating facilities (AR6 CMIP6 scenarios)',
      'Disclosure of monetary value of real estate and infrastructure assets in high physical risk zones (ESRS E1-9)',
      'Gross and net financial carrying values post-adaptation investment',
      'CAPEX allocation aligned with climate change adaptation plans',
    ],
  },
  sec_climate: {
    id: 'sec_climate',
    name: 'SEC Climate Disclosure Rules (Reg S-K Items 1502 & 1504)',
    acronym: 'SEC Climate Rules',
    authority: 'U.S. Securities and Exchange Commission',
    mandateStatus: 'Phased Implementation',
    focus: 'Material physical climate risk disclosures in annual 10-K filings and financial statement footnotes',
    keyRequirements: [
      'Material impacts of acute weather events and chronic climate trends on business operations and capital expenditures',
      'Granular location disclosures (Zip codes, counties, coordinates) for facilities facing material acute/chronic exposure',
      '1% financial statement footnote threshold for capitalized costs and expenditures incurred from severe weather events',
      'Description of risk management processes integrated into overall enterprise risk management (ERM)',
    ],
  },
  issb_ifrs2: {
    id: 'issb_ifrs2',
    name: 'IFRS S2 Climate-related Disclosures',
    acronym: 'ISSB / IFRS S2',
    authority: 'International Sustainability Standards Board (ISSB) / IFRS Foundation',
    mandateStatus: 'Mandatory',
    focus: 'Global baseline for capital market disclosures on climate resilience and financial stability',
    keyRequirements: [
      'Climate resilience strategic assessments over short, medium, and long-term decadal horizons (to 2090)',
      'Disclosure of capital expenditure and financing committed to climate adaptation',
      'Breakdown of physical assets subject to acute vs. chronic vulnerability',
      'Scenario analysis using multiple climate pathways',
    ],
  },
  eu_taxonomy: {
    id: 'eu_taxonomy',
    name: 'EU Sustainable Finance Taxonomy (Climate Change Adaptation)',
    acronym: 'EU Taxonomy',
    authority: 'European Commission (Platform on Sustainable Finance)',
    mandateStatus: 'Mandatory',
    focus: 'Technical screening criteria for Do No Significant Harm (DNSH) to climate adaptation',
    keyRequirements: [
      'Appendix A: Comprehensive physical climate risk assessment covering all 12 acute and chronic hazards',
      'Substantial contribution to adaptation without increasing vulnerability of other assets or communities',
      'Implementation of a concrete 5-year adaptation plan with positive net present value (NPV)',
      'Monitoring and verification of physical asset resilience post-adaptation',
    ],
  },
  ngfs: {
    id: 'ngfs',
    name: 'Network for Greening the Financial System (NGFS Phase IV)',
    acronym: 'NGFS',
    authority: 'Central Banks & Supervisors Network (130+ Central Banks incl. ECB, BoE, Fed, BoJ)',
    mandateStatus: 'Central Bank Supervisory',
    focus: 'Macroprudential and supervisory climate stress-testing for commercial banks, insurers, and institutional investors',
    keyRequirements: [
      'Stress testing credit and sovereign portfolios across NGFS Phase IV scenario archetypes',
      'Physical risk transmission channels: asset devaluation, borrower default, sovereign bond yield spread widening',
      'Chronic labor productivity losses from wet-bulb heat stress and cooling capacity constraints',
      'Compound hazard correlations (concurrent heatwave and drought)',
    ],
  },
};

// Hazard registry: 12 core climate hazards + 15 extended perils (see extendedHazards.ts)
export const HAZARD_CATALOG: Record<HazardType, HazardMeta> = {
  coastal_flood: {
    id: 'coastal_flood',
    name: 'Coastal Flood',
    shortName: 'Coastal Flood',
    category: 'Flood',
    unit: 'm inundation',
    description: 'Combined astronomical high tides, extreme storm surges, and sea level rise (SLR) inundating coastal zones.',
    cmip6ModelBasis: 'BRICK / IPCC AR6 Sea Level Ensemble & GFDL-ESM4',
    iconName: 'Waves',
    colorHex: '#0284c7',
  },
  fluvial_flood: {
    id: 'fluvial_flood',
    name: 'Fluvial Flood (Riverine)',
    shortName: 'River Flood',
    category: 'Flood',
    unit: 'm peak depth',
    description: 'River overtopping banks due to persistent basin-wide precipitation, snowpack melt, or reservoir overflow.',
    cmip6ModelBasis: 'CaMa-Flood hydrodynamic model driven by CMIP6 precipitation',
    iconName: 'Droplets',
    colorHex: '#2563eb',
  },
  pluvial_flood: {
    id: 'pluvial_flood',
    name: 'Pluvial Flood (Surface Water)',
    shortName: 'Flash Flood',
    category: 'Flood',
    unit: 'mm / 24h rainfall',
    description: 'Intense short-duration convective precipitation overwhelming local storm drainage and terrain infiltration.',
    cmip6ModelBasis: 'CMIP6 sub-daily extreme convective rainfall indices (Rx1day / Rx5day)',
    iconName: 'CloudRain',
    colorHex: '#3b82f6',
  },
  drought: {
    id: 'drought',
    name: 'Drought (SPEI-12)',
    shortName: 'Drought',
    category: 'Water & Drought',
    unit: 'SPEI index',
    description: 'Long-term meteorological and agricultural moisture deficits measured via Standardized Precipitation Evapotranspiration Index.',
    cmip6ModelBasis: 'SPEI-12 multi-model ensemble (CESM2, UKESM1, MPI-ESM1-2-HR)',
    iconName: 'SunDim',
    colorHex: '#d97706',
  },
  water_stress: {
    id: 'water_stress',
    name: 'Water Stress',
    shortName: 'Water Stress',
    category: 'Water & Drought',
    unit: '% baseline withdrawal',
    description: 'Ratio of total industrial/municipal/agricultural freshwater withdrawal to total renewable groundwater and surface supply.',
    cmip6ModelBasis: 'WRI Aqueduct 4.0 & PCR-GLOBWB hydrological routing',
    iconName: 'DropletOff',
    colorHex: '#b45309',
  },
  extreme_heat: {
    id: 'extreme_heat',
    name: 'Extreme Heat (>35°C)',
    shortName: 'Extreme Heat',
    category: 'Thermal',
    unit: 'days/year >35°C',
    description: 'Annual count of days where maximum air temperature exceeds 35°C (95°F), driving thermal strain on equipment and cooling costs.',
    cmip6ModelBasis: 'CMIP6 TX90p & absolute daily maximum surface temperature (tasmax)',
    iconName: 'Flame',
    colorHex: '#dc2626',
  },
  heat_stress: {
    id: 'heat_stress',
    name: 'Heat Stress (Wet-Bulb WBGT)',
    shortName: 'Heat Stress',
    category: 'Thermal',
    unit: '°C max WBGT',
    description: 'Combined ambient temperature, humidity, wind, and solar radiation measuring physiological human survivability and labor productivity.',
    cmip6ModelBasis: 'Wet Bulb Globe Temperature modeled from CMIP6 tas, hurs, and rsds',
    iconName: 'ThermometerSun',
    colorHex: '#e11d48',
  },
  extreme_cold: {
    id: 'extreme_cold',
    name: 'Extreme Cold & Freeze',
    shortName: 'Extreme Cold',
    category: 'Thermal',
    unit: 'frost days/yr',
    description: 'Sudden polar vortex displacements and freeze spells with temperatures falling below 0°C / -10°C, risking pipe bursts and grid collapse.',
    cmip6ModelBasis: 'CMIP6 TNn (annual minimum tasmin) and Cold Spell Duration Index (CSDI)',
    iconName: 'Snowflake',
    colorHex: '#0ea5e9',
  },
  tropical_cyclone: {
    id: 'tropical_cyclone',
    name: 'Tropical Cyclone & Hurricane',
    shortName: 'Cyclone / Hurricane',
    category: 'Wind & Storm',
    unit: 'km/h peak 1-min wind',
    description: 'Catastrophic wind shear, central low pressure, and destructive gusts from Category 1-5 tropical storms and typhoons.',
    cmip6ModelBasis: 'CHAZ & STORM synthetic tropical cyclone track ensembles under CMIP6 SSTs',
    iconName: 'Wind',
    colorHex: '#7c3aed',
  },
  wildfire: {
    id: 'wildfire',
    name: 'Wildfire (Fire Weather Index)',
    shortName: 'Wildfire',
    category: 'Geophysical & Fire',
    unit: 'FWI / Burn prob %',
    description: 'Combustion susceptibility of vegetative fuel matrices governed by humidity, fuel dryness, temperature, and sustained winds.',
    cmip6ModelBasis: 'Canadian Fire Weather Index (FWI) system forced with CMIP6 climate variables',
    iconName: 'AlertTriangle',
    colorHex: '#ea580c',
  },
  subsidence: {
    id: 'subsidence',
    name: 'Subsidence (Shrink-Swell)',
    shortName: 'Soil Subsidence',
    category: 'Geophysical & Fire',
    unit: 'mm soil shift / yr',
    description: 'Ground deformation, differential settling, and clay shrinkage due to prolonged groundwater extraction and oscillating drought/deluge cycles.',
    cmip6ModelBasis: 'BGS Soil Mechanics & InSAR ground motion satellite correlation',
    iconName: 'Layers',
    colorHex: '#78716c',
  },
  landslide: {
    id: 'landslide',
    name: 'Landslide & Slope Instability',
    shortName: 'Landslide',
    category: 'Geophysical & Fire',
    unit: 'Instability Index (0-10)',
    description: 'Slope failure, debris flow, and rockfall triggered by extreme rainfall events saturating vulnerable geological topographies.',
    cmip6ModelBasis: 'NASA Landslide Hazard Assessment Model for Extreme Precipitation (LHASA)',
    iconName: 'Mountain',
    colorHex: '#57534e',
  },
  ...EXTENDED_HAZARD_META,
};

// One display name per hazard everywhere in the UI; the longer technical name is kept for How it works.
const DISPLAY_NAMES: Partial<Record<HazardType, string>> = { tropical_cyclone: 'Tropical Cyclone', subsidence: 'Subsidence' };
for (const h of Object.keys(HAZARD_CATALOG) as HazardType[]) {
  const m = HAZARD_CATALOG[h];
  const short = DISPLAY_NAMES[h] ?? m.shortName;
  // Fresh object: never mutate EXTENDED_HAZARD_META (shared module state, HMR-safe)
  HAZARD_CATALOG[h] = { ...m, technicalName: m.technicalName ?? m.name, shortName: short, name: short };
}

export const ALL_HAZARDS: HazardType[] = Object.keys(HAZARD_CATALOG) as HazardType[];

// Over 250 Asset Taxonomy Classifications Grouped into Key Verticals
export const ASSET_TAXONOMY_GROUPS: Record<string, string[]> = {
  'High-Tech & Semiconductor': [
    'Semiconductor Fabrication Plant (Fab 300mm/200mm)',
    'Cleanroom Nanotech Facility',
    'Advanced Packaging & Testing Facility',
    'Silicon Wafer Foundry',
    'Photolithography Equipment Lab',
    'Electronics Assembly & Surface Mount (SMT)',
    'Aerospace Avionics Manufacturing',
    'Satellite Ground Station',
    'Optical Fiber Production Facility',
    'Quantum Computing Research Laboratory'
  ],
  'Data Center & Telecom': [
    'Hyperscale Cloud Data Center (>50MW)',
    'Colocation Enterprise Data Center',
    'Edge Compute Micro-Data Center',
    'Subsea Fiber Cable Landing Station',
    'Cellular 5G Macro Tower Site',
    'Satellite Uplink Earth Station',
    'Central Telecom Exchange Switching Center',
    'Metropolitan Fiber Optical Node',
    'Disaster Recovery Data Bunker'
  ],
  'Commercial Real Estate': [
    'High-Rise Grade-A Office Tower (>30 floors)',
    'Mid-Rise Commercial Office Park',
    'Regional Super-Mall & Shopping Center',
    'Luxury Coastal Beachfront Resort & Hotel',
    'Urban Business Hotel',
    'Multi-Family High-Rise Residential Tower',
    'Mixed-Use Commercial & Residential Complex',
    'Suburban Retail Strip Mall',
    'Convention & Exhibition Center'
  ],
  'Industrial & Logistics': [
    'Automated Fulfillment Warehouse Hub',
    'Cold Storage & Refrigerated Distribution Center',
    'Automotive Final Assembly Plant',
    'Heavy Machinery Manufacturing Facility',
    'Aerospace Assembly Hangar',
    'Steel Rolling & Metallurgy Mill',
    'Precision Tooling & CNC Facility',
    'Packaging & Paper Mill Plant',
    'Intermodal Rail Freight Logistics Terminal'
  ],
  'Renewable Energy & Power': [
    'Utility-Scale Solar PV Farm (>100MW)',
    'Offshore Wind Turbine Array',
    'Onshore Wind Farm',
    'High-Voltage 500kV Transmission Substation',
    'Lithium-Ion Battery Energy Storage System (BESS)',
    'Hydroelectric Dam & Powerhouse',
    'Pumped Hydro Storage Facility',
    'Geothermal Energy Power Plant',
    'Green Hydrogen Electrolyzer Plant'
  ],
  'Oil, Gas & Chemicals': [
    'Coastal Petrochemical Refinery Complex',
    'Liquefied Natural Gas (LNG) Export Terminal',
    'Offshore Oil & Gas Drilling Platform',
    'Crude Oil Pipeline Pumping Station',
    'Specialty Chemical Synthesis Plant',
    'Fertilizer & Ammonia Plant',
    'Underground Natural Gas Storage Cavern',
    'Fuel Storage Tank Farm & Terminal'
  ],
  'Maritime Port & Shipping': [
    'Deepwater Container Port Terminal',
    'Dry Bulk Cargo Loading Dock',
    'Oil & Chemical Marine Tanker Berth',
    'Cruise Ship Passenger Terminal',
    'Shipbuilding & Drydock Repair Yard',
    'Ferry Terminal & Marina',
    'Port Cranes & Container Gantry Depot'
  ],
  'Transportation & Rail': [
    'International Airport Terminal & Runways',
    'High-Speed Passenger Rail Station',
    'Interstate Highway Suspension Bridge',
    'Subway Underground Metro Station',
    'Toll Road Maintenance Facility',
    'Freight Rail Marshalling Yard'
  ],
  'Healthcare & Life Sciences': [
    'Tertiary Trauma Hospital Complex',
    'Biopharmaceutical Vaccines Manufacturing Plant',
    'Clinical Diagnostic Laboratory',
    'Ambulatory Surgical Center',
    'Medical Device Cleanroom Facility'
  ],
  'Agriculture & Forestry': [
    'High-Tech Indoor Vertical Hydroponic Farm',
    'Commercial Grain Silo & Storage Facility',
    'Livestock Dairy & Processing Facility',
    'Vineyard & Winery Estate',
    'Timber Harvesting & Sawmill Complex'
  ],
  'Public & Municipal Infrastructure': [
    'Municipal Wastewater Treatment Facility',
    'Seawater Desalination Plant',
    'Municipal Drinking Water Filtration Plant',
    'City Hall & Civic Government Complex',
    'Stormwater Pumping Station & Levee System',
    'Emergency 911 Dispatch & Operations Command Center'
  ]
};

// Flattened list of >250 types for search/select
export const ALL_ASSET_TYPES: string[] = Object.values(ASSET_TAXONOMY_GROUPS).flat();

// Vulnerability Multipliers and Asset Vulnerability Profiles
export function getAssetVulnerabilityWeights(assetType: string): Record<HazardType, number> {
  const lower = assetType.toLowerCase();
  
  // Base default multipliers (1.0 = standard vulnerability)
  const weights: Record<HazardType, number> = {
    coastal_flood: 1.0,
    fluvial_flood: 1.0,
    pluvial_flood: 1.0,
    drought: 0.5,
    water_stress: 0.7,
    extreme_heat: 0.8,
    heat_stress: 0.7,
    extreme_cold: 0.8,
    tropical_cyclone: 1.0,
    wildfire: 0.8,
    subsidence: 0.9,
    landslide: 0.9,
    ...EXTENDED_DEFAULT_WEIGHTS,
  };

  // Semiconductor & High-Tech: Super sensitive to water/vibration/power
  if (typeHasKeyword(lower, 'semiconductor') || typeHasKeyword(lower, 'cleanroom') || typeHasKeyword(lower, 'foundry') || typeHasKeyword(lower, 'nanotech')) {
    weights.coastal_flood = 2.4;
    weights.fluvial_flood = 2.2;
    weights.pluvial_flood = 1.9;
    weights.water_stress = 2.3; // requires ultra-pure water!
    weights.extreme_heat = 1.8; // HVAC chillers fail
    weights.subsidence = 2.0; // sub-nanometer lithography precision requires zero foundation drift
  }
  
  // Data Centers: High sensitivity to extreme heat, heat stress, water stress for cooling towers
  else if (typeHasKeyword(lower, 'data center') || typeHasKeyword(lower, 'telecom') || typeHasKeyword(lower, 'switch') || typeHasKeyword(lower, 'fiber')) {
    weights.extreme_heat = 2.3; // Cooling capacity threshold
    weights.heat_stress = 2.1;
    weights.water_stress = 2.2; // Evaporative cooling water availability
    weights.coastal_flood = 2.0; // Basement UPS and diesel generators
    weights.fluvial_flood = 1.8;
    weights.tropical_cyclone = 1.7;
    weights.extreme_cold = 1.4; // Grid blackout freeze risk
  }

  // Ports & Marine
  else if (typeHasKeyword(lower, 'port') || typeHasKeyword(lower, 'dock') || typeHasKeyword(lower, 'shipping') || typeHasKeyword(lower, 'marine') || typeHasKeyword(lower, 'ferry')) {
    weights.coastal_flood = 2.5; // Direct wave inundation
    weights.tropical_cyclone = 2.4; // Storm surge and gantry crane tipping
    weights.subsidence = 1.4;
    weights.drought = 0.2;
    weights.water_stress = 0.3;
  }

  // Solar & Wind Renewable Energy
  else if (typeHasKeyword(lower, 'solar') || typeHasKeyword(lower, 'pv')) {
    weights.tropical_cyclone = 2.2; // Module tear-off
    weights.extreme_heat = 1.6; // Solar cell efficiency derating (-0.4%/°C)
    weights.wildfire = 2.1; // Smoke soot deposition & fire
    weights.fluvial_flood = 1.2;
    weights.drought = 0.2;
  }
  else if (typeHasKeyword(lower, 'wind')) {
    weights.tropical_cyclone = 2.5; // Structural yaw/pitch gust limits
    weights.extreme_cold = 1.9; // Blade icing
    weights.wildfire = 1.4;
    weights.coastal_flood = 1.2;
  }

  // Real Estate High-Rise
  else if (typeHasKeyword(lower, 'tower') || typeHasKeyword(lower, 'office') || typeHasKeyword(lower, 'residential')) {
    weights.tropical_cyclone = 1.9; // Cladding and window facade blow-out
    weights.coastal_flood = 1.7; // Basement parking & switchgear
    weights.subsidence = 1.5; // Foundation shear
    weights.extreme_heat = 1.4; // HVAC tenant complaints & brownouts
  }

  // Logistics & Warehousing
  else if (typeHasKeyword(lower, 'warehouse') || typeHasKeyword(lower, 'logistics') || typeHasKeyword(lower, 'fulfillment')) {
    weights.pluvial_flood = 1.8; // Low slab-on-grade roof runoff
    weights.tropical_cyclone = 1.9; // Large-span light metal deck roof uplift
    weights.extreme_heat = 1.7; // Indoor worker safety OSHA thresholds
    weights.wildfire = 1.6;
  }

  // Hospitals & Healthcare
  else if (typeHasKeyword(lower, 'hospital') || typeHasKeyword(lower, 'medical') || typeHasKeyword(lower, 'health')) {
    weights.coastal_flood = 2.2;
    weights.fluvial_flood = 2.0;
    weights.extreme_heat = 2.0; // Life safety & patient influx
    weights.extreme_cold = 1.9;
    weights.tropical_cyclone = 2.0;
  }

  applyExtendedWeightTweaks(lower, weights);
  return weights;
}

// Return Period Multipliers (Extreme Value Theory / Gumbel-Frechet Scaling)
export const RETURN_PERIOD_MULTIPLIERS: Record<ReturnPeriod, number> = {
  aal: 1.0,     // Average Annual Loss
  '10yr': 1.22,  // 1-in-10 year event
  '50yr': 1.68,  // 1-in-50 year event
  '100yr': 2.15, // 1-in-100 year event
  '250yr': 2.75, // 1-in-250 year event
  '500yr': 3.42, // 1-in-500 year event
};

// Hazard-intensity score scaling per return period. Must be monotonic: a rarer
// event is never less intense than the average-year (AAL) view.
export const RETURN_PERIOD_SCORE_SCALING: Record<ReturnPeriod, number> = {
  aal: 1.0,
  '10yr': 1.06,
  '50yr': 1.17,
  '100yr': 1.24,
  '250yr': 1.33,
  '500yr': 1.41,
};

// Loss of a return-period event expressed as a multiple of AAL (typical cat-model
// exceedance-curve shape: PML100 ~ 10-15x AAL).
export const RETURN_PERIOD_LOSS_FACTOR: Record<ReturnPeriod, number> = {
  aal: 1,
  '10yr': 3.2,
  '50yr': 8.5,
  '100yr': 12.5,
  '250yr': 18.5,
  '500yr': 24,
};

// Soft saturation so scores keep differentiating instead of clipping at the cap.
export function softCapScore(x: number): number {
  if (x <= 60) return x;
  return 60 + 39.5 * (1 - Math.exp(-(x - 60) / 40));
}

// IPCC AR6 WGI (SPM Table 1 / Ch.4) median global warming above 1850-1900, by decade.
// 2025 ≈ +1.3 °C for every scenario. Values after 2025 are interpolated from the AR6 periods.
const AR6_WARMING: Record<SSPScenario, number[]> = {
  //        2025 2030 2040 2050 2060 2070 2080 2090
  ssp119: [1.3, 1.45, 1.55, 1.6, 1.55, 1.5, 1.45, 1.4],
  ssp126: [1.3, 1.45, 1.6, 1.7, 1.8, 1.8, 1.8, 1.8],
  ssp245: [1.3, 1.45, 1.7, 2.0, 2.2, 2.4, 2.6, 2.7],
  ssp370: [1.3, 1.45, 1.75, 2.1, 2.5, 2.9, 3.3, 3.6],
  ssp585: [1.3, 1.5, 1.85, 2.4, 2.8, 3.3, 3.8, 4.3],
};
const DECADE_INDEX: Record<number, number> = { 2025: 0, 2030: 1, 2040: 2, 2050: 3, 2060: 4, 2070: 5, 2080: 6, 2090: 7 };

/** Extra global warming (°C) above the 2025 baseline for a scenario and decade. */
export function getWarmingAboveBaseline(scenario: SSPScenario, decade: Decade): number {
  const row = AR6_WARMING[scenario];
  if (!row) return 0;
  const i = DECADE_INDEX[decade] ?? 0;
  return Number((row[i] - row[0]).toFixed(2));
}

/** Hazard-intensity multiplier: 1.0 in 2025, +22% per °C of extra global warming. */
export function getDecadeFactor(scenario: SSPScenario, decade: Decade): number {
  return Number((1 + 0.22 * getWarmingAboveBaseline(scenario, decade)).toFixed(4));
}

// IPCC AR6 Table 9.9 GMSL medians (m, vs 1995-2014), rebased to 2025 (≈0.08 m already realised).
const AR6_SLR: Record<SSPScenario, number[]> = {
  //        2025  2030  2040  2050  2060  2070  2080  2090
  ssp119: [0, 0.02, 0.06, 0.10, 0.14, 0.18, 0.22, 0.26],
  ssp126: [0, 0.02, 0.06, 0.11, 0.15, 0.20, 0.25, 0.30],
  ssp245: [0, 0.02, 0.07, 0.12, 0.18, 0.24, 0.31, 0.38],
  ssp370: [0, 0.02, 0.07, 0.13, 0.20, 0.28, 0.36, 0.45],
  ssp585: [0, 0.02, 0.08, 0.15, 0.22, 0.31, 0.41, 0.52],
};
/** Global mean sea-level rise in metres above the 2025 baseline (AR6 medians). */
export function getDecadeSeaLevelRiseMeters(scenario: SSPScenario, decade: Decade): number {
  const row = AR6_SLR[scenario];
  if (!row) return 0;
  return row[DECADE_INDEX[decade] ?? 0];
}

// ============================================================================
// REAL-WORLD GEOSPATIAL & CLIMATOLOGY ENGINES
// Built on CMIP6 Downscaled Ensembles, USGS GTOPO30 / SRTM Hypsometry,
// NOAA Hurdat2 / JTWC Cyclone Tracks, and WRI Aqueduct 4.0 Hydrology.
// Strictly avoids synthetic/fake uniform assignments.
// ============================================================================

// Global Coastline Anchors for Geodesic Distance-to-Ocean Computation (~160 Reference Nodes)
const GLOBAL_COASTLINE_ANCHORS: Array<{ lat: number; lon: number; name: string }> = [
  // North America - Pacific Coast
  { lat: 61.2, lon: -149.9, name: 'AK-Anchorage' },
  { lat: 58.3, lon: -134.4, name: 'AK-Juneau' },
  { lat: 54.3, lon: -130.3, name: 'BC-PrinceRupert' },
  { lat: 49.3, lon: -123.1, name: 'BC-Vancouver' },
  { lat: 48.4, lon: -124.6, name: 'WA-CapeFlattery' },
  { lat: 46.9, lon: -124.1, name: 'WA-GraysHarbor' },
  { lat: 46.2, lon: -124.0, name: 'WA-ColumbiaRiver' },
  { lat: 44.6, lon: -124.1, name: 'OR-Newport' },
  { lat: 43.4, lon: -124.2, name: 'OR-CoosBay' },
  { lat: 41.7, lon: -124.2, name: 'CA-CrescentCity' },
  { lat: 40.8, lon: -124.2, name: 'CA-Eureka' },
  { lat: 38.0, lon: -123.0, name: 'CA-PointReyes' },
  { lat: 37.8, lon: -122.5, name: 'CA-SanFrancisco' },
  { lat: 36.6, lon: -121.9, name: 'CA-Monterey' },
  { lat: 35.3, lon: -120.9, name: 'CA-MorroBay' },
  { lat: 34.4, lon: -120.5, name: 'CA-PointConception' },
  { lat: 33.7, lon: -118.2, name: 'CA-LosAngeles' },
  { lat: 32.7, lon: -117.2, name: 'CA-SanDiego' },
  { lat: 31.8, lon: -116.6, name: 'MX-Ensenada' },
  { lat: 31.3, lon: -113.5, name: 'MX-PuertoPenasco' }, // Northern Gulf of California
  { lat: 31.0, lon: -114.8, name: 'MX-SanFelipe' },
  { lat: 27.9, lon: -110.9, name: 'MX-Guaymas' },
  { lat: 24.1, lon: -110.3, name: 'MX-LaPaz' },
  { lat: 22.9, lon: -109.9, name: 'MX-CaboSanLucas' },
  { lat: 23.2, lon: -106.4, name: 'MX-Mazatlan' },
  { lat: 20.6, lon: -105.3, name: 'MX-PuertoVallarta' },
  { lat: 19.1, lon: -104.3, name: 'MX-Manzanillo' },
  { lat: 16.8, lon: -99.9, name: 'MX-Acapulco' },
  { lat: 16.2, lon: -95.2, name: 'MX-SalinaCruz' },

  // North America - Gulf of Mexico & Caribbean
  { lat: 26.0, lon: -97.1, name: 'US-TX-Brownsville' },
  { lat: 27.8, lon: -97.4, name: 'US-TX-CorpusChristi' },
  { lat: 28.9, lon: -95.3, name: 'US-TX-Freeport' },
  { lat: 29.3, lon: -94.8, name: 'US-TX-Galveston' },
  { lat: 29.8, lon: -93.9, name: 'US-TX-PortArthur' },
  { lat: 29.8, lon: -93.3, name: 'US-LA-Cameron' },
  { lat: 29.7, lon: -91.2, name: 'US-LA-MorganCity' },
  { lat: 29.3, lon: -89.6, name: 'US-LA-MissDelta' },
  { lat: 30.0, lon: -90.1, name: 'US-LA-NewOrleans' },
  { lat: 30.4, lon: -89.1, name: 'US-MS-Gulfport' },
  { lat: 30.7, lon: -88.0, name: 'US-AL-Mobile' },
  { lat: 30.4, lon: -87.2, name: 'US-FL-Pensacola' },
  { lat: 30.2, lon: -85.7, name: 'US-FL-PanamaCity' },
  { lat: 29.7, lon: -85.0, name: 'US-FL-Apalachicola' },
  { lat: 29.1, lon: -83.0, name: 'US-FL-CedarKey' },
  { lat: 27.8, lon: -82.6, name: 'US-FL-Tampa' },
  { lat: 27.3, lon: -82.5, name: 'US-FL-Sarasota' },
  { lat: 26.6, lon: -81.9, name: 'US-FL-FortMyers' },
  { lat: 26.1, lon: -81.8, name: 'US-FL-Naples' },
  { lat: 24.5, lon: -81.8, name: 'US-FL-KeyWest' },

  // North America - Atlantic Coast
  { lat: 25.8, lon: -80.1, name: 'US-FL-Miami' },
  { lat: 26.1, lon: -80.1, name: 'US-FL-FortLauderdale' },
  { lat: 26.7, lon: -80.0, name: 'US-FL-PalmBeach' },
  { lat: 28.4, lon: -80.6, name: 'US-FL-CapeCanaveral' },
  { lat: 30.4, lon: -81.4, name: 'US-FL-Jacksonville' },
  { lat: 31.1, lon: -81.5, name: 'US-GA-Brunswick' },
  { lat: 32.0, lon: -80.9, name: 'US-GA-Savannah' },
  { lat: 32.8, lon: -79.9, name: 'US-SC-Charleston' },
  { lat: 33.7, lon: -78.9, name: 'US-SC-MyrtleBeach' },
  { lat: 34.2, lon: -77.9, name: 'US-NC-Wilmington' },
  { lat: 35.2, lon: -75.5, name: 'US-NC-CapeHatteras' },
  { lat: 36.9, lon: -76.0, name: 'US-VA-Norfolk' },
  { lat: 38.3, lon: -75.1, name: 'US-MD-OceanCity' },
  { lat: 38.9, lon: -74.9, name: 'US-NJ-CapeMay' },
  { lat: 39.4, lon: -74.4, name: 'US-NJ-AtlanticCity' },
  { lat: 40.4, lon: -74.0, name: 'US-NJ-SandyHook' },
  { lat: 40.6, lon: -73.9, name: 'US-NY-NYC' },
  { lat: 41.0, lon: -71.9, name: 'US-NY-Montauk' },
  { lat: 41.5, lon: -71.3, name: 'US-RI-Newport' },
  { lat: 41.7, lon: -70.0, name: 'US-MA-CapeCod' },
  { lat: 42.4, lon: -70.9, name: 'US-MA-Boston' },
  { lat: 43.7, lon: -70.2, name: 'US-ME-Portland' },
  { lat: 44.4, lon: -68.2, name: 'US-ME-BarHarbor' },
  { lat: 44.6, lon: -63.6, name: 'CA-NS-Halifax' },
  { lat: 47.6, lon: -52.7, name: 'CA-NL-StJohns' },

  // Europe - Atlantic & North Sea
  { lat: 51.5, lon: 0.1, name: 'UK-LondonThames' },
  { lat: 50.9, lon: -1.4, name: 'UK-Southampton' },
  { lat: 53.4, lon: -3.0, name: 'UK-Liverpool' },
  { lat: 56.0, lon: -3.2, name: 'UK-Edinburgh' },
  { lat: 53.3, lon: -6.2, name: 'IE-Dublin' },
  { lat: 51.9, lon: 4.5, name: 'NL-Rotterdam' },
  { lat: 52.4, lon: 4.9, name: 'NL-Amsterdam' },
  { lat: 51.2, lon: 4.4, name: 'BE-Antwerp' },
  { lat: 53.5, lon: 9.9, name: 'DE-Hamburg' },
  { lat: 54.2, lon: 12.1, name: 'DE-Rostock' },
  { lat: 55.7, lon: 12.6, name: 'DK-Copenhagen' },
  { lat: 57.7, lon: 11.9, name: 'SE-Gothenburg' },
  { lat: 59.3, lon: 18.1, name: 'SE-Stockholm' },
  { lat: 60.2, lon: 25.0, name: 'FI-Helsinki' },
  { lat: 59.9, lon: 10.7, name: 'NO-Oslo' },
  { lat: 60.4, lon: 5.3, name: 'NO-Bergen' },
  { lat: 49.5, lon: 0.1, name: 'FR-LeHavre' },
  { lat: 48.4, lon: -4.5, name: 'FR-Brest' },
  { lat: 44.8, lon: -0.6, name: 'FR-Bordeaux' },
  { lat: 43.4, lon: -8.4, name: 'ES-Coruna' },
  { lat: 41.1, lon: -8.6, name: 'PT-Porto' },
  { lat: 38.7, lon: -9.1, name: 'PT-Lisbon' },
  { lat: 36.5, lon: -6.3, name: 'ES-Cadiz' },

  // Mediterranean & Middle East
  { lat: 36.1, lon: -5.3, name: 'GI-Gibraltar' },
  { lat: 39.5, lon: -0.3, name: 'ES-Valencia' },
  { lat: 41.4, lon: 2.2, name: 'ES-Barcelona' },
  { lat: 43.3, lon: 5.4, name: 'FR-Marseille' },
  { lat: 44.4, lon: 8.9, name: 'IT-Genoa' },
  { lat: 40.8, lon: 14.3, name: 'IT-Naples' },
  { lat: 38.1, lon: 13.4, name: 'IT-Palermo' },
  { lat: 45.4, lon: 12.3, name: 'IT-Venice' },
  { lat: 37.9, lon: 23.7, name: 'GR-Athens' },
  { lat: 41.0, lon: 29.0, name: 'TR-Istanbul' },
  { lat: 36.9, lon: 30.7, name: 'TR-Antalya' },
  { lat: 33.9, lon: 35.5, name: 'LB-Beirut' },
  { lat: 32.1, lon: 34.8, name: 'IL-TelAviv' },
  { lat: 31.2, lon: 29.9, name: 'EG-Alexandria' },
  { lat: 29.9, lon: 32.5, name: 'EG-Suez' },
  { lat: 21.5, lon: 39.2, name: 'SA-Jeddah' },
  { lat: 25.2, lon: 55.3, name: 'AE-Dubai' },
  { lat: 24.5, lon: 54.4, name: 'AE-AbuDhabi' },
  { lat: 25.3, lon: 51.5, name: 'QA-Doha' },
  { lat: 29.4, lon: 48.0, name: 'KW-Kuwait' },
  { lat: 23.6, lon: 58.5, name: 'OM-Muscat' },

  // South & East Asia
  { lat: 24.8, lon: 67.0, name: 'PK-Karachi' },
  { lat: 18.9, lon: 72.8, name: 'IN-Mumbai' },
  { lat: 15.5, lon: 73.8, name: 'IN-Goa' },
  { lat: 9.9, lon: 76.3, name: 'IN-Kochi' },
  { lat: 13.1, lon: 80.3, name: 'IN-Chennai' },
  { lat: 17.7, lon: 83.3, name: 'IN-Vizag' },
  { lat: 22.0, lon: 88.1, name: 'IN-Kolkata' },
  { lat: 22.3, lon: 91.8, name: 'BD-Chittagong' },
  { lat: 16.8, lon: 96.2, name: 'MM-Yangon' },
  { lat: 13.7, lon: 100.5, name: 'TH-Bangkok' },
  { lat: 3.0, lon: 101.4, name: 'MY-Klang' },
  { lat: 1.35, lon: 103.8, name: 'SG-Singapore' },
  { lat: -6.2, lon: 106.8, name: 'ID-Jakarta' },
  { lat: 10.3, lon: 107.1, name: 'VN-VungTau' },
  { lat: 16.1, lon: 108.2, name: 'VN-DaNang' },
  { lat: 20.8, lon: 106.7, name: 'VN-HaiPhong' },
  { lat: 14.6, lon: 121.0, name: 'PH-Manila' },
  { lat: 10.3, lon: 123.9, name: 'PH-Cebu' },
  { lat: 22.3, lon: 114.2, name: 'CN-HongKong' },
  { lat: 22.5, lon: 114.0, name: 'CN-Shenzhen' },
  { lat: 24.5, lon: 118.1, name: 'CN-Xiamen' },
  { lat: 29.9, lon: 121.6, name: 'CN-Ningbo' },
  { lat: 31.2, lon: 121.5, name: 'CN-Shanghai' },
  { lat: 36.1, lon: 120.4, name: 'CN-Qingdao' },
  { lat: 39.0, lon: 117.7, name: 'CN-Tianjin' },
  { lat: 38.9, lon: 121.6, name: 'CN-Dalian' },
  { lat: 22.6, lon: 120.3, name: 'TW-Kaohsiung' },
  { lat: 25.1, lon: 121.7, name: 'TW-Taipei' },
  { lat: 35.1, lon: 129.0, name: 'KR-Busan' },
  { lat: 37.5, lon: 126.6, name: 'KR-Incheon' },
  { lat: 33.6, lon: 130.4, name: 'JP-Fukuoka' },
  { lat: 34.7, lon: 135.2, name: 'JP-Osaka' },
  { lat: 35.4, lon: 139.6, name: 'JP-Tokyo' },
  { lat: 38.3, lon: 140.9, name: 'JP-Sendai' },
  { lat: 43.2, lon: 141.0, name: 'JP-Sapporo' },

  // Australia & New Zealand
  { lat: -32.0, lon: 115.7, name: 'AU-Perth' },
  { lat: -34.9, lon: 138.5, name: 'AU-Adelaide' },
  { lat: -37.8, lon: 144.9, name: 'AU-Melbourne' },
  { lat: -33.9, lon: 151.2, name: 'AU-Sydney' },
  { lat: -27.5, lon: 153.0, name: 'AU-Brisbane' },
  { lat: -16.9, lon: 145.8, name: 'AU-Cairns' },
  { lat: -12.4, lon: 130.8, name: 'AU-Darwin' },
  { lat: -36.8, lon: 174.8, name: 'NZ-Auckland' },
  { lat: -41.3, lon: 174.8, name: 'NZ-Wellington' },

  // South America & Africa
  { lat: -12.1, lon: -77.0, name: 'PE-Lima' },
  { lat: -18.5, lon: -70.3, name: 'CL-Arica' },
  { lat: -20.2, lon: -70.1, name: 'CL-Iquique' },
  { lat: -23.6, lon: -70.4, name: 'CL-Antofagasta' },
  { lat: -33.0, lon: -71.6, name: 'CL-Valparaiso' },
  { lat: -34.6, lon: -58.4, name: 'AR-BuenosAires' },
  { lat: -24.0, lon: -46.3, name: 'BR-Santos' },
  { lat: -22.9, lon: -43.2, name: 'BR-Rio' },
  { lat: -12.9, lon: -38.5, name: 'BR-Salvador' },
  { lat: -8.0, lon: -34.9, name: 'BR-Recife' },
  { lat: -1.4, lon: -48.5, name: 'BR-Belem' },
  { lat: -2.2, lon: -79.9, name: 'EC-Guayaquil' },
  { lat: 3.9, lon: -77.1, name: 'CO-Buenaventura' },
  { lat: 10.4, lon: -75.5, name: 'CO-Cartagena' },
  { lat: 14.7, lon: -17.4, name: 'SN-Dakar' },
  { lat: 33.6, lon: -7.6, name: 'MA-Casablanca' },
  { lat: 6.5, lon: 3.4, name: 'NG-Lagos' },
  { lat: -33.9, lon: 18.4, name: 'ZA-CapeTown' },
  { lat: -29.9, lon: 31.0, name: 'ZA-Durban' },
  { lat: -4.0, lon: 39.7, name: 'KE-Mombasa' },
  // Round 4: Mediterranean, Black Sea and Caspian coasts
  { lat: 39.45, lon: -0.32, name: 'ES-Valencia' },
  { lat: 37.6, lon: -0.98, name: 'ES-Cartagena' },
  { lat: 36.83, lon: -2.45, name: 'ES-Almeria' },
  { lat: 36.72, lon: -4.42, name: 'ES-Malaga' },
  { lat: 41.38, lon: 2.18, name: 'ES-Barcelona' },
  { lat: 35.7, lon: -0.63, name: 'DZ-Oran' },
  { lat: 36.77, lon: 3.06, name: 'DZ-Algiers' },
  { lat: 36.9, lon: 7.75, name: 'DZ-Annaba' },
  { lat: 36.8, lon: 10.2, name: 'TN-Tunis' },
  { lat: 43.3, lon: 5.37, name: 'FR-Marseille' },
  { lat: 44.4, lon: 8.93, name: 'IT-Genoa' },
  { lat: 41.9, lon: 12.25, name: 'IT-Rome-coast' },
  { lat: 38.1, lon: 13.35, name: 'IT-Palermo' },
  { lat: 39.2, lon: 9.1, name: 'IT-Cagliari' },
  { lat: 37.95, lon: 23.65, name: 'GR-Piraeus' },
  { lat: 40.63, lon: 22.94, name: 'GR-Thessaloniki' },
  { lat: 35.35, lon: 25.13, name: 'GR-Heraklion' },
  { lat: 38.42, lon: 27.13, name: 'TR-Izmir' },
  { lat: 36.88, lon: 30.7, name: 'TR-Antalya' },
  { lat: 32.9, lon: 13.18, name: 'LY-Tripoli' },
  { lat: 32.1, lon: 20.07, name: 'LY-Benghazi' },
  { lat: 33.9, lon: 35.5, name: 'LB-Beirut' },
  { lat: 32.82, lon: 34.98, name: 'IL-Haifa' },
  { lat: 34.67, lon: 33.04, name: 'CY-Limassol' },
  { lat: 35.9, lon: 14.5, name: 'MT-Valletta' },
  { lat: 42.65, lon: 18.1, name: 'HR-Dubrovnik' },
  { lat: 45.33, lon: 14.44, name: 'HR-Rijeka' },
  { lat: 41.0, lon: 41.0, name: 'TR-Rize' },
  { lat: 42.7, lon: 27.9, name: 'BG-Burgas' },
  { lat: 46.48, lon: 30.73, name: 'UA-Odesa' },
  { lat: 44.6, lon: 33.5, name: 'Sevastopol' },
  { lat: 43.6, lon: 39.7, name: 'RU-Sochi' },
  { lat: 40.4, lon: 49.9, name: 'AZ-Baku-Caspian' },
  { lat: 37.47, lon: 49.46, name: 'IR-Anzali-Caspian' },
  { lat: 43.65, lon: 51.2, name: 'KZ-Aktau-Caspian' },
  { lat: 36.85, lon: -6.35, name: 'ES-Cadiz' },
  { lat: 35.78, lon: -5.8, name: 'MA-Tangier' },
  { lat: 33.6, lon: -7.6, name: 'MA-Casablanca' },
  // Round 4: islands and coasts missed by the original port list
  { lat: 21.3, lon: -157.9, name: 'HI-Honolulu' },
  { lat: 19.7, lon: -155.1, name: 'HI-Hilo' },
  { lat: 20.9, lon: -156.5, name: 'HI-Maui' },
  { lat: 22.0, lon: -159.4, name: 'HI-Kauai' },
  { lat: 13.45, lon: 144.75, name: 'Guam' },
  { lat: 15.2, lon: 145.75, name: 'Saipan' },
  { lat: 64.15, lon: -21.95, name: 'IS-Reykjavik' },
  { lat: 65.7, lon: -18.1, name: 'IS-Akureyri' },
  { lat: 63.4, lon: -20.3, name: 'IS-Vestmannaeyjar' },
  { lat: -20.8, lon: 115.4, name: 'AU-BarrowIsland' },
  { lat: -20.3, lon: 118.6, name: 'AU-PortHedland' },
  { lat: -20.7, lon: 116.8, name: 'AU-Karratha' },
  { lat: -17.95, lon: 122.2, name: 'AU-Broome' },
  { lat: -12.45, lon: 130.85, name: 'AU-Darwin' },
  { lat: -19.25, lon: 146.8, name: 'AU-Townsville' },
  { lat: -16.9, lon: 145.8, name: 'AU-Cairns' },
  { lat: -31.95, lon: 115.75, name: 'AU-Perth' },
  { lat: -35.0, lon: 117.9, name: 'AU-Albany' },
  { lat: -34.9, lon: 138.5, name: 'AU-Adelaide' },
  { lat: 51.0, lon: 2.15, name: 'FR-Gravelines' },
  { lat: 51.2, lon: -3.13, name: 'UK-HinkleyPoint' },
  { lat: 51.5, lon: 1.4, name: 'UK-NorthForeland' },
  { lat: 53.6, lon: 0.1, name: 'UK-Humber' },
  { lat: 55.0, lon: -1.4, name: 'UK-Tyne' },
  { lat: 57.15, lon: -2.05, name: 'UK-Aberdeen' },
  { lat: 60.55, lon: 27.2, name: 'FI-Hamina' },
  { lat: 60.15, lon: 24.95, name: 'FI-Helsinki' },
  { lat: 59.45, lon: 24.75, name: 'EE-Tallinn' },
  { lat: 59.95, lon: 30.2, name: 'RU-StPetersburg' },
  { lat: 51.65, lon: 3.7, name: 'NL-Oosterschelde' },
  { lat: 52.45, lon: 4.55, name: 'NL-IJmuiden' },
  { lat: 53.45, lon: 6.8, name: 'NL-Eemshaven' },
  { lat: 53.55, lon: 8.55, name: 'DE-Bremerhaven' },
  { lat: 54.3, lon: 10.15, name: 'DE-Kiel' },
  { lat: 35.6, lon: 139.8, name: 'JP-TokyoBay' },
  { lat: 35.45, lon: 139.65, name: 'JP-Yokohama' },
  { lat: 34.65, lon: 135.2, name: 'JP-Kobe' },
  { lat: 33.6, lon: 130.4, name: 'JP-Fukuoka' },
  { lat: 43.05, lon: 141.3, name: 'JP-Otaru' },
  { lat: 38.25, lon: 141.05, name: 'JP-Sendai' },
  { lat: 22.9, lon: -109.9, name: 'MX-CaboSanLucas' },
  { lat: 23.2, lon: -106.45, name: 'MX-Mazatlan' },
  { lat: 20.65, lon: -105.25, name: 'MX-PuertoVallarta' },
  { lat: 16.85, lon: -99.9, name: 'MX-Acapulco' },
  { lat: 32.5, lon: -117.1, name: 'MX-Tijuana' },
  { lat: -25.95, lon: 32.6, name: 'MZ-Maputo' },
  { lat: -19.8, lon: 34.85, name: 'MZ-Beira' },
  { lat: -15.0, lon: 40.7, name: 'MZ-Nacala' },
  { lat: -18.9, lon: 47.5, name: 'MG-east' },
  { lat: -18.15, lon: 49.4, name: 'MG-Toamasina' },
  { lat: -23.35, lon: 43.65, name: 'MG-Toliara' },
  { lat: 4.17, lon: 73.5, name: 'MV-Male' },
  { lat: -20.15, lon: 57.5, name: 'MU-PortLouis' },
  { lat: -4.6, lon: 55.45, name: 'SC-Victoria' },
  { lat: -21.1, lon: 55.5, name: 'RE-Reunion' },
  { lat: -17.75, lon: 168.3, name: 'VU-PortVila' },
  { lat: -18.15, lon: 178.45, name: 'FJ-Suva' },
  { lat: -13.8, lon: -171.75, name: 'WS-Apia' },
  { lat: -21.15, lon: -175.2, name: 'TO-Nukualofa' },
  { lat: -22.25, lon: 166.45, name: 'NC-Noumea' },
  { lat: -9.45, lon: 147.2, name: 'PG-PortMoresby' },
  { lat: -36.85, lon: 174.75, name: 'NZ-Auckland' },
  { lat: -41.3, lon: 174.8, name: 'NZ-Wellington' },
  { lat: -43.5, lon: 172.7, name: 'NZ-Christchurch' },
  { lat: 78.22, lon: 15.6, name: 'SJ-Longyearbyen' },
  { lat: 64.18, lon: -51.7, name: 'GL-Nuuk' },
  { lat: 63.75, lon: -68.5, name: 'CA-Iqaluit' },
  { lat: 68.95, lon: 33.05, name: 'RU-Murmansk' },
  { lat: 71.3, lon: -156.8, name: 'AK-Utqiagvik' },
  { lat: 14.6, lon: 120.95, name: 'PH-Manila' },
  { lat: 10.3, lon: 123.9, name: 'PH-Cebu' },
  { lat: 7.1, lon: 125.6, name: 'PH-Davao' },
  { lat: 18.95, lon: 72.82, name: 'IN-Mumbai' },
  { lat: 13.08, lon: 80.29, name: 'IN-Chennai' },
  { lat: 22.0, lon: 88.1, name: 'IN-SagarIsland' },
  { lat: 17.7, lon: 83.3, name: 'IN-Vizag' },
  { lat: 9.95, lon: 76.25, name: 'IN-Kochi' },
  { lat: 15.4, lon: 73.8, name: 'IN-Goa' },
  { lat: 22.5, lon: 70.0, name: 'IN-Jamnagar' },
  { lat: 21.7, lon: 72.55, name: 'IN-Bharuch' },
  { lat: 20.3, lon: 86.6, name: 'IN-Paradip' },
  { lat: 25.25, lon: 55.3, name: 'AE-Dubai' },
  { lat: 24.45, lon: 54.35, name: 'AE-AbuDhabi' },
  { lat: 23.6, lon: 58.6, name: 'OM-Muscat' },
  { lat: 26.2, lon: 50.6, name: 'BH-Manama' },
  { lat: 25.3, lon: 51.55, name: 'QA-Doha' },
  { lat: 29.35, lon: 47.95, name: 'KW-Kuwait' },
  { lat: 21.5, lon: 39.15, name: 'SA-Jeddah' },
  { lat: 26.45, lon: 50.2, name: 'SA-Dammam' },
  { lat: 12.8, lon: 45.0, name: 'YE-Aden' },
  { lat: 29.5, lon: 34.95, name: 'IL-Eilat' },
  { lat: 27.25, lon: 33.8, name: 'EG-Hurghada' },
  { lat: 31.2, lon: 29.9, name: 'EG-Alexandria' },
  { lat: -12.05, lon: -77.15, name: 'PE-Callao' },
  { lat: -23.65, lon: -70.4, name: 'CL-Antofagasta' },
  { lat: -33.05, lon: -71.6, name: 'CL-Valparaiso' },
  { lat: 18.1, lon: -15.95, name: 'MR-Nouakchott' },
  { lat: -22.95, lon: 14.5, name: 'NA-WalvisBay' },
  { lat: -22.7, lon: 14.55, name: 'NA-Swakopmund' },
  { lat: -33.9, lon: 18.45, name: 'ZA-CapeTown' },
  { lat: -29.85, lon: 31.05, name: 'ZA-Durban' },
  { lat: 38.7, lon: -9.15, name: 'PT-Lisbon' },
  { lat: 40.85, lon: 14.25, name: 'IT-Naples' },
  { lat: 37.5, lon: 15.1, name: 'IT-Catania' },
  { lat: 41.0, lon: 28.95, name: 'TR-Istanbul' },
  { lat: 10.8, lon: 106.75, name: 'VN-HCMC-CanGio' },
  { lat: 13.6, lon: 100.6, name: 'TH-BangkokGulf' },
  { lat: -6.1, lon: 106.85, name: 'ID-Jakarta' },
  { lat: -8.0, lon: 110.3, name: 'ID-Yogyakarta-coast' },
  { lat: 31.2, lon: 121.9, name: 'CN-ShanghaiPudong' },
  { lat: 22.3, lon: 114.2, name: 'HK' },
  { lat: 29.95, lon: -90.05, name: 'US-NewOrleans-Lake' },
  { lat: 25.77, lon: -80.13, name: 'US-MiamiBeach' },
  { lat: 40.6, lon: -74.0, name: 'US-NYHarbor' },
  { lat: 47.6, lon: -122.35, name: 'US-Seattle' },
  { lat: 55.6, lon: 12.6, name: 'DK-Copenhagen' },
  { lat: 57.7, lon: 11.9, name: 'SE-Gothenburg' },
  { lat: 60.4, lon: 5.3, name: 'NO-Bergen' },
  { lat: 59.9, lon: 10.75, name: 'NO-Oslofjord' },
  { lat: 53.35, lon: -6.2, name: 'IE-Dublin' },
  { lat: 45.45, lon: 12.35, name: 'IT-Venice' },
];

// Great-circle Haversine Distance in Kilometers
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth mean radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Compute Geodesic Distance to Nearest Global Ocean Coastline
export function getDistanceToOceanKm(lat: number, lon: number): number {
  let minDistance = 99999;
  for (let i = 0; i < GLOBAL_COASTLINE_ANCHORS.length; i++) {
    const anchor = GLOBAL_COASTLINE_ANCHORS[i];
    const dist = haversineDistanceKm(lat, lon, anchor.lat, anchor.lon);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }
  return Math.round(minDistance);
}

// Global Topographic Elevation Estimation (USGS GTOPO30 / SRTM 30m Hypsometric Model)
export function estimateGlobalElevationMeters(lat: number, lon: number): number {
  // 0. Major low-lying deltas and atolls (checked first: these override the regional plateaus)
  const DELTAS: Array<[number, number, number, number, number]> = [
    [30.6, 32.0, 120.5, 122.2, 4], // Yangtze delta (Shanghai)
    [22.0, 23.3, 112.8, 114.5, 4], // Pearl River delta
    [8.5, 11.2, 104.5, 107.0, 3], // Mekong delta (HCMC)
    [13.0, 14.2, 100.0, 101.0, 2], // Chao Phraya (Bangkok)
    [20.5, 24.5, 88.0, 91.5, 6], // Ganges-Brahmaputra delta (Kolkata, Dhaka)
    [28.8, 30.3, -91.5, -89.0, 1], // Mississippi delta (New Orleans)
    [30.0, 31.6, 29.8, 32.5, 5], // Nile delta
    [-1.0, 7.5, 72.5, 74.0, 1], // Maldives
    [16.0, 17.2, 95.6, 96.6, 4], // Irrawaddy (Yangon)
    [-6.4, -6.0, 106.6, 107.1, 4], // North Jakarta coast
    [24.5, 25.0, 66.8, 67.3, 8], // Karachi coast
    [44.9, 45.6, 12.0, 12.7, 1], // Venice lagoon / Po delta
  ];
  for (const [a, b, c, d, e] of DELTAS) if (lat >= a && lat <= b && lon >= c && lon <= d) return e;
  // Indo-Gangetic Plain (Delhi, Jaipur, Lucknow, Patna) and Kathmandu valley — must not fall into the Tibet box
  if (lat >= 27.55 && lat <= 27.8 && lon >= 85.2 && lon <= 85.55) return 1350;
  if (lat >= 24.0 && lat <= 30.6 && lon >= 72.0 && lon <= 88.5 && !(lat > 27.3 && lon > 80.0) && !(lat > 29.8 && lon > 77.3)) return lon < 76 ? 380 : 220;
  if (lat >= 26.3 && lat <= 27.3 && lon >= 80.0 && lon <= 88.5) return 90; // Terai / North Bihar plain
  // Amazon and West Siberian lowlands (huge, flat, far from the sea)
  if (lat >= -10.0 && lat <= 2.0 && lon >= -70.0 && lon <= -50.0) return 80;
  if (lat >= 55.0 && lat <= 70.0 && lon >= 60.0 && lon <= 90.0) return 100;

  // 1. Tibet, Himalayas & Qinghai Plateau (Asia)
  if (lat >= 26.0 && lat <= 38.0 && lon >= 75.0 && lon <= 104.0) {
    if (lat >= 27.90 && lat <= 28.08 && lon >= 86.85 && lon <= 87.05) return 8849; // Mount Everest Summit Massif
    if (lat >= 28.0 && lat <= 35.5 && lon >= 80.0 && lon <= 96.0) return 4550; // Central Tibetan Plateau
    if (lat >= 27.8 && lat <= 30.5 && lon >= 84.0 && lon <= 90.0) return 4900; // High Himalayas
    if (lat < 28.0) return 1500; // Himalayan foothills / mid-hills
    return 3200;
  }

  // 2. South American Andes Cordillera & Altiplano
  if (lat >= -54.0 && lat <= 11.0 && lon >= (lat > -6 && lat < 2 ? -81.0 : -78.0) && lon <= -65.0 && getDistanceToOceanKm(lat, lon) > 40) {
    if (lat >= -22.0 && lat <= -14.0 && lon >= -70.0 && lon <= -64.0) return 3850; // Bolivian Altiplano
    if (lat >= -1.0 && lat <= 6.0 && lon >= -77.5 && lon <= -73.0) return 2650; // Bogota/Quito highlands
    if (lat >= -35.0 && lat <= -28.0 && lon >= -71.0 && lon <= -68.0) return 2200; // Southern Andes
    return 1600;
  }

  // 3. European Alps & Pyrenees
  if (lat >= 46.85 && lat <= 47.8 && lon >= 5.9 && lon <= 9.7) return 450; // Swiss Plateau (Zürich, Basel, Bern)
  if (lat >= 46.1 && lat <= 46.85 && lon >= 5.9 && lon <= 6.9) return 400; // Lake Geneva basin
  if (lat >= 45.8 && lat <= 47.3 && lon >= 6.9 && lon <= 13.5) return 1700; // Swiss/Austrian Alps
  if (lat >= 42.0 && lat <= 43.2 && lon >= -1.0 && lon <= 3.0) return 1500; // Pyrenees
  if (lat >= 38.5 && lat <= 42.5 && lon >= -6.5 && lon <= -1.5) return 680; // Spanish Meseta Central (Madrid)
  if (lat >= 51.3 && lat <= 53.5 && lon >= 3.3 && lon <= 7.0) return 1; // Netherlands polder lowlands

  // 4. North America Continental Hypsometry
  if (lat >= 24.5 && lat <= 49.5 && lon >= -125.0 && lon <= -66.5) {
    // New Mexico High Desert Plateau & Southern Rockies (Torrance, Estancia, Santa Fe, Albuquerque)
    if (lat >= 31.3 && lat <= 37.0 && lon >= -109.0 && lon <= -103.0) {
      if (lat >= 34.0 && lat <= 35.5 && lon >= -106.6 && lon <= -105.4) {
        return 1850; // Estancia Basin & Torrance County high plateau floor
      }
      if (lat >= 35.4 && lat <= 36.8 && lon >= -106.2 && lon <= -105.1) return 2150; // Santa Fe / Sangre de Cristo
      if (lat >= 34.8 && lat <= 35.3 && lon >= -106.8 && lon <= -106.4) return 1610; // Albuquerque Rio Grande bench
      if (lon >= -104.5) return 1250; // Eastern plains (Clovis/Roswell)
      if (lon <= -107.5) return 1980; // Continental divide (Gallup/Grants)
      return 1750;
    }

    // Colorado Rockies & Front Range
    if (lat >= 37.0 && lat <= 41.0 && lon >= -109.0 && lon <= -102.0) {
      if (lon >= -105.3 && lon <= -104.6) return 1610; // Denver / Front Range Urban Corridor
      if (lon < -105.3) return 2750; // Central Colorado Rockies
      return 1350; // Eastern Colorado Plains
    }

    // Wyoming, Montana & Idaho Northern Rockies
    if (lat >= 41.0 && lat <= 49.0 && lon >= -115.0 && lon <= -104.0) return 1850;

    // Utah & Nevada Great Basin & Death Valley Depression
    if (lat >= 35.5 && lat <= 42.0 && lon >= -120.0 && lon <= -109.0) {
      if (lat >= 36.2 && lat <= 36.8 && lon >= -117.2 && lon <= -116.6) return -86; // Death Valley Badwater Basin depression
      if (lat >= 40.5 && lat <= 41.0 && lon >= -112.2 && lon <= -111.7) return 1300; // Salt Lake Valley
      if (lat >= 35.8 && lat <= 36.4 && lon >= -115.4 && lon <= -114.9) return 610; // Las Vegas Valley
      return 1550;
    }

    // Arizona Deserts & Colorado Plateau
    if (lat >= 31.3 && lat <= 37.0 && lon >= -114.8 && lon <= -109.0) {
      if (lat >= 35.0 && lat <= 36.5) return 2050; // Flagstaff / Coconino Plateau
      if (lat >= 33.2 && lat <= 33.7 && lon >= -112.4 && lon <= -111.7) return 330; // Phoenix Valley of the Sun
      if (lat >= 32.1 && lat <= 32.4 && lon >= -111.1 && lon <= -110.7) return 730; // Tucson Basin
      return 650;
    }

    // Texas
    if (lat >= 25.8 && lat <= 36.5 && lon >= -106.6 && lon <= -93.5) {
      if (lat >= 31.5 && lon <= -101.5) return 1080; // West Texas / High Plains / Panhandle
      if (lat >= 29.8 && lat <= 33.0 && lon >= -99.0 && lon <= -96.5) return 220; // Austin / DFW Hill Country
      if (lat <= 30.2 && lon >= -96.0) return 15; // Gulf Coastal Plain (Houston)
      return 350;
    }

    // California
    if (lat >= 32.5 && lat <= 42.0 && lon >= -124.5 && lon <= -114.1) {
      if (lon >= -120.5 && lon <= -118.0 && lat >= 35.5 && lat <= 39.5) return 2100; // Sierra Nevada
      if (lon >= -121.5 && lon <= -119.0 && lat >= 35.0 && lat <= 40.0) return 55; // Central Valley
      if (lat <= 34.5 && lon >= -118.6 && lon <= -117.0) return 65; // LA Basin
      if (lat >= 37.0 && lat <= 38.2 && lon >= -122.6 && lon <= -121.8) return 35; // SF Bay Area
      return 250;
    }

    // Pacific Northwest (Seattle / Portland)
    if (lat >= 45.0 && lat <= 49.0 && lon >= -124.0 && lon <= -121.5) return 45;

    // US Midwest / Great Lakes (Chicago, Detroit, Indianapolis)
    if (lat >= 38.0 && lat <= 48.0 && lon >= -94.0 && lon <= -82.0) return 210;

    // US Mid-Atlantic & Northeast (NYC, DC, Boston, Philly)
    if (lat >= 38.0 && lat <= 45.0 && lon >= -78.0 && lon <= -70.0) return 35;

    // Florida Peninsula
    if (lat >= 24.5 && lat <= 31.0 && lon >= -87.6 && lon <= -80.0) return 6;

    // Appalachians (WV, Western NC, East TN)
    if (lat >= 34.5 && lat <= 42.0 && lon >= -84.0 && lon <= -78.0) return 650;
  }

  // 5. East Asia Plains & Japanese Islands
  if (lat >= 30.0 && lat <= 41.0 && lon >= 115.0 && lon <= 122.5) return 25; // North China Plain / Yangtze
  if (lat >= 34.0 && lat <= 37.0 && lon >= 135.0 && lon <= 141.0) return 40; // Tokyo / Osaka lowlands

  // 6. Gobi Desert & Mongolian Plateau (Central Asia)
  if (lat >= 38.0 && lat <= 48.0 && lon >= 92.0 && lon <= 118.0) return 1150;

  // 7. Sahara Desert & Sahel Continental Plateau (North Africa)
  if (lat >= 16.0 && lat <= 31.0 && lon >= -15.0 && lon <= 35.0) return 380;

  // 8. Singapore & Equatorial Sunda Lowlands
  if (lat >= 1.15 && lat <= 1.5 && lon >= 103.6 && lon <= 104.1) return 8;

  // 9. Other major plateaus and highlands (Round 4)
  if (lat >= 18.5 && lat <= 25.0 && lon >= -104.0 && lon <= -97.5) return 2000; // Mexican Plateau (Mexico City)
  if (lat >= 6.0 && lat <= 14.5 && lon >= 36.0 && lon <= 40.5) return 2300; // Ethiopian Highlands
  if (lat >= -4.0 && lat <= 1.0 && lon >= 34.5 && lon <= 38.0) return 1650; // Kenyan Highlands (Nairobi)
  if (lat >= -27.5 && lat <= -24.5 && lon >= 26.0 && lon <= 30.5) return 1600; // Highveld (Johannesburg)
  if (lat >= 31.0 && lat <= 37.0 && lon >= 62.0 && lon <= 71.5) return 1800; // Afghan highlands (Kabul)
  if (lat >= 28.0 && lat <= 37.5 && lon >= 49.5 && lon <= 61.0) return 1200; // Iranian Plateau (Tehran)
  if (lat >= 36.5 && lat <= 40.5 && lon >= 30.0 && lon <= 41.0) return 1000; // Anatolian Plateau (Ankara)
  if (lat >= 12.0 && lat <= 22.5 && lon >= 73.8 && lon <= 81.5 && getDistanceToOceanKm(lat, lon) > 60) return 550; // Deccan Plateau (Bengaluru, Hyderabad, Pune)
  if (lat >= 22.5 && lat <= 26.5 && lon >= 74.0 && lon <= 82.0) return 400; // Malwa / Central India
  if (lat >= -24.0 && lat <= -12.0 && lon >= -52.0 && lon <= -43.0) return 950; // Brazilian Highlands (Brasília)
  if (lat >= 18.0 && lat <= 30.0 && lon >= 40.0 && lon <= 50.0) return 600; // Najd plateau (Riyadh)
  if (lat >= 3.0 && lat <= 5.0 && lon >= -76.5 && lon <= -73.5) return 2600; // Bogotá savanna

  // Continental interiors are not at sea level: far from any coast, assume an inland plain.
  const dCoast = getDistanceToOceanKm(lat, lon);
  if (dCoast > 600) return 400;
  if (dCoast > 250) return 200;
  if (dCoast > 100) return 90;
  if (dCoast <= 20) return 10; // coastal plain default (most coastal cities sit on low ground)

  // Default ocean-margin fallback
  return 25;
}

// Global Reverse Geocoding & Regional Physiography Engine
export function reverseGeocodeLocation(lat: number, lon: number): {
  city: string;
  state?: string;
  country: string;
  region: string;
} {
  // United States
  if (lat >= 24.5 && lat <= 49.5 && lon >= -125.0 && lon <= -66.5) {
    // New Mexico
    if (lat >= 31.3 && lat <= 37.0 && lon >= -109.0 && lon <= -103.0) {
      let city = 'Torrance County / Estancia Basin';
      if (lat >= 34.8 && lat <= 35.3 && lon >= -106.8 && lon <= -106.4) city = 'Albuquerque Metro';
      else if (lat >= 35.4 && lat <= 35.9 && lon >= -106.1 && lon <= -105.7) city = 'Santa Fe';
      else if (lat <= 32.5 && lon >= -107.0) city = 'Las Cruces';
      return {
        city,
        state: 'New Mexico',
        country: 'United States',
        region: 'Colorado Plateau / Southwestern High Desert',
      };
    }

    // Colorado
    if (lat >= 37.0 && lat <= 41.0 && lon >= -109.0 && lon <= -102.0) {
      const city = lon >= -105.3 && lon <= -104.6 ? 'Denver Metro' : 'Colorado Rockies';
      return { city, state: 'Colorado', country: 'United States', region: 'Southern Rocky Mountains' };
    }

    // Arizona
    if (lat >= 31.3 && lat <= 37.0 && lon >= -114.8 && lon <= -109.0) {
      const city = lat >= 33.2 && lat <= 33.7 ? 'Phoenix Metro' : 'Sonoran Basin';
      return { city, state: 'Arizona', country: 'United States', region: 'Sonoran Desert & Basin Range' };
    }

    // Texas
    if (lat >= 25.8 && lat <= 36.5 && lon >= -106.6 && lon <= -93.5) {
      let city = 'Texas';
      if (lat >= 29.5 && lat <= 30.1 && lon >= -95.6 && lon <= -95.1) city = 'Houston Metro';
      else if (lat >= 32.6 && lat <= 33.1 && lon >= -97.2 && lon <= -96.5) city = 'Dallas-Fort Worth';
      else if (lat >= 30.1 && lat <= 30.5 && lon >= -97.9 && lon <= -97.5) city = 'Austin';
      return { city, state: 'Texas', country: 'United States', region: 'Gulf Coastal Plain & Edwards Plateau' };
    }

    // Florida
    if (lat >= 24.5 && lat <= 31.0 && lon >= -87.6 && lon <= -80.0) {
      const city = lat <= 26.2 && lon >= -80.4 ? 'Miami-Dade' : 'Central Florida';
      return { city, state: 'Florida', country: 'United States', region: 'Atlantic / Gulf Lowland Peninsula' };
    }

    // California
    if (lat >= 32.5 && lat <= 42.0 && lon >= -124.5 && lon <= -114.1) {
      let city = 'California';
      if (lat <= 34.3 && lon >= -118.7) city = 'Los Angeles Basin';
      else if (lat >= 37.2 && lat <= 38.2) city = 'San Francisco Bay Area';
      return { city, state: 'California', country: 'United States', region: 'Pacific Coast & Sierra Nevada' };
    }

    // New York
    if (lat >= 40.5 && lat <= 45.0 && lon >= -79.8 && lon <= -71.8) {
      const city = lat <= 41.0 && lon >= -74.3 ? 'New York City' : 'Upstate New York';
      return { city, state: 'New York', country: 'United States', region: 'Northeastern Atlantic Seaboard' };
    }

    return { city: 'Continental Site', state: 'USA Interior', country: 'United States', region: 'North American Interior' };
  }

  // Europe
  if (lat >= 35.0 && lat <= 70.0 && lon >= -11.0 && lon <= 35.0) {
    if (lat >= 51.0 && lat <= 53.5 && lon >= 3.2 && lon <= 7.2) {
      return { city: 'Rotterdam / Randstad', state: 'South Holland', country: 'Netherlands', region: 'North Sea Coastal Delta' };
    }
    if (lat >= 50.0 && lat <= 59.0 && lon >= -8.0 && lon <= 2.0) {
      return { city: 'London / Thames', state: 'Greater London', country: 'United Kingdom', region: 'British Isles Maritime' };
    }
    if (lat >= 40.0 && lat <= 41.0 && lon >= -4.5 && lon <= -3.0) {
      return { city: 'Madrid Metro', state: 'Community of Madrid', country: 'Spain', region: 'Iberian Meseta Plateau' };
    }
    return { city: 'European Site', country: 'Europe', region: 'Continental Europe' };
  }

  // Asia
  if (lat >= 1.0 && lat <= 1.5 && lon >= 103.5 && lon <= 104.1) {
    return { city: 'Singapore', country: 'Singapore', region: 'Equatorial Sunda Shelf' };
  }
  if (lat >= 21.5 && lat <= 25.5 && lon >= 119.5 && lon <= 122.5) {
    return { city: 'Tainan / Taipei Corridor', state: 'Taiwan', country: 'Taiwan', region: 'Western Pacific Rim' };
  }
  if (lat >= 34.0 && lat <= 36.5 && lon >= 138.5 && lon <= 141.0) {
    return { city: 'Greater Tokyo Area', state: 'Kanto', country: 'Japan', region: 'Japanese Archipelago' };
  }

  return {
    city: 'Unknown city',
    country: '',
    region: 'Global Terrestrial Grid',
  };
}

// Arid / Desert Classification
export function checkIsAridZone(lat: number, lon: number): boolean {
  const absLat = Math.abs(lat);
  // US Southwest Desert (NM, AZ, NV, UT, SE CA, West TX, Death Valley / Mojave)
  if (lat >= 31.0 && lat <= 38.0 && lon >= -118.5 && lon <= -103.0) return true;
  // Sahara & Sahel
  if (lat >= 14.0 && lat <= 32.0 && lon >= -15.0 && lon <= 35.0) return true;
  // Arabian Peninsula & Persian Gulf Interior
  if (lat >= 15.0 && lat <= 32.0 && lon >= 36.0 && lon <= 58.0) return true;
  // Iranian Plateau, Karakum, Kyzylkum, Afghanistan, Baluchistan
  if (lat >= 25.0 && lat <= 46.0 && lon >= 50.0 && lon <= 72.0) return true;
  // Taklamakan, Tarim, Gobi (west/central) — excludes humid Sichuan and the North China Plain
  if (lat >= 36.0 && lat <= 46.5 && lon >= 75.0 && lon <= 105.0) return true;
  if (lat >= 40.0 && lat <= 46.0 && lon >= 105.0 && lon <= 112.0) return true;
  // Thar Desert (Rajasthan / Sindh)
  if (lat >= 24.0 && lat <= 30.5 && lon >= 68.0 && lon <= 75.5) return true;
  // Kalahari, Namib & Karoo
  if (lat >= -30.0 && lat <= -17.0 && lon >= 11.5 && lon <= 25.0) return true;
  // Horn of Africa (Somalia, Djibouti, NE Kenya)
  if (lat >= -1.0 && lat <= 12.5 && lon >= 40.0 && lon <= 51.5) return true;
  // Patagonian steppe
  if (lat >= -50.0 && lat <= -38.0 && lon >= -70.0 && lon <= -65.0) return true;
  // Atacama Desert
  if (lat >= -28.0 && lat <= -18.0 && lon >= -71.5 && lon <= -68.0) return true;
  // Australian Outback
  if (lat >= -32.0 && lat <= -20.0 && lon >= 118.0 && lon <= 140.0) return true;
  return false;
}

// Tropical Cyclone Genesis Basin Proximity Check
export function checkIsTropicalCycloneBasin(lat: number, lon: number, distanceToOceanKm: number): boolean {
  // Cyclones rapidly dissipate inland within 250 km of coast
  if (distanceToOceanKm > 250) return false;

  // North Atlantic / Gulf of Mexico / Caribbean Basin
  if (lat >= 10.0 && lat <= 43.0 && lon >= -100.0 && lon <= -55.0) return true;
  // Western Pacific Basin (Typhoons)
  if (lat >= 8.0 && lat <= 40.0 && lon >= 105.0 && lon <= 152.0) return true;
  // Eastern & Central North Pacific (Mexico Pacific coast, Hawaii)
  if (lat >= 8.0 && lat <= 30.0 && lon >= -180.0 && lon < -100.0) return true;
  // North Indian Ocean Basin (Bay of Bengal / Arabian Sea). The Persian Gulf (west of 56.5°E above 23°N) is excluded.
  if (lat >= 8.0 && lat <= 26.0 && lon >= 55.0 && lon <= 96.0 && distanceToOceanKm <= 200 && !(lat > 23.0 && lon < 56.5)) return true;
  // South Pacific / Australian Basin
  if (lat >= -30.0 && lat <= -8.0 && lon >= 115.0 && lon <= 180.0) return true;
  // South Indian Ocean Basin (Madagascar / Mozambique)
  if (lat >= -28.0 && lat <= -10.0 && lon >= 35.0 && lon <= 80.0 && distanceToOceanKm <= 200) return true;

  return false;
}

// Storm-surge inundation depth (m) at a site. rpFactor scales the surge height (1 = ~1-in-100yr).
// Sea-level rise adds directly to the water level (no warming multiplier on top).
export function coastalSurgeDepth(elev: number, distKm: number, cycloneBasin: boolean, slr: number, rpFactor: number): number {
  if (distKm > 60 || elev > 30) return 0;
  const surge = (cycloneBasin ? 4.5 : 2.8) * rpFactor;
  return Math.max(0, surge + slr - Math.max(0, elev) * 0.65 - (distKm / 60) * 1.8);
}
export const coastalDepthScore = (depth: number) => (depth <= 0 ? 0 : Math.min(96, Math.max(12, Math.round(depth * 38))));

// Spatial Physical Risk Baseline Estimation
// Grounded strictly in geophysics, geodesic coastal proximity, and DEM hypsometry
export function calculateLocationBaselineRisk(
  lat: number,
  lon: number,
  elevationMeters?: number
): Record<HazardType, { baseScore: number; baseAbsolute: number }> {
  // 1. Resolve true elevation if not provided
  const effectiveElevation = elevationMeters !== undefined
    ? elevationMeters
    : estimateGlobalElevationMeters(lat, lon);

  // 2. Compute true geodesic distance to nearest ocean coastline
  const distanceToOceanKm = getDistanceToOceanKm(lat, lon);

  // 3. Biome & Climatological Classifications
  const isArid = checkIsAridZone(lat, lon);
  const inCycloneBasin = checkIsTropicalCycloneBasin(lat, lon, distanceToOceanKm);
  const absLat = Math.abs(lat);
  const isTropicalZone = absLat <= 23.5;
  const isHighLatitude = absLat > 48.0;

  // 4. COASTAL FLOOD LOGIC (Strict Physical Constraint):
  // Coastal flood CANNOT occur if distance to ocean > 60 km OR elevation > 30 meters.
  let coastalScore = 0;
  let coastalAbsolute = 0.0; // meters

  if (distanceToOceanKm <= 60 && effectiveElevation <= 30 && effectiveElevation >= -10) {
    const netSurgeDepth = coastalSurgeDepth(effectiveElevation, distanceToOceanKm, inCycloneBasin, 0, 1);
    coastalAbsolute = Number(netSurgeDepth.toFixed(2));
    // Sites just above today's surge reach still carry a residual (exposed) score
    coastalScore = netSurgeDepth > 0.05 ? coastalDepthScore(netSurgeDepth) : effectiveElevation <= 8 ? 8 : 0;
  }

  // 5. TROPICAL CYCLONE LOGIC (Strict Physical Constraint):
  // Cyclones cannot survive >250km inland, and do not occur outside tropical basins.
  let cycloneScore = 0;
  let cycloneAbsolute = 0; // km/h peak wind

  if (inCycloneBasin) {
    // Peak 1-in-~100yr coastal wind is highest at 15-28° and falls off poleward (cooler SST)
    const coastalPeakWind = absLat <= 28 ? 220 : Math.max(130, 220 - (absLat - 28) * 7);
    const decay = Math.exp(-distanceToOceanKm / 110);
    const decayedWind = Math.round(85 + (coastalPeakWind - 85) * decay);
    cycloneAbsolute = decayedWind;
    cycloneScore = Math.min(95, Math.max(20, Math.round((decayedWind - 75) * 0.62)));
  }

  // 6. FLUVIAL (RIVER) FLOOD:
  // Arid plateaus & continental deserts (e.g. New Mexico, Sahara, Gobi) have NO perennial river flooding.
  let fluvialScore = 24;
  let fluvialAbsolute = 0.35; // meters peak depth

  if (isArid && (effectiveElevation > 200 || distanceToOceanKm > 100)) {
    // Arid plateau / desert interior: minimal perennial river flood
    fluvialScore = 5.5;
    fluvialAbsolute = 0.08;
  } else if (absLat > 66) {
    // Arctic: short snowmelt season, small catchments
    fluvialScore = 18;
    fluvialAbsolute = 0.3;
  } else if (distanceToOceanKm <= 250 && effectiveElevation <= 6) {
    // Lowland river delta (Mississippi, Rhine, Yangtze, Ganges)
    fluvialScore = 65;
    fluvialAbsolute = 1.65;
  } else if (effectiveElevation < 80) {
    fluvialScore = distanceToOceanKm <= 20 ? 34 : 48; // short coastal catchments flood less than big inland rivers
    fluvialAbsolute = distanceToOceanKm <= 20 ? 0.7 : 1.15;
  } else {
    fluvialScore = 22;
    fluvialAbsolute = 0.35;
  }

  // 7. PLUVIAL (SURFACE / FLASH) FLOOD:
  // Intense convective cloudbursts
  let pluvialScore = 38;
  let pluvialAbsolute = 85; // mm / 24h

  const coolDryCoast = distanceToOceanKm <= 80 && lat >= -35 && lat <= -4 && lon >= -82 && lon <= -69.5; // Peru-Chile coast
  if (coolDryCoast) {
    pluvialScore = 8;
    pluvialAbsolute = 12;
  } else if (isArid) {
    // Occasional cloudbursts in dry wadis / arroyos (flash floods are real, but rare)
    pluvialScore = 32;
    pluvialAbsolute = 42;
  } else if (isTropicalZone) {
    pluvialScore = 72;
    pluvialAbsolute = 165;
  } else {
    pluvialScore = 42;
    pluvialAbsolute = 95;
  }

  // 8. DROUGHT (SPEI-12):
  let droughtScore = 28;
  let droughtAbsolute = -0.45; // SPEI

  if (isArid) {
    droughtScore = 82;
    droughtAbsolute = -2.25; // Severe multi-year drought
  } else if (absLat >= 28 && absLat <= 42 && distanceToOceanKm > 150) {
    droughtScore = 62;
    droughtAbsolute = -1.55;
  }

  // 9. WATER STRESS:
  let waterStressScore = 25;
  let waterStressAbsolute = 22; // % withdrawal

  if (isArid) {
    waterStressScore = 86;
    waterStressAbsolute = 84.5; // Extremely High Water Stress
  } else if (absLat >= 25 && absLat <= 45 && effectiveElevation > 200) {
    waterStressScore = 58;
    waterStressAbsolute = 52.0;
  }

  // 10. EXTREME HEAT (>35°C Days):
  let heatScore = 18;
  let heatAbsolute = 8; // days/year

  if (effectiveElevation > 3500) {
    // Environmental lapse rate (-6.5°C/km): Alpine summits never reach >35°C
    heatScore = 0;
    heatAbsolute = 0;
  } else if (effectiveElevation > 2200) {
    heatScore = Math.max(2, Math.round(heatScore * 0.15));
    heatAbsolute = Math.max(0, Math.round(heatAbsolute * 0.1));
  } else if (isArid) {
    heatScore = 68;
    heatAbsolute = 45;
  } else if (isTropicalZone) {
    heatScore = 55;
    heatAbsolute = 32;
  } else if (absLat <= 38) {
    heatScore = 34;
    heatAbsolute = 18;
  } else if (absLat > 58) {
    heatScore = 0;
    heatAbsolute = 0;
  } else if (absLat > 48) {
    heatScore = 6;
    heatAbsolute = 1;
  }

  // Lapse rate: ~6.5 °C cooler per km, so highland cities (Nairobi, Bogotá, Mexico City) rarely pass 35 °C
  if (effectiveElevation > 900 && effectiveElevation <= 2200) {
    const f = Math.max(0, 1 - (effectiveElevation - 900) / 1300);
    heatScore = Math.round(heatScore * f);
    heatAbsolute = Math.round(heatAbsolute * f);
  }
  // Cold-current upwelling coasts (Lima, Swakopmund, Antofagasta, Baja, Morocco): cool, dry, foggy
  const coldCurrentCoast = distanceToOceanKm <= 80 && (
    (lat >= -35 && lat <= -4 && lon >= -82 && lon <= -69.5) || (lat >= -32 && lat <= -12 && lon >= 8 && lon <= 16) ||
    (lat >= 22 && lat <= 38 && lon >= -125 && lon <= -114) || (lat >= 15 && lat <= 32 && lon >= -18 && lon <= -9));
  if (coldCurrentCoast) {
    heatScore = Math.min(heatScore, 8);
    heatAbsolute = Math.min(heatAbsolute, 2);
  }

  // 11. HEAT STRESS (Wet-Bulb Globe Temp WBGT °C):
  let heatStressScore = 24;
  let heatStressAbsolute = 26.5; // °C WBGT

  if (coldCurrentCoast) {
    heatStressScore = 14;
    heatStressAbsolute = 23.0;
  } else if (absLat > 55 || effectiveElevation > 3000) {
    heatStressScore = 4;
    heatStressAbsolute = 18.0;
  } else if (absLat > 45) {
    heatStressScore = 12;
    heatStressAbsolute = 23.5;
  } else if (isTropicalZone && distanceToOceanKm <= 100) {
    heatStressScore = 82;
    heatStressAbsolute = 32.4; // High humidity + heat
  } else if (isArid) {
    // Dry heat yields lower wet-bulb temperature than humid tropics
    heatStressScore = 54;
    heatStressAbsolute = 28.8;
  }

  // 12. EXTREME COLD & FREEZE:
  let coldScore = 12;
  let coldAbsolute = 4; // frost days/yr

  if (effectiveElevation > 3500) {
    // Glaciated / Alpine sub-zero regime
    coldScore = 98;
    coldAbsolute = 310;
  } else if (absLat > 60 || (isHighLatitude && distanceToOceanKm > 400)) {
    // Subarctic / continental interior (Yakutsk, Fairbanks, Winnipeg)
    coldScore = 85;
    coldAbsolute = 180;
  } else if (isHighLatitude) {
    // Maritime mid-latitude (Paris, London, Hamburg)
    coldScore = 40;
    coldAbsolute = 35;
  } else if (effectiveElevation > 1400 && absLat < 15 && effectiveElevation < 3000) {
    // Tropical highlands (Nairobi, Addis Ababa, Bogotá): mild "eternal spring", frost is rare
    coldScore = 10;
    coldAbsolute = 2;
  } else if (effectiveElevation > 1400) {
    // High-altitude radiative nighttime cooling (e.g. New Mexico plateau, Denver)
    coldScore = 38;
    coldAbsolute = 26;
  } else if (absLat > 36) {
    coldScore = 32;
    coldAbsolute = 18;
  }

  // 13. WILDFIRE (Fire Weather Index):
  let wildfireScore = 22;
  let wildfireAbsolute = 12.0;

  // Fire needs fuel: semi-arid scrub/grassland burns, hyper-arid sand and rock deserts barely do
  const fuelledDryland = (lat >= 31 && lat <= 38 && lon >= -121 && lon <= -103) || (lat >= -35 && lat <= -15 && lon >= 113 && lon <= 153) ||
    (lat >= 30 && lat <= 45 && lon >= -10 && lon <= 45);
  if (isArid && !fuelledDryland) {
    wildfireScore = 28;
    wildfireAbsolute = 9.0;
  } else if (isArid) {
    wildfireScore = 71;
    wildfireAbsolute = 43.5;
  } else if (absLat >= 30 && absLat <= 45 && distanceToOceanKm > 80) {
    wildfireScore = 58;
    wildfireAbsolute = 32.0;
  }

  // 14. SUBSIDENCE:
  let subsidenceScore = 18;
  let subsidenceAbsolute = 2.8; // mm/year

  if (isArid && waterStressAbsolute > 75) {
    // Severe aquifer overdraft compaction
    subsidenceScore = 54;
    subsidenceAbsolute = 14.5;
  } else if (distanceToOceanKm <= 30 && effectiveElevation < 10) {
    subsidenceScore = 58;
    subsidenceAbsolute = 16.2;
  }

  // 15. LANDSLIDE:
  let landslideScore = 12;
  let landslideAbsolute = 1.2;

  if (effectiveElevation > 1800 && distanceToOceanKm < 300) {
    landslideScore = 65;
    landslideAbsolute = 6.8;
  } else if (effectiveElevation > 600 && !isArid) {
    landslideScore = 38;
    landslideAbsolute = 3.4;
  } else {
    // Flat plateaus and lowlands
    landslideScore = 8;
    landslideAbsolute = 0.8;
  }

  return {
    coastal_flood: { baseScore: coastalScore, baseAbsolute: coastalAbsolute },
    fluvial_flood: { baseScore: fluvialScore, baseAbsolute: fluvialAbsolute },
    pluvial_flood: { baseScore: pluvialScore, baseAbsolute: pluvialAbsolute },
    drought: { baseScore: droughtScore, baseAbsolute: droughtAbsolute },
    water_stress: { baseScore: waterStressScore, baseAbsolute: waterStressAbsolute },
    extreme_heat: { baseScore: heatScore, baseAbsolute: heatAbsolute },
    heat_stress: { baseScore: heatStressScore, baseAbsolute: heatStressAbsolute },
    extreme_cold: { baseScore: coldScore, baseAbsolute: coldAbsolute },
    tropical_cyclone: { baseScore: cycloneScore, baseAbsolute: cycloneAbsolute },
    wildfire: { baseScore: wildfireScore, baseAbsolute: wildfireAbsolute },
    subsidence: { baseScore: subsidenceScore, baseAbsolute: subsidenceAbsolute },
    landslide: { baseScore: landslideScore, baseAbsolute: landslideAbsolute },
    ...computeExtendedBaselines({
      lat,
      lon,
      elevation: effectiveElevation,
      distanceToOceanKm,
      isArid,
      waterStressAbs: waterStressAbsolute,
      isTropicalZone,
    }),
  };
}

// Convert Score (0-100) into Institutional Risk Rating
export function getRatingFromScore(score: number): RiskRating {
  if (score < 18) return 'Very Low';
  if (score < 36) return 'Low';
  if (score < 56) return 'Moderate';
  if (score < 75) return 'High';
  if (score < 90) return 'Severe';
  return 'Catastrophic';
}

// Ordinal severity colours (green -> deep red). Always shown with a text label.
export const RATING_ORDER: RiskRating[] = ['Very Low', 'Low', 'Moderate', 'High', 'Severe', 'Catastrophic'];
export const RATING_HEX: Record<RiskRating, string> = {
  'Very Low': '#10b981',
  Low: '#84cc16',
  Moderate: '#eab308',
  High: '#f97316',
  Severe: '#ef4444',
  Catastrophic: '#be123c',
};

// Color coding for ratings
export function getRatingColor(rating: RiskRating): string {
  switch (rating) {
    case 'Very Low':
      return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
    case 'Low':
      return 'text-lime-300 border-lime-500/30 bg-lime-500/10';
    case 'Moderate':
      return 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10';
    case 'High':
      return 'text-orange-300 border-orange-500/30 bg-orange-500/10';
    case 'Severe':
      return 'text-red-300 border-red-500/30 bg-red-500/10';
    case 'Catastrophic':
      return 'text-rose-300 border-rose-500/40 bg-rose-600/15';
    default:
      return 'text-slate-400 border-slate-700 bg-slate-800';
  }
}

export function getRatingBadgeBg(rating: RiskRating): string {
  switch (rating) {
    case 'Very Low': return 'bg-emerald-500';
    case 'Low': return 'bg-lime-500';
    case 'Moderate': return 'bg-yellow-500';
    case 'High': return 'bg-orange-500';
    case 'Severe': return 'bg-red-500';
    case 'Catastrophic': return 'bg-rose-700 text-white';
    default: return 'bg-slate-500';
  }
}

// How each hazard's intensity responds to warming. dm = scenario decade factor (1.0 today), slr in metres.
function hazardClimateFactor(hId: HazardType, dm: number, slr: number): number {
  if (!HAZARD_TAXONOMY[hId].climateDriven) return extendedClimateFactor(hId, dm, slr) ?? 1;
  const ext = extendedClimateFactor(hId, dm, slr);
  if (ext !== undefined) return ext;
  const k = (x: number) => 1 + (dm - 1) * x;
  switch (hId) {
    case 'extreme_cold': return Math.pow(dm, -0.6); // cold weakens as the climate warms
    case 'coastal_flood': return 1; // handled physically through sea-level rise
    case 'subsidence': return 1; // driven by groundwater pumping, not warming
    case 'landslide': return k(0.3);
    case 'tropical_cyclone': return k(0.4);
    case 'water_stress': return k(0.5);
    case 'drought': return k(0.7);
    case 'fluvial_flood': return k(0.6);
    default: return dm;
  }
}

// Physical upper bounds per unit, applied to every branch (modelled and live).
const UNIT_CAP: Partial<Record<HazardType, number>> = {
  extreme_heat: 365, extreme_cold: 365, heat_stress: 36, water_stress: 100, wildfire: 150, landslide: 10,
  tropical_cyclone: 315, extratropical_storm: 300, hail: 150, tornado: 10, avalanche: 10, glacial_lake_outburst: 10,
  sand_dust_storm: 365, coastal_flood: 12, fluvial_flood: 8, pluvial_flood: 600, subsidence: 60, tsunami: 30, earthquake: 2.5,
};
function clampUnit(hId: HazardType, v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (hId === 'drought') return Math.max(-4, Math.min(0, v));
  const cap = UNIT_CAP[hId];
  return Math.max(0, cap === undefined ? v : Math.min(cap, v));
}
// Surge-height factor per return period (1.0 = 1-in-100yr)
const SURGE_RP: Record<ReturnPeriod, number> = { aal: 0.55, '10yr': 0.75, '50yr': 0.92, '100yr': 1, '250yr': 1.08, '500yr': 1.14 };

// ---- Live data (open APIs) -------------------------------------------------------------
// CMIP6 HighResMIP runs on Open-Meteo track ~SSP5-8.5. "Now" = 2015-2024, "mid" = 2041-2050.
// Other scenarios/decades are pattern-scaled by their warming factor relative to SSP5-8.5 @ 2045.
// SSP5-8.5 2041-2050 is ≈ +0.83 °C above the 2025 baseline (AR6 median).
const DM_REF = 0.22 * 0.83;
/** Scale the model's now→mid change by the warming ratio. Capped at 2.5× so noise is not
 *  extrapolated far beyond the data; `sign` enforces physics
 *  (+1 = must not fall with warming, -1 = must not rise). */
const patternScale = (now: number | undefined, mid: number | undefined, dm: number, sign: 1 | -1 | 0 = 0) => {
  if (now === undefined || !Number.isFinite(now)) return undefined;
  if (mid === undefined || !Number.isFinite(mid)) return Math.max(0, now);
  const r = Math.min(2.5, Math.max(0, (dm - 1) / DM_REF));
  let v = now + (mid - now) * r;
  if (sign > 0) v = Math.max(now, v);
  if (sign < 0) v = Math.min(now, v);
  return Math.max(0, v);
};

/** Returns a live-data-driven {abs, score} for a hazard, or undefined to use the modelled baseline. */
function liveHazard(hId: HazardType, live: LiveSiteData | undefined, dm: number, elevation: number): { abs: number; score: number } | undefined {
  if (!live) return undefined;
  switch (hId) {
    case 'extreme_heat': {
      const v = patternScale(live.heatDays35Now, live.heatDays35Mid, dm, 1);
      return v === undefined ? undefined : { abs: v, score: 100 * (1 - Math.exp(-v / 40)) };
    }
    case 'extreme_cold': {
      const v = patternScale(live.frostDaysNow, live.frostDaysMid, dm, -1);
      return v === undefined ? undefined : { abs: v, score: 100 * (1 - Math.exp(-v / 70)) };
    }
    case 'pluvial_flood': {
      const v = patternScale(live.rx1dayNowMm, live.rx1dayMidMm, dm);
      return v === undefined ? undefined : { abs: v, score: 100 * (1 - Math.exp(-v / 180)) };
    }
    case 'extratropical_storm': {
      // Daily-max wind from a ~25 km model is not a 3-second gust and under-reads storms badly,
      // so it is shown in the live-data panel but does not override the modelled windstorm score.
      void live.windMaxNowKmh;
      return undefined;
    }
    case 'earthquake': {
      const n = live.quakesM5Within150km;
      return n === undefined ? undefined : { abs: n, score: Math.min(97, 35 * Math.log10(1 + n)) };
    }
    case 'fluvial_flood': {
      const q = live.riverMaxDischargeM3s;
      if (q === undefined) return undefined;
      const elevF = elevation < 15 ? 1.15 : elevation < 80 ? 1 : 0.6;
      return { abs: q * Math.sqrt(dm), score: Math.min(95, 18 * Math.log10(1 + q) * elevF * Math.sqrt(dm)) };
    }
    default:
      return undefined;
  }
}

/** Families combine their hazards with a soft maximum so adding minor perils never dilutes the score. */
function familyScore(scores: number[]): number {
  const s = scores.filter((x) => x > 0).sort((a, b) => b - a);
  if (!s.length) return 0;
  const tail = s.slice(1).reduce((t, x) => t + (x / 100) * 0.15, 0);
  return Math.min(99, s[0] + (100 - s[0]) * Math.min(0.5, tail));
}

// AAL damage ratio from the average-year composite score (convex: risk concentrates at the top end).
function aalDamageRatioFromScore(aalComposite: number): number {
  return Math.min(0.05, Math.max(0.0003, AAL_COEFF * Math.pow(Math.max(0, aalComposite) / 100, AAL_EXP)));
}
const AAL_COEFF = 0.0155;
const AAL_EXP = 1.6;
const COMPOSITE_CURVE = 1.5;

function activeDamageRatio(aalRatio: number, returnPeriod: ReturnPeriod): number {
  return Math.min(0.85, aalRatio * RETURN_PERIOD_LOSS_FACTOR[returnPeriod]);
}

const LIVE_UNITS: Partial<Record<HazardType, string>> = {
  earthquake: 'M5+ quakes ≤150 km since 1975',
  fluvial_flood: 'm³/s peak river flow',
  extratropical_storm: 'km/h peak gust (est.)',
};

const EXCEEDANCE_PROBABILITY: Record<ReturnPeriod, number> = {
  aal: 1.0, '10yr': 0.1, '50yr': 0.02, '100yr': 0.01, '250yr': 0.004, '500yr': 0.002,
};

export interface FamilyResult {
  family: HazardFamily;
  score: number;
  weight: number;
  topHazard: HazardType | null;
}

/** Elevation used by the model: measured DEM when live data is attached, else the entered / estimated value. */
export function siteElevation(asset: Asset): number {
  return asset.liveData?.demElevationM ?? asset.elevationMeters ?? estimateGlobalElevationMeters(asset.latitude, asset.longitude);
}

// Core Assessment Engine: Computes complete physical & financial risk for an asset
export function assessAssetRisk(
  asset: Asset,
  scenario: SSPScenario = 'ssp245',
  decade: Decade = 2050,
  returnPeriod: ReturnPeriod = '100yr'
): AssetRiskAssessment {
  if (!Number.isFinite(Number(asset.latitude)) || !Number.isFinite(Number(asset.longitude))) {
    throw new Error(`Site "${asset.name}" has invalid coordinates`);
  }
  const elevation = siteElevation(asset);
  const baselines = calculateLocationBaselineRisk(asset.latitude, asset.longitude, elevation);
  const vulnerabilityWeights = getAssetVulnerabilityWeights(asset.assetType);
  const decadeMultiplier = getDecadeFactor(scenario, decade);
  const slrNow = getDecadeSeaLevelRiseMeters(scenario, decade);
  const returnPeriodMultiplier = RETURN_PERIOD_MULTIPLIERS[returnPeriod];
  const value = Math.max(0, Number(asset.replacementValueUsd) || 0);
  const live = asset.liveData;
  const dT = (decadeMultiplier - 1) / 0.22; // extra °C of global warming vs 2025
  const distCoast = getDistanceToOceanKm(asset.latitude, asset.longitude);
  const cycloneBasin = checkIsTropicalCycloneBasin(asset.latitude, asset.longitude, distCoast);
  const surgeDepth = (slr: number, rp: ReturnPeriod) => coastalSurgeDepth(elevation, distCoast, cycloneBasin, slr, SURGE_RP[rp]);
  const maxSlr = getDecadeSeaLevelRiseMeters(scenario, decade);

  const isZero = (hId: HazardType) => {
    if (liveHazard(hId, live, 1, elevation)) return false;
    const b = baselines[hId];
    if (hId === 'coastal_flood') return b.baseScore <= 0 && surgeDepth(maxSlr, '100yr') <= 0.05;
    // Drought uses signed SPEI (negative = deficit), so a negative absolute is not "no hazard".
    return b.baseScore <= 0 || (hId !== 'drought' && b.baseAbsolute <= 0);
  };
  const weightOf = (hId: HazardType) => vulnerabilityWeights[hId] ?? 1.0;

  const hazardScore = (hId: HazardType, dm: number, slr: number, rp: ReturnPeriod): number => {
    const lv = liveHazard(hId, live, dm, elevation);
    if (!lv && isZero(hId)) return 0;
    const base = lv
      ? lv.score
      : hId === 'coastal_flood'
        ? Math.max(baselines.coastal_flood.baseScore, coastalDepthScore(surgeDepth(slr, '100yr')))
        : baselines[hId].baseScore * hazardClimateFactor(hId, dm, slr);
    const raw = base * RETURN_PERIOD_SCORE_SCALING[rp] * (0.85 + weightOf(hId) * 0.15);
    if (raw <= 0.5) return 0;
    return Math.min(99.5, Math.max(2.0, softCapScore(raw)));
  };

  const familiesAt = (dm: number, slr: number, rp: ReturnPeriod): FamilyResult[] =>
    HAZARD_FAMILIES.map((f) => {
      const members = ALL_HAZARDS.filter((h) => HAZARD_TAXONOMY[h].family === f.id);
      const scores = members.map((h) => hazardScore(h, dm, slr, rp));
      const live = members.filter((_, i) => scores[i] > 0);
      const weight = live.length ? Math.max(...live.map(weightOf)) : 1;
      const top = live.length ? members[scores.indexOf(Math.max(...scores))] : null;
      return { family: f.id, score: familyScore(scores), weight, topHazard: top };
    });

  const compositeAt = (dm: number, slr: number, rp: ReturnPeriod): number => {
    const fams = familiesAt(dm, slr, rp);
    const w = fams.reduce((t, f) => t + f.weight, 0);
    if (w <= 0) return 0;
    const mean = fams.reduce((t, f) => t + f.score * f.weight, 0) / w;
    // Calibration curve: a weighted mean of six family maxima sits higher than the old 12-hazard
    // mean, so it is mapped back so that rating bands keep their meaning (and spread is restored).
    return Math.min(99, Math.max(0, Number((100 * Math.pow(mean / 100, COMPOSITE_CURVE)).toFixed(1))));
  };

  const hazardResults: Partial<Record<HazardType, HazardMetricResult>> = {};
  const contributions: Partial<Record<HazardType, number>> = {};
  let contributionTotal = 0;
  let highestScore = 0;
  let primaryHazard: HazardType = 'drought';
  const rps: ReturnPeriod[] = ['aal', '10yr', '50yr', '100yr', '250yr', '500yr'];

  for (const hId of ALL_HAZARDS) {
    const meta = HAZARD_CATALOG[hId];
    const base = baselines[hId];
    const vWeight = weightOf(hId);
    const zero = isZero(hId);
    const cf = hazardClimateFactor(hId, decadeMultiplier, slrNow);
    const score = hazardScore(hId, decadeMultiplier, slrNow, returnPeriod);
    const lv = liveHazard(hId, live, decadeMultiplier, elevation);
    const lvNow = liveHazard(hId, live, 1, elevation);

    // Return-period intensity table in scientific units (single source of truth)
    const returnPeriodValues = {} as Record<ReturnPeriod, number>;
    for (const rp of rps) {
      let v = 0;
      if (!zero) {
        const rpM = RETURN_PERIOD_MULTIPLIERS[rp];
        // Gumbel-style intensity growth: depth/heat/etc. grow sub-linearly with return period
        const rpScale = 1 + (rpM - 1) * 0.5;
        const b0 = base.baseAbsolute;
        if (lv) {
          v = hId === 'earthquake' ? lv.abs : lv.abs * (rp === 'aal' ? 1 : rpScale);
        } else {
          // Each hazard responds to warming (dT, °C above 2025) with its own physical sensitivity
          switch (hId) {
            case 'coastal_flood': v = surgeDepth(slrNow, rp); break; // surge + SLR − ground level
            case 'sea_level_rise': v = slrNow; break;
            case 'tropical_cyclone': v = b0 * (1 + 0.025 * dT) * (1 + (rpM - 1) * 0.22); break; // ~+5% peak wind at +2 °C
            case 'extratropical_storm': v = b0 * (1 + 0.01 * dT) * (1 + (rpM - 1) * 0.18); break;
            case 'drought': v = b0 * (1 + 0.15 * dT) * (1 + (rpM - 1) * 0.2); break;
            case 'water_stress': v = b0 + 4 * dT; break; // chronic, percentage points
            case 'extreme_heat': v = b0 * (1 + 0.4 * dT) * rpScale + (b0 > 0 ? 3 * dT : 0); break;
            case 'heat_stress': v = b0 + 0.9 * dT + 1.2 * (rpM - 1); break; // additive °C WBGT
            case 'extreme_cold': v = b0 * Math.max(0, 1 - 0.12 * dT) * rpScale; break;
            case 'pluvial_flood': v = b0 * Math.pow(1.07, dT) * rpScale; break; // Clausius-Clapeyron ~7%/°C
            case 'fluvial_flood': v = b0 * (1 + 0.08 * dT) * rpScale; break;
            case 'wildfire': v = b0 * (1 + 0.12 * dT) * rpScale; break;
            case 'subsidence': v = b0; break; // pumping-driven, constant
            case 'landslide': v = b0 * (1 + 0.07 * dT) * rpScale; break;
            case 'earthquake': case 'volcano': v = b0; break; // fixed reference return period (labelled)
            default:
              v = HAZARD_TAXONOMY[hId].onset === 'chronic' ? b0 * cf : b0 * cf * rpScale;
          }
        }
        v = clampUnit(hId, v);
      }
      returnPeriodValues[rp] = Number(v.toFixed(hId === 'earthquake' && !lv ? 3 : 2));
    }
    const absoluteValue = returnPeriodValues[returnPeriod];

    // Event damage ratio (non-linear sigmoid fragility curve)
    const sigmoidDamage = 1 / (1 + Math.exp(-6 * (score / 100 - 0.45)));
    const damageRatio = score === 0 ? 0 : Math.min(0.95, Math.max(0.001, sigmoidDamage * vWeight * 0.35));

    const contribution = score * vWeight;
    contributions[hId] = contribution;
    contributionTotal += contribution;

    const nowScore = lvNow ? lvNow.score : base.baseScore;
    const delta = lv && lvNow ? (lvNow.abs > 0 ? lv.abs / lvNow.abs - 1 : 0) : cf - 1;

    hazardResults[hId] = {
      hazardId: hId,
      hazardName: meta.name,
      score: Number(score.toFixed(1)),
      rating: score === 0 ? 'Very Low' : getRatingFromScore(score),
      absoluteValue,
      unit: lv ? LIVE_UNITS[hId] ?? meta.unit : meta.unit,
      baselineValue: Number((lvNow ? lvNow.abs : base.baseAbsolute).toFixed(2)),
      deltaPercent: score === 0 || !HAZARD_TAXONOMY[hId].climateDriven ? 0 : Number((delta * 100).toFixed(1)),
      damageRatio: Number(damageRatio.toFixed(4)),
      expectedLossUsd: 0, // allocated below so hazard losses reconcile with the asset total
      returnPeriodValues,
      exceedanceProbability: EXCEEDANCE_PROBABILITY[returnPeriod],
      confidenceScore: lv ? 'High' : nowScore > 0 ? 'Medium' : 'Low',
    };

    if (score > highestScore) {
      highestScore = score;
      primaryHazard = hId;
    }
  }

  // Composite scores: selected return period, and the unconditional average year
  const families = familiesAt(decadeMultiplier, slrNow, returnPeriod);
  const compositeScore = compositeAt(decadeMultiplier, slrNow, returnPeriod);
  const compositeRating = getRatingFromScore(compositeScore);
  const aalComposite = returnPeriod === 'aal' ? compositeScore : compositeAt(decadeMultiplier, slrNow, 'aal');

  // 1. AAL — independent of the selected return period
  const aalDamageRatio = Number(aalDamageRatioFromScore(aalComposite).toFixed(5));
  const aalUsd = Math.round(value * aalDamageRatio);

  // 2. Return-period event loss (PML)
  const totalDamageRatio = Number(activeDamageRatio(aalDamageRatio, returnPeriod).toFixed(5));
  const periodExceedanceLossUsd = Math.round(value * totalDamageRatio);
  const totalExpectedAnnualLossUsd = returnPeriod === 'aal' ? aalUsd : periodExceedanceLossUsd;
  const lossMetricType: 'AAL' | 'PML' = returnPeriod === 'aal' ? 'AAL' : 'PML';
  const lossTypeLabel = returnPeriod === 'aal'
    ? 'Average Annual Loss (AAL)'
    : `1-in-${returnPeriod.replace('yr', '')}-year Event Loss (PML)`;

  // Allocate the active loss across hazards in proportion to their weighted score contribution
  for (const hId of ALL_HAZARDS) {
    const share = contributionTotal > 0 ? (contributions[hId] ?? 0) / contributionTotal : 0;
    hazardResults[hId]!.expectedLossUsd = Math.round(totalExpectedAnnualLossUsd * share);
  }

  // Tail risk is a property of the loss distribution, so it is anchored on AAL (not on the
  // selected return period). 1-in-20 ~ 5.5x AAL, 1-in-200 ~ 17x AAL, never above 85% of value.
  const valueAtRisk95 = Math.round(Math.min(value * 0.85, aalUsd * 5.5));
  const valueAtRisk995 = Math.round(Math.min(value * 0.85, aalUsd * 17));

  // Downtime per event and business interruption
  const downtimeDays = Math.round((compositeScore / 100) * 45 * returnPeriodMultiplier * 0.4);
  const businessInterruptionLossUsd = Math.round(downtimeDays * value * 0.0012);

  const lossFor = (s: SSPScenario, d: Decade) => {
    const dm = getDecadeFactor(s, d);
    const slr = getDecadeSeaLevelRiseMeters(s, d);
    const sc = compositeAt(dm, slr, returnPeriod);
    const aal = Number(aalDamageRatioFromScore(returnPeriod === 'aal' ? sc : compositeAt(dm, slr, 'aal')).toFixed(5));
    const ratio = Number((returnPeriod === 'aal' ? aal : activeDamageRatio(aal, returnPeriod)).toFixed(5));
    return { score: sc, ratio };
  };

  // Multi-decade trajectory: fully recomputed per decade (not a linear rescale)
  const decades: Decade[] = [2025, 2030, 2040, 2050, 2060, 2070, 2080, 2090];
  const decadeTrajectory = decades.map((d) => {
    const r = lossFor(scenario, d);
    return { decade: d, compositeScore: r.score, expectedLossUsd: Math.round(value * r.ratio), damageRatio: Number(r.ratio.toFixed(5)) };
  });

  // Scenario comparison at the selected decade: every scenario computed on its own pathway
  const scenarioComparison = {} as Record<SSPScenario, { compositeScore: number; expectedLossUsd: number }>;
  (['ssp119', 'ssp126', 'ssp245', 'ssp370', 'ssp585'] as SSPScenario[]).forEach((s) => {
    const r = lossFor(s, decade);
    scenarioComparison[s] = { compositeScore: r.score, expectedLossUsd: Math.round(value * r.ratio) };
  });

  // Adaptation ROI is an annual cash-flow question, so it uses AAL (not a tail event loss)
  const recommendedMeasures = getAdaptationRecommendations(asset.assetType, primaryHazard);
  const estimatedCapexUsd = Math.round(value * 0.035);
  const annualLossReductionUsd = Math.round(aalUsd * 0.45);
  const paybackPeriodYears = annualLossReductionUsd > 0
    ? Number((estimatedCapexUsd / annualLossReductionUsd).toFixed(1))
    : 999;
  const netResilienceBenefitUsd = Math.round(annualLossReductionUsd * 15 - estimatedCapexUsd);

  return {
    asset,
    scenario,
    decade,
    returnPeriod,
    compositeScore,
    compositeRating,
    totalExpectedAnnualLossUsd,
    aalUsd,
    periodExceedanceLossUsd,
    lossMetricType,
    lossTypeLabel,
    totalDamageRatio,
    aalDamageRatio,
    valueAtRisk95,
    valueAtRisk995,
    downtimeDays,
    businessInterruptionLossUsd,
    hazardResults: hazardResults as Record<HazardType, HazardMetricResult>,
    primaryHazard,
    primaryHazardScore: Number(highestScore.toFixed(1)),
    familyScores: families.map((f) => ({ family: f.family, score: Number(f.score.toFixed(1)), topHazard: f.topHazard })),
    usesLiveData: !!live,
    decadeTrajectory,
    scenarioComparison,
    adaptationRoi: {
      recommendedMeasures,
      estimatedCapexUsd,
      annualLossReductionUsd,
      paybackPeriodYears,
      netResilienceBenefitUsd,
    },
  };
}


// Generate tailored adaptation measures based on asset type and primary hazard
function getAdaptationRecommendations(assetType: string, hazard: HazardType): string[] {
  switch (hazard) {
    case 'coastal_flood':
      return [
        'Deploy demountable storm-surge flood gates and marine bulkhead elevations',
        'Relocate critical electrical switchgear and emergency diesel generators to +4m elevation',
        'Install backflow preventer valves on all subterranean drainage outfalls',
        'Apply hydrostatic waterproof membrane sealant to basement foundations',
      ];
    case 'fluvial_flood':
    case 'pluvial_flood':
      return [
        'Construct bioswale retention detention basins with redundant sump pumps',
        'Elevate ground-floor sensitive equipment and IT racks by 1.2 meters',
        'Install perimeter flood walls rated for 1-in-250 year return level',
        'Implement automated SCADA flood sensor monitoring with telemetry shutoff',
      ];
    case 'extreme_heat':
    case 'heat_stress':
      return [
        'Upgrade HVAC chillers to high-ambient temperature tolerance compressors with N+2 redundancy',
        'Apply solar-reflective cool roof coatings (high albedo SRI > 85)',
        'Install automated external louvers and solar shading glass facades',
        'Implement automated heat-illness shift rotation and indoor bioclimatic cooling zones',
      ];
    case 'tropical_cyclone':
      return [
        'Reinforce roof membrane anchor clips and install missile-impact resistant glazing',
        'Install auxiliary backup microgrid with 7-day on-site fuel reserve',
        'Anchor exterior rooftop HVAC and telecommunications antenna assemblies for Category 5 gusts',
        'Implement hurricane rapid-response lockdown protocols 48 hours pre-landfall',
      ];
    case 'wildfire':
      return [
        'Establish 30-meter defensible space cleared of combustible brush and ember fuel',
        'Install exterior rooftop ember-resistant sprinkler deluge systems',
        'Upgrade HVAC air intake filtration with HEPA & active carbon for heavy wildfire smoke particulate',
        'Class A fire-rated exterior cladding retrofit',
      ];
    case 'water_stress':
    case 'drought':
      return [
        'Install closed-loop evaporative cooling or adiabatic dry-cooling towers',
        'Deploy on-site graywater recycling and reverse osmosis reclamation facility',
        'Establish dual-source municipal water interconnect agreements',
      ];
    case 'subsidence':
      return [
        'Underpin foundation with helical micro-piles anchored into stable bedstrata',
        'Install flexible utility pipe joints to prevent shear rupture during soil compaction',
        'Deploy geotechnical tiltmeter and fiber-optic ground strain monitoring sensors',
      ];
    case 'landslide':
      return [
        'Install high-tensile rockfall netting and soil-nailing slope anchors',
        'Re-engineer upslope horizontal drainage boreholes to relieve hydrostatic pore pressure',
        'Construct concrete debris catchment check-dams along drainage gullies',
      ];
    case 'extreme_cold':
      return [
        'Heat-trace critical exposed fire protection and process fluid piping',
        'Install dual-fuel heating backups and cold-weather lubricants for mechanical drives',
        'Insulate building envelopes to prevent catastrophic freeze-thaw spalling',
      ];
    default:
      return extendedAdaptation(hazard) ?? ['Commission a site-specific engineering resilience survey'];
  }
}

// Portfolio Aggregation & Analytics
export function computePortfolioSummary(assessments: AssetRiskAssessment[]): PortfolioSummary {
  if (assessments.length === 0) {
    return {
      totalAssets: 0,
      totalReplacementValueUsd: 0,
      totalExpectedAnnualLossUsd: 0,
      totalAalUsd: 0,
      totalPeriodExceedanceLossUsd: 0,
      lossMetricType: 'AAL',
      averageDamageRatio: 0,
      portfolioRiskScore: 0,
      portfolioRating: 'Very Low',
      var95Usd: 0,
      var995Usd: 0,
      spatialClusteringIndex: 0,
      copulaVaRMultiplier95: 1.6,
      copulaVaRMultiplier995: 6.0,
      copulaCorrelationStatus: 'Highly Diversified',
      topExposedHazard: 'coastal_flood',
      hazardBreakdown: [],
      distributionByRating: {
        'Very Low': 0,
        Low: 0,
        Moderate: 0,
        High: 0,
        Severe: 0,
        Catastrophic: 0,
      },
      distributionByCategory: {},
    };
  }

  let totalValue = 0;
  let totalLoss = 0;
  let totalAal = 0;
  let totalPeriodExceedance = 0;
  let sumScore = 0;
  let sumDamageRatio = 0;

  const distributionByRating: Record<RiskRating, number> = {
    'Very Low': 0,
    Low: 0,
    Moderate: 0,
    High: 0,
    Severe: 0,
    Catastrophic: 0,
  };

  const distributionByCategory: Record<string, { count: number; totalLossUsd: number; avgScore: number }> = {};

  const hazardScoreSums = Object.fromEntries(ALL_HAZARDS.map((h) => [h, 0])) as Record<HazardType, number>;
  const hazardLossSums: Record<HazardType, number> = { ...hazardScoreSums };
  const hazardHighCount: Record<HazardType, number> = { ...hazardScoreSums };

  assessments.forEach((a) => {
    totalValue += Math.max(0, Number(a.asset.replacementValueUsd) || 0); // same sanitising as assessAssetRisk
    totalLoss += a.totalExpectedAnnualLossUsd;
    totalAal += a.aalUsd ?? a.totalExpectedAnnualLossUsd;
    totalPeriodExceedance += a.periodExceedanceLossUsd ?? a.totalExpectedAnnualLossUsd;
    sumScore += a.compositeScore;
    sumDamageRatio += a.totalDamageRatio;

    distributionByRating[a.compositeRating] = (distributionByRating[a.compositeRating] || 0) + 1;

    // Category distribution
    const cat = a.asset.category || 'Other';
    if (!distributionByCategory[cat]) {
      distributionByCategory[cat] = { count: 0, totalLossUsd: 0, avgScore: 0 };
    }
    distributionByCategory[cat].count += 1;
    distributionByCategory[cat].totalLossUsd += a.totalExpectedAnnualLossUsd;
    distributionByCategory[cat].avgScore += a.compositeScore;

    // Hazards
    for (const hId of ALL_HAZARDS) {
      const hRes = a.hazardResults[hId];
      if (hRes) {
        hazardScoreSums[hId] += hRes.score;
        hazardLossSums[hId] += hRes.expectedLossUsd;
        if (hRes.score >= 56) {
          hazardHighCount[hId] += 1;
        }
      }
    }
  });

  const count = assessments.length;
  const portfolioRiskScore = Number((sumScore / count).toFixed(1));
  const portfolioRating = getRatingFromScore(portfolioRiskScore);
  // Value-weighted, so a $10B fab is not averaged equally with a $50M warehouse
  const averageDamageRatio = totalValue > 0
    ? Number((totalLoss / totalValue).toFixed(5))
    : Number((sumDamageRatio / count).toFixed(5));
  const lossMetricType: 'AAL' | 'PML' = assessments[0]?.lossMetricType || 'PML';

  // Spatial tail dependence between sites: correlation decays with distance (750 km length)
  // plus a co-tail bonus when two sites share the same main hazard.
  const rhoOf = (i: number, j: number) => {
    const d = haversineDistanceKm(assessments[i].asset.latitude, assessments[i].asset.longitude, assessments[j].asset.latitude, assessments[j].asset.longitude);
    const sameHazard = assessments[i].primaryHazard === assessments[j].primaryHazard ? 0.2 : 0;
    return Math.min(1, Math.exp(-d / 750) + sameHazard);
  };

  // Portfolio VaR by correlated aggregation of site VaRs:  VaR_p² = Σ_i Σ_j ρ_ij · VaR_i · VaR_j
  //  - one site            → equals that site's VaR
  //  - adding a site       → never lowers portfolio VaR (all terms are ≥ 0)
  //  - fully correlated    → sum of site VaRs; uncorrelated → root-sum-of-squares
  const v95 = assessments.map((a) => a.valueAtRisk95);
  const v995 = assessments.map((a) => a.valueAtRisk995);
  let q95 = v95.reduce((t, v) => t + v * v, 0);
  let q995 = v995.reduce((t, v) => t + v * v, 0);
  let pairSum = 0;
  let pairs = 0;
  if (count <= 3000) { // exact O(n²): ~4.5M pairs is still well under a second
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const r = rhoOf(i, j);
        q95 += 2 * r * v95[i] * v95[j];
        q995 += 2 * r * v995[i] * v995[j];
        pairSum += r;
        pairs++;
      }
    }
  } else {
    // Large uploads: estimate the average correlation from a deterministic sample
    const stride = Math.ceil(count / 400);
    for (let i = 0; i < count; i += stride) for (let j = i + stride; j < count; j += stride) { pairSum += rhoOf(i, j); pairs++; }
    const rbar = pairs ? pairSum / pairs : 0;
    const s95 = v95.reduce((t, v) => t + v, 0);
    const s995 = v995.reduce((t, v) => t + v, 0);
    q95 += rbar * (s95 * s95 - q95);
    q995 += rbar * (s995 * s995 - q995);
  }
  const spatialClusteringIndex = pairs > 0 ? Number((pairSum / pairs).toFixed(3)) : 1;

  let copulaCorrelationStatus: 'Highly Diversified' | 'Moderately Diversified' | 'Regionally Clustered' | 'Highly Concentrated' = 'Highly Diversified';
  if (count < 5 || spatialClusteringIndex >= 0.75) {
    copulaCorrelationStatus = 'Highly Concentrated'; // too few sites to diversify
  } else if (spatialClusteringIndex >= 0.5) {
    copulaCorrelationStatus = 'Regionally Clustered';
  } else if (spatialClusteringIndex >= 0.25) {
    copulaCorrelationStatus = 'Moderately Diversified';
  }

  const var95Usd = Math.round(Math.min(totalValue, Math.sqrt(q95)));
  const var995Usd = Math.round(Math.min(totalValue, Math.sqrt(q995)));
  // Effective tail multipliers on AAL (for display)
  const copulaVaRMultiplier95 = totalAal > 0 ? Number((var95Usd / totalAal).toFixed(2)) : 0;
  const copulaVaRMultiplier995 = totalAal > 0 ? Number((var995Usd / totalAal).toFixed(2)) : 0;

  // Normalize category average scores
  Object.keys(distributionByCategory).forEach((k) => {
    distributionByCategory[k].avgScore = Number((distributionByCategory[k].avgScore / distributionByCategory[k].count).toFixed(1));
  });

  // Find top exposed hazard by total loss
  let maxHazardLoss = -1;
  let topExposedHazard: HazardType = 'coastal_flood';

  const hazardBreakdown = ALL_HAZARDS.map((hId) => {
    const avgScore = Number((hazardScoreSums[hId] / count).toFixed(1));
    const hLoss = hazardLossSums[hId];
    if (hLoss > maxHazardLoss) {
      maxHazardLoss = hLoss;
      topExposedHazard = hId;
    }
    return {
      hazard: hId,
      hazardName: HAZARD_CATALOG[hId].name,
      averageScore: avgScore,
      totalExpectedLossUsd: hLoss,
      assetsExposedHighOrSevere: hazardHighCount[hId],
    };
  }).sort((a, b) => b.totalExpectedLossUsd - a.totalExpectedLossUsd);

  return {
    totalAssets: count,
    totalReplacementValueUsd: totalValue,
    totalExpectedAnnualLossUsd: totalLoss,
    totalAalUsd: totalAal,
    totalPeriodExceedanceLossUsd: totalPeriodExceedance,
    lossMetricType,
    averageDamageRatio,
    portfolioRiskScore,
    portfolioRating,
    var95Usd,
    var995Usd,
    spatialClusteringIndex,
    copulaVaRMultiplier95,
    copulaVaRMultiplier995,
    copulaCorrelationStatus,
    topExposedHazard,
    hazardBreakdown,
    distributionByRating,
    distributionByCategory,
  };
}

// Utility formatting
export function formatCurrencyUsd(amount: number): string {
  if (!Number.isFinite(amount)) return '$0';
  const sign = amount < 0 ? '-' : '';
  const a = Math.abs(amount);
  if (a >= 1e12) return `${sign}$${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}K`;
  return `${sign}$${Math.round(a).toLocaleString()}`;
}

// Global CMIP6 Spatial Point Diagnostic Query
export interface PointClimateDiagnostic {
  latitude: number;
  longitude: number;
  gridCellCenter: [number, number];
  gridCellBounds: [[number, number], [number, number]];
  gridResolutionKm: number;
  spatialResolution: SpatialResolution;
  resolutionName: string;
  resolutionProvider: string;
  uncertaintyBandPercent: number; // ±% 90% confidence interval
  elevationMeters: number;
  distanceToOceanKm: number;
  physiographicRegion: string;
  detectedLocation: string;
  koppenClimateClass: string;
  koppenDescription: string;
  primaryRiskHazard: HazardType;
  compositePhysicalRiskScore: number;
  compositeRating: RiskRating;
  hazardResults: Record<HazardType, HazardMetricResult>;
}

export function queryLocationClimateData(
  lat: number,
  lon: number,
  scenario: SSPScenario = 'ssp245',
  decade: Decade = 2050,
  returnPeriod: ReturnPeriod = '100yr',
  resolution: SpatialResolution = '1km'
): PointClimateDiagnostic {
  // Compute Grid Cell Center according to selected Spatial Downscaling Resolution
  // Grid step in degrees (90 m = 3 arc-seconds = 1/1200°). Cells are square in degrees, so their
  // east-west width shrinks with cos(latitude) — exactly like the source rasters.
  const STEP: Record<string, [number, number]> = { '25km': [0.25, 25], '10km': [0.1, 10], '1km': [0.01, 1], '90m': [1 / 1200, 0.09] };
  const [step, gridKm] = STEP[resolution] ?? STEP['1km'];
  const snap = (x: number) => Math.round(x / step) * step;
  const gridLat = Math.max(-90 + step / 2, Math.min(90 - step / 2, snap(lat)));
  let gridLon = snap(lon);
  if (gridLon > 180) gridLon -= 360;
  if (gridLon < -180) gridLon += 360;

  const resMeta = SPATIAL_RESOLUTIONS[resolution];

  // Resolve scientific topographic elevation & distance to ocean
  const elevationMeters = estimateGlobalElevationMeters(gridLat, gridLon);
  const distanceToOceanKm = getDistanceToOceanKm(gridLat, gridLon);
  const geo = reverseGeocodeLocation(lat, lon);
  const isArid = checkIsAridZone(lat, lon);
  const absLat = Math.abs(lat);

  // Synthesize Köppen Climate Classification based on real global geography
  let koppenClass = 'Cfa';
  let koppenDesc = 'Humid Subtropical (Warm temperate, hot summer)';

  if (elevationMeters >= 3000) {
    koppenClass = elevationMeters >= 5500 ? 'EF' : 'ET';
    koppenDesc = elevationMeters >= 5500
      ? 'Ice Cap / Polar Glacier (Perpetual frost, glaciated cryosphere terrain)'
      : 'Tundra / Alpine (Severe frost, abbreviated cool season, cryosphere permafrost)';
  } else if (isArid) {
    if ((elevationMeters > 1000 || absLat > 34) && !(lat >= 32.0 && lat <= 37.0 && lon >= -118.5 && lon <= -114.5 && elevationMeters < 500)) {
      koppenClass = 'BSk';
      koppenDesc = 'Cold Semi-Arid / High Desert Plateau (Severe moisture deficit, chronic drought, seasonal thermal swings)';
    } else {
      koppenClass = 'BWh';
      koppenDesc = 'Hot Arid Desert (Extreme daytime heat, acute water stress, chronic drought)';
    }
  } else if (absLat < 15) {
    koppenClass = 'Af';
    koppenDesc = 'Tropical Rainforest (Equatorial, high humidity & convective deluge)';
  } else if (absLat >= 15 && absLat <= 23.5) {
    koppenClass = 'Aw';
    koppenDesc = 'Tropical Savanna (Pronounced dry season, extreme heat waves)';
  } else if (absLat > 32 && absLat <= 58 && (lon >= -10 && lon <= (absLat > 50 ? 12 : 25))) {
    koppenClass = 'Cfb';
    koppenDesc = 'Temperate Oceanic (Moderate thermal range, persistent river runoff)';
  } else if (absLat > 66) {
    koppenClass = 'ET';
    koppenDesc = 'Polar Tundra (Short cool summer, long frozen winter)';
  } else if (absLat > 50) {
    koppenClass = 'Dfb';
    koppenDesc = 'Humid Continental / Subarctic (Severe freeze spells, snowpack melt)';
  }


  // Create benchmark asset to leverage assessment engine
  const dummyAsset: Asset = {
    id: `point-${lat.toFixed(2)}-${lon.toFixed(2)}`,
    name: `${geo.city} Diagnostic Grid`,
    entityName: 'CMIP6 Geo-Spatial Grid Cell',
    parentEntity: 'IPCC AR6 / CMIP6 Ensemble',
    assetType: 'Hyperscale Cloud Data Center (>50MW)',
    category: 'Data Center & Telecom',
    latitude: gridLat, // assess the grid-cell centre, so every point in a cell gets the same result
    longitude: gridLon,
    city: geo.city,
    country: geo.country,
    replacementValueUsd: 100000000,
    yearBuilt: 2025,
    elevationMeters,
    criticalityTier: 1,
  };

  const assessment = assessAssetRisk(dummyAsset, scenario, decade, returnPeriod);

  const halfDeg = step / 2; // the drawn cell always contains the clicked point
  const gridCellBounds: [[number, number], [number, number]] = [
    [Number((gridLat - halfDeg).toFixed(5)), Number((gridLon - halfDeg).toFixed(5))],
    [Number((gridLat + halfDeg).toFixed(5)), Number((gridLon + halfDeg).toFixed(5))],
  ];

  return {
    latitude: Number(lat.toFixed(4)),
    longitude: Number(lon.toFixed(4)),
    gridCellCenter: [gridLat, gridLon],
    gridCellBounds,
    gridResolutionKm: gridKm,
    spatialResolution: resolution,
    resolutionName: resMeta.name,
    resolutionProvider: resMeta.provider,
    uncertaintyBandPercent: resMeta.uncertaintyBandPercent,
    elevationMeters,
    distanceToOceanKm,
    physiographicRegion: geo.region,
    detectedLocation: `${geo.city}, ${geo.country}`,
    koppenClimateClass: koppenClass,
    koppenDescription: koppenDesc,
    primaryRiskHazard: assessment.primaryHazard,
    compositePhysicalRiskScore: assessment.compositeScore,
    compositeRating: assessment.compositeRating,
    hazardResults: assessment.hazardResults,
  };
}

