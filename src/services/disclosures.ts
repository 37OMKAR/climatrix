// Regulatory disclosure metrics, computed from the live assessments.
// Every figure shown in the Reporting view and the dossier modal comes from here,
// so nothing on screen is a hard-coded placeholder.
import { AssetRiskAssessment, Decade, HazardType, PortfolioSummary, SSPScenario } from '../types/climate';
import { ALL_HAZARDS, HAZARD_TAXONOMY, SSP_SCENARIOS } from './climateEngine';

// Climate-driven hazards split by onset (geophysical perils are reported separately)
export const ACUTE_HAZARDS: HazardType[] = ALL_HAZARDS.filter((h) => HAZARD_TAXONOMY[h].onset === 'acute' && HAZARD_TAXONOMY[h].climateDriven);
export const CHRONIC_HAZARDS: HazardType[] = ALL_HAZARDS.filter((h) => HAZARD_TAXONOMY[h].onset === 'chronic');
export const GEOPHYSICAL_HAZARDS: HazardType[] = ALL_HAZARDS.filter((h) => !HAZARD_TAXONOMY[h].climateDriven);

export const DNSH_GROUPS: Array<{ id: string; name: string; hazards: HazardType[]; examples: string }> = [
  { id: 'temperature', name: 'Temperature', hazards: ['extreme_heat', 'heat_stress', 'extreme_cold', 'wildfire', 'permafrost_thaw'], examples: 'Heat, cold, wildfire, permafrost' },
  { id: 'water', name: 'Water', hazards: ['coastal_flood', 'fluvial_flood', 'pluvial_flood', 'sea_level_rise', 'drought', 'water_stress', 'saline_intrusion', 'groundwater_decline', 'glacial_lake_outburst'], examples: 'Flood, sea level, drought, salinity' },
  { id: 'wind', name: 'Wind', hazards: ['tropical_cyclone', 'extratropical_storm', 'tornado', 'sand_dust_storm', 'hail'], examples: 'Cyclones, storms, tornado, dust' },
  { id: 'solid', name: 'Solid mass', hazards: ['subsidence', 'landslide', 'coastal_erosion', 'avalanche'], examples: 'Subsidence, landslide, erosion, avalanche' },
];

