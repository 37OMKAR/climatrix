// Core Climate Risk Platform Types

export type SSPScenario = 'ssp119' | 'ssp126' | 'ssp245' | 'ssp370' | 'ssp585';

export interface SSPScenarioMeta {
  id: SSPScenario;
  name: string;
  code: string;
  ngfsEquivalent: string; // NGFS Phase IV Scenario equivalent
  description: string;
  warming2100: string;
  co2Trajectory: string;
  color: string;
}

export type SpatialResolution = '25km' | '10km' | '1km' | '90m';

export interface SpatialResolutionMeta {
  id: SpatialResolution;
  name: string;
  gridSizeKm: number;
  provider: string;
  methodology: string;
  uncertaintyBandPercent: number; // ±% 90% confidence interval
  badgeColor: string;
}

export type RegulatoryFramework =
  | 'tcfd'
  | 'csrd_esrs'
  | 'sec_climate'
  | 'issb_ifrs2'
  | 'eu_taxonomy'
  | 'ngfs';

export interface RegulatoryFrameworkMeta {
  id: RegulatoryFramework;
  name: string;
  acronym: string;
  authority: string;
  mandateStatus: 'Mandatory' | 'Phased Implementation' | 'Comply or Explain' | 'Central Bank Supervisory';
  focus: string;
  keyRequirements: string[];
}

export type Decade = 2025 | 2030 | 2040 | 2050 | 2060 | 2070 | 2080 | 2090;

export type ReturnPeriod = '10yr' | '50yr' | '100yr' | '250yr' | '500yr' | 'aal';

export type HazardType =
  | 'coastal_flood'
  | 'fluvial_flood'
  | 'pluvial_flood'
  | 'drought'
  | 'water_stress'
  | 'extreme_heat'
  | 'heat_stress'
  | 'extreme_cold'
  | 'tropical_cyclone'
  | 'wildfire'
  | 'subsidence'
  | 'landslide';

export type RiskRating = 'Very Low' | 'Low' | 'Moderate' | 'High' | 'Severe' | 'Catastrophic';

export interface HazardMeta {
  id: HazardType;
  name: string;
  shortName: string;
  category: 'Flood' | 'Water & Drought' | 'Thermal' | 'Wind & Storm' | 'Geophysical & Fire';
  unit: string;
  description: string;
  cmip6ModelBasis: string;
  iconName: string;
  colorHex: string;
}

export interface HazardMetricResult {
  hazardId: HazardType;
  hazardName: string;
  score: number; // 0 to 100
  rating: RiskRating;
  absoluteValue: number; // in scientific unit
  unit: string;
  baselineValue: number;
  deltaPercent: number; // change from baseline
  damageRatio: number; // 0 to 1 (0% to 100%)
  expectedLossUsd: number; // Financial loss
  returnPeriodValues: Record<ReturnPeriod, number>;
  exceedanceProbability: number;
  confidenceScore: 'High' | 'Medium' | 'Low';
}

export type AssetCategory =
  | 'High-Tech & Semiconductor'
  | 'Data Center & Telecom'
  | 'Commercial Real Estate'
  | 'Industrial & Logistics'
  | 'Renewable Energy & Power'
  | 'Oil, Gas & Chemicals'
  | 'Maritime Port & Shipping'
  | 'Transportation & Rail'
  | 'Healthcare & Life Sciences'
  | 'Agriculture & Forestry'
  | 'Public & Municipal Infrastructure';

export interface AssetTypeMeta {
  id: string;
  name: string;
  category: AssetCategory;
  vulnerabilityFactors: Partial<Record<HazardType, number>>; // Multiplier 0.1 to 2.5
  businessInterruptionDailyCostRate: number; // fraction of asset value lost per day offline
  typicalLifespanYears: number;
  adaptationOptions: string[];
}

export interface Asset {
  id: string;
  name: string;
  entityName: string;
  parentEntity: string;
  assetType: string;
  category: AssetCategory;
  latitude: number;
  longitude: number;
  address?: string;
  city: string;
  country: string;
  subnational?: string; // State / Province
  county?: string;
  replacementValueUsd: number;
  yearBuilt: number;
  elevationMeters?: number;
  squareMeters?: number;
  criticalityTier: 1 | 2 | 3; // 1 = Critical, 2 = Core, 3 = Non-critical
  tags?: string[];
}