/** EU Taxonomy Climate Delegated Act, Annex I, Appendix A — hazard screening list and our coverage. */
export const APPENDIX_A: Array<{ group: 'Temperature' | 'Wind' | 'Water' | 'Solid mass'; onset: 'Chronic' | 'Acute'; hazard: string; covered: HazardType[]; status: 'modelled' | 'proxy' | 'none' }> = [
  { group: 'Temperature', onset: 'Chronic', hazard: 'Changing temperature (air, freshwater, marine water)', covered: ['extreme_heat', 'extreme_cold'], status: 'proxy' },
  { group: 'Temperature', onset: 'Chronic', hazard: 'Heat stress', covered: ['heat_stress'], status: 'modelled' },
  { group: 'Temperature', onset: 'Chronic', hazard: 'Temperature variability', covered: ['extreme_heat', 'extreme_cold'], status: 'proxy' },
  { group: 'Temperature', onset: 'Chronic', hazard: 'Permafrost thawing', covered: ['permafrost_thaw'], status: 'modelled' },
  { group: 'Temperature', onset: 'Acute', hazard: 'Heat wave', covered: ['extreme_heat'], status: 'modelled' },
  { group: 'Temperature', onset: 'Acute', hazard: 'Cold wave / frost', covered: ['extreme_cold'], status: 'modelled' },
  { group: 'Temperature', onset: 'Acute', hazard: 'Wildfire', covered: ['wildfire'], status: 'modelled' },
  { group: 'Wind', onset: 'Chronic', hazard: 'Changing wind patterns', covered: ['extratropical_storm'], status: 'proxy' },
  { group: 'Wind', onset: 'Acute', hazard: 'Cyclone, hurricane, typhoon', covered: ['tropical_cyclone'], status: 'modelled' },
  { group: 'Wind', onset: 'Acute', hazard: 'Storm (incl. blizzards, dust and sandstorms)', covered: ['extratropical_storm', 'sand_dust_storm'], status: 'modelled' },
  { group: 'Wind', onset: 'Acute', hazard: 'Tornado', covered: ['tornado'], status: 'modelled' },
  { group: 'Water', onset: 'Chronic', hazard: 'Changing precipitation patterns and types (rain, hail, snow/ice)', covered: ['pluvial_flood', 'hail'], status: 'proxy' },
  { group: 'Water', onset: 'Chronic', hazard: 'Precipitation or hydrological variability', covered: ['drought'], status: 'proxy' },
  { group: 'Water', onset: 'Chronic', hazard: 'Ocean acidification', covered: [], status: 'none' },
  { group: 'Water', onset: 'Chronic', hazard: 'Saline intrusion', covered: ['saline_intrusion'], status: 'modelled' },
  { group: 'Water', onset: 'Chronic', hazard: 'Sea level rise', covered: ['sea_level_rise'], status: 'modelled' },
  { group: 'Water', onset: 'Chronic', hazard: 'Water stress', covered: ['water_stress', 'groundwater_decline'], status: 'modelled' },
  { group: 'Water', onset: 'Acute', hazard: 'Drought', covered: ['drought'], status: 'modelled' },
  { group: 'Water', onset: 'Acute', hazard: 'Heavy precipitation (rain, hail, snow/ice)', covered: ['pluvial_flood', 'hail'], status: 'modelled' },
  { group: 'Water', onset: 'Acute', hazard: 'Flood (coastal, fluvial, pluvial, groundwater)', covered: ['coastal_flood', 'fluvial_flood', 'pluvial_flood'], status: 'modelled' },
  { group: 'Water', onset: 'Acute', hazard: 'Glacial lake outburst', covered: ['glacial_lake_outburst'], status: 'modelled' },
  { group: 'Solid mass', onset: 'Chronic', hazard: 'Coastal erosion', covered: ['coastal_erosion'], status: 'modelled' },
  { group: 'Solid mass', onset: 'Chronic', hazard: 'Soil degradation', covered: ['subsidence'], status: 'proxy' },
  { group: 'Solid mass', onset: 'Chronic', hazard: 'Soil erosion', covered: ['landslide'], status: 'proxy' },
  { group: 'Solid mass', onset: 'Chronic', hazard: 'Solifluction', covered: ['permafrost_thaw'], status: 'proxy' },
  { group: 'Solid mass', onset: 'Acute', hazard: 'Avalanche', covered: ['avalanche'], status: 'modelled' },
  { group: 'Solid mass', onset: 'Acute', hazard: 'Landslide', covered: ['landslide'], status: 'modelled' },
  { group: 'Solid mass', onset: 'Acute', hazard: 'Subsidence', covered: ['subsidence'], status: 'modelled' },
];

const HIGH = 56; // score threshold for "High" and above
const SEVERE = 75; // score threshold for "Severe" and above

const maxScore = (a: AssetRiskAssessment, hazards: HazardType[]) =>
  Math.max(0, ...hazards.map((h) => a.hazardResults[h]?.score ?? 0));

export interface DisclosureMetrics {
  totalValue: number;
  totalAal: number;
  aalPctOfValue: number;
  activeLoss: number;
  activeLossLabel: string;
  highOrAboveCount: number;
  severeOrAboveCount: number;
  grossCarryingAcute: number;
  grossCarryingChronic: number;
  acuteSiteCount: number;
  chronicSiteCount: number;
  adaptationCapexHighRisk: number;
  annualLossAvoided: number;
  residualAalAfterAdaptation: number;
  netBenefit15yPositive: number;
  positiveNpvAssetCount: number;
  secThreshold: number;
  secMaterial: boolean;
  horizons: Array<{ label: string; decade: Decade; lossUsd: number }>;
  scenarioRows: Array<{ scenario: SSPScenario; code: string; ngfs: string; warming: string; lossUsd: number; avgScore: number; isActive: boolean }>;
  dnsh: Array<{ id: string; name: string; examples: string; assetsAtRisk: number; status: 'clear' | 'plan' }>;
  topAssetsByLoss: AssetRiskAssessment[];
  appendixA: Array<(typeof APPENDIX_A)[number] & { sitesHighPlus: number }>;
  geophysicalHighPlus: number;
}

export function computeDisclosures(
  assessments: AssetRiskAssessment[],
  summary: PortfolioSummary,
  activeScenario: SSPScenario,
): DisclosureMetrics {
  const totalValue = summary.totalReplacementValueUsd;
  const totalAal = summary.totalAalUsd;

  const highRisk = assessments.filter((a) => a.compositeScore >= HIGH);
  const annualLossAvoided = assessments.reduce((t, a) => t + a.adaptationRoi.annualLossReductionUsd, 0);
  const positive = assessments.filter((a) => a.adaptationRoi.netResilienceBenefitUsd > 0);

  const sumAt = (d: Decade) =>
    assessments.reduce((t, a) => t + (a.decadeTrajectory.find((x) => x.decade === d)?.expectedLossUsd ?? 0), 0);

  const scenarioRows = (Object.keys(SSP_SCENARIOS) as SSPScenario[]).map((s) => {
    const lossUsd = assessments.reduce((t, a) => t + (a.scenarioComparison[s]?.expectedLossUsd ?? 0), 0);
    const avgScore = assessments.length
      ? Number((assessments.reduce((t, a) => t + (a.scenarioComparison[s]?.compositeScore ?? 0), 0) / assessments.length).toFixed(1))
      : 0;
    const meta = SSP_SCENARIOS[s];
    return { scenario: s, code: meta.code, ngfs: meta.ngfsEquivalent, warming: meta.warming2100, lossUsd, avgScore, isActive: s === activeScenario };
  });

  const dnsh = DNSH_GROUPS.map((g) => {
    const assetsAtRisk = assessments.filter((a) => maxScore(a, g.hazards) >= SEVERE).length;
    return { id: g.id, name: g.name, examples: g.examples, assetsAtRisk, status: assetsAtRisk === 0 ? 'clear' as const : 'plan' as const };
  });

  const secThreshold = totalValue * 0.01;

  return {
    totalValue,
    totalAal,
    aalPctOfValue: totalValue > 0 ? totalAal / totalValue : 0,
    activeLoss: summary.totalExpectedAnnualLossUsd,
    activeLossLabel: summary.lossMetricType === 'AAL' ? 'Average annual loss' : 'Event loss (PML)',
    highOrAboveCount: highRisk.length,
    severeOrAboveCount: assessments.filter((a) => a.compositeScore >= SEVERE).length,
    grossCarryingAcute: assessments.filter((a) => maxScore(a, ACUTE_HAZARDS) >= HIGH).reduce((t, a) => t + a.asset.replacementValueUsd, 0),
    grossCarryingChronic: assessments.filter((a) => maxScore(a, CHRONIC_HAZARDS) >= HIGH).reduce((t, a) => t + a.asset.replacementValueUsd, 0),
    acuteSiteCount: assessments.filter((a) => maxScore(a, ACUTE_HAZARDS) >= HIGH).length,
    chronicSiteCount: assessments.filter((a) => maxScore(a, CHRONIC_HAZARDS) >= HIGH).length,
    adaptationCapexHighRisk: highRisk.reduce((t, a) => t + a.adaptationRoi.estimatedCapexUsd, 0),
    annualLossAvoided,
    residualAalAfterAdaptation: Math.max(0, totalAal - annualLossAvoided),
    netBenefit15yPositive: positive.reduce((t, a) => t + a.adaptationRoi.netResilienceBenefitUsd, 0),
    positiveNpvAssetCount: positive.length,
    secThreshold,
    secMaterial: totalAal >= secThreshold,
    horizons: [
      { label: 'Short term (to 2030)', decade: 2030, lossUsd: sumAt(2030) },
      { label: 'Medium term (2050)', decade: 2050, lossUsd: sumAt(2050) },
      { label: 'Long term (2080)', decade: 2080, lossUsd: sumAt(2080) },
    ],
    scenarioRows,
    dnsh,
    topAssetsByLoss: [...assessments].sort((a, b) => b.totalExpectedAnnualLossUsd - a.totalExpectedAnnualLossUsd).slice(0, 10),
    appendixA: APPENDIX_A.map((r) => ({ ...r, sitesHighPlus: r.covered.length ? assessments.filter((a) => maxScore(a, r.covered) >= HIGH).length : 0 })),
    geophysicalHighPlus: assessments.filter((a) => maxScore(a, GEOPHYSICAL_HAZARDS) >= HIGH).length,
  };
}