export interface AssetRiskAssessment {
  asset: Asset;
  scenario: SSPScenario;
  decade: Decade;
  returnPeriod: ReturnPeriod;
  compositeScore: number; // 0 to 100
  compositeRating: RiskRating;
  totalExpectedAnnualLossUsd: number; // Active loss figure (AAL or Period Exceedance Loss PML)
  aalUsd: number; // Unconditional Average Annual Loss (frequency-severity integral, constant across return periods)
  periodExceedanceLossUsd: number; // Return-period specific tail exceedance loss (Probable Maximum Loss PML)
  lossMetricType: 'AAL' | 'PML';
  lossTypeLabel: string;
  totalDamageRatio: number; // 0 to 1
  aalDamageRatio: number; // 0 to 1
  valueAtRisk95: number;
  valueAtRisk995: number;
  downtimeDays: number;
  businessInterruptionLossUsd: number;
  hazardResults: Record<HazardType, HazardMetricResult>;
  primaryHazard: HazardType;
  primaryHazardScore: number;
  decadeTrajectory: Array<{
    decade: Decade;
    compositeScore: number;
    expectedLossUsd: number;
    damageRatio: number;
  }>;
  scenarioComparison: Record<SSPScenario, {
    compositeScore: number;
    expectedLossUsd: number;
  }>;
  adaptationRoi: {
    recommendedMeasures: string[];
    estimatedCapexUsd: number;
    annualLossReductionUsd: number;
    paybackPeriodYears: number;
    netResilienceBenefitUsd: number;
  };
}

export interface PortfolioSummary {
  totalAssets: number;
  totalReplacementValueUsd: number;
  totalExpectedAnnualLossUsd: number; // Active loss figure
  totalAalUsd: number; // Portfolio baseline Average Annual Loss
  totalPeriodExceedanceLossUsd: number; // Portfolio Return-Period Exceedance Loss (PML)
  lossMetricType: 'AAL' | 'PML';
  averageDamageRatio: number;
  portfolioRiskScore: number;
  portfolioRating: RiskRating;
  var95Usd: number;
  var995Usd: number;
  spatialClusteringIndex: number; // Gaussian copula spatial clustering index (0.0 to 1.0)
  copulaVaRMultiplier95: number; // Calibrated copula tail multiplier
  copulaVaRMultiplier995: number; // Calibrated copula tail multiplier (Solvency II)
  copulaCorrelationStatus: 'Highly Diversified' | 'Moderately Diversified' | 'Regionally Clustered' | 'Highly Concentrated';
  topExposedHazard: HazardType;
  hazardBreakdown: Array<{
    hazard: HazardType;
    hazardName: string;
    averageScore: number;
    totalExpectedLossUsd: number;
    assetsExposedHighOrSevere: number;
  }>;
  distributionByRating: Record<RiskRating, number>;
  distributionByCategory: Record<string, { count: number; totalLossUsd: number; avgScore: number }>;
}

export interface SovereignRiskProfile {
  countryCode: string;
  countryName: string;
  subnational?: string;
  county?: string;
  region: string;
  compositePhysicalRiskScore: number; // 0 - 100
  ndGainReadinessScore: number; // 0 - 100 (adaptation readiness)
  gdpAtRisk2050Percent: number; // % of national GDP exposed
  sovereignSpreadImpactBps: number; // Basis points added to borrowing cost
  primaryVulnerabilities: HazardType[];
  populationExposedPercent: number;
  fiscalVulnerabilityTier: 'A' | 'BBB' | 'BB' | 'B' | 'CCC';
}

export interface CorporateEntity {
  id: string;
  name: string;
  ticker?: string;
  sector: string;
  headquarters: string;
  ultimateParent: string;
  marketCapUsdBillions: number;
  trackedAssetCount: number;
  portfolioReplacementValueUsd: number;
  aggregatePhysicalRiskScore: number;
  climateRating: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC';
  tcfdAlignmentScore: number; // %
  topHazardRisks: HazardType[];
}

