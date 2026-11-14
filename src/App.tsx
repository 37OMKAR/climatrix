import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import {
  Asset,
  Decade,
  HazardType,
  ReturnPeriod,
  SpatialResolution,
  SSPScenario,
} from './types/climate';
import {
  assessAssetRisk,
  computePortfolioSummary,
  ALL_HAZARDS,
  HAZARD_CATALOG,
} from './services/climateEngine';
import { SAMPLE_PORTFOLIOS } from './services/sampleData';
import { Navbar } from './components/Navbar';
import { MapExplorer } from './components/MapExplorer';
import { PortfolioAnalytics } from './components/PortfolioAnalytics';
import { SovereignsView } from './components/SovereignsView';
import { CorporateEntityExplorer } from './components/CorporateEntityExplorer';
import { HazardDeepDiveModal } from './components/HazardDeepDiveModal';
import { AssetUploaderModal } from './components/AssetUploaderModal';
import { AddAssetModal } from './components/AddAssetModal';
import { RegulatoryReportModal } from './components/RegulatoryReportModal';
import { ScenarioComparisonModal } from './components/ScenarioComparisonModal';
import { TaxonomyExplorerModal } from './components/TaxonomyExplorerModal';
import { UnifiedDashboard } from './components/UnifiedDashboard';

export const App: React.FC = () => {
  // Core Climate Engine Controls
  const [currentScenario, setCurrentScenario] = useState<SSPScenario>('ssp245');
  const [currentDecade, setCurrentDecade] = useState<Decade>(2050);
  const [currentReturnPeriod, setCurrentReturnPeriod] = useState<ReturnPeriod>('100yr');
  const [currentResolution, setCurrentResolution] = useState<SpatialResolution>('1km');

  // Navigation View Tab: 'dashboard' is primary master terminal
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'sovereigns' | 'corporate'>('dashboard');

  // Active Portfolio ID (Default: 'global-flagship')
  const [activePortfolioId, setActivePortfolioId] = useState<string>('global-flagship');

  // Portfolio State (Default: Global Flagship Real Portfolio)
  const [assets, setAssets] = useState<Asset[]>(SAMPLE_PORTFOLIOS[0].assets);

  // Modal States
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [isTaxonomyOpen, setIsTaxonomyOpen] = useState(false);
  const [initialCoordinates, setInitialCoordinates] = useState<{ lat: number; lon: number } | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Compute Risk Assessments in Real-Time for all Assets
  const assessments = useMemo(() => {
    return assets.map((asset) =>
      assessAssetRisk(asset, currentScenario, currentDecade, currentReturnPeriod)
    );
  }, [assets, currentScenario, currentDecade, currentReturnPeriod]);

  // Aggregate Portfolio Summary
  const portfolioSummary = useMemo(() => {
    return computePortfolioSummary(assessments);
  }, [assessments]);

  // Selected Asset for Deep Dive Modal
  const selectedAssessment = useMemo(() => {
    if (!selectedAssetId) return null;
    return assessments.find((a) => a.asset.id === selectedAssetId) || null;
  }, [selectedAssetId, assessments]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Portfolio actions
  const handleLoadSamplePortfolio = (portfolioId: string) => {
    const target = SAMPLE_PORTFOLIOS.find((p) => p.id === portfolioId);
    if (target) {
      setAssets(target.assets);
      setActivePortfolioId(target.id);
      setSelectedAssetId(null);
      showToast(`Loaded "${target.name}" (${target.assetCount} facilities, ${target.totalCapitalUsd})`);
    }
  };

  const handleUploadAssets = (newAssets: Asset[]) => {
    setAssets(newAssets);
    setActivePortfolioId('custom-upload');
    setSelectedAssetId(null);
    showToast(`Successfully ingested and modeled ${newAssets.length} assets`);
  };

  const handleAddAsset = (newAsset: Asset) => {
    setAssets((prev) => [newAsset, ...prev]);
    setSelectedAssetId(newAsset.id);
    showToast(`Added "${newAsset.name}" to physical risk model`);
  };

  // Full Export to CSV
  const handleExportCsv = () => {
    const csvRows = assessments.map((item) => {
      const row: Record<string, any> = {
        'Asset Name': item.asset.name,
        'Corporate Entity': item.asset.entityName,
        'Parent Entity': item.asset.parentEntity,
        'Asset Category': item.asset.category,
        'Asset Taxonomy Type': item.asset.assetType,
        'Latitude': item.asset.latitude,
        'Longitude': item.asset.longitude,
        'Elevation (m)': item.asset.elevationMeters ?? 20,
        'City': item.asset.city,
        'Country': item.asset.country,
        'Replacement Value (USD)': item.asset.replacementValueUsd,
        'Scenario': currentScenario,
        'Decade': `${currentDecade}s`,
        'Return Period': currentReturnPeriod,
        'Composite Risk Score (0-100)': item.compositeScore,
        'Risk Rating': item.compositeRating,
        'Expected Annual Loss (USD)': item.totalExpectedAnnualLossUsd,
        'Physical Damage Ratio (%)': Number((item.totalDamageRatio * 100).toFixed(2)),
        'Tail Risk VaR 99.5% (USD)': item.valueAtRisk995,
        'Downtime Days': item.downtimeDays,
        'Primary Threat': HAZARD_CATALOG[item.primaryHazard]?.name,
      };

      // Add scores and absolute metrics for all 12 hazards
      for (const hId of ALL_HAZARDS) {
        const hRes = item.hazardResults[hId];
        const hMeta = HAZARD_CATALOG[hId];
        if (hRes) {
          row[`Hazard: ${hMeta.name} - Score`] = hRes.score;
          row[`Hazard: ${hMeta.name} - Intensity (${hMeta.unit})`] = hRes.absoluteValue;
          row[`Hazard: ${hMeta.name} - Loss (USD)`] = hRes.expectedLossUsd;
        }
      }

      return row;
    });

    const csvString = Papa.unparse(csvRows);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ClimaRisk_Physical_Assessment_${currentDecade}s_${currentScenario}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navbar Header */}
      <Navbar
        currentScenario={currentScenario}
        onScenarioChange={setCurrentScenario}
        currentDecade={currentDecade}
        onDecadeChange={setCurrentDecade}
        currentReturnPeriod={currentReturnPeriod}
        onReturnPeriodChange={setCurrentReturnPeriod}
        currentResolution={currentResolution}
        onResolutionChange={setCurrentResolution}
        activePortfolioId={activePortfolioId}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenAddAsset={() => setIsAddAssetOpen(true)}
        onOpenTaxonomy={() => setIsTaxonomyOpen(true)}
        onOpenReport={() => setIsReportOpen(true)}
        onOpenCompare={() => setIsCompareOpen(true)}
        onLoadSamplePortfolio={handleLoadSamplePortfolio}
        onExportCsv={handleExportCsv}
        totalAssets={assets.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 relative">
        {activeTab === 'dashboard' && (
          <UnifiedDashboard
            summary={portfolioSummary}
            assessments={assessments}
            currentScenario={currentScenario}
            currentDecade={currentDecade}
            currentReturnPeriod={currentReturnPeriod}
            currentResolution={currentResolution}
            onResolutionChange={setCurrentResolution}
            activePortfolioId={activePortfolioId}
            onLoadSamplePortfolio={handleLoadSamplePortfolio}
            selectedAssetId={selectedAssetId}
            onSelectAsset={(id) => setSelectedAssetId(id)}
            onExportCsv={handleExportCsv}
            onOpenUpload={() => setIsUploadOpen(true)}
            onOpenAddAsset={() => setIsAddAssetOpen(true)}
            onOpenReport={() => setIsReportOpen(true)}
            onAddAssetAtCoords={(lat, lon) => {
              setInitialCoordinates({ lat, lon });
              setIsAddAssetOpen(true);
            }}
          />
        )}

        {activeTab === 'map' && (
          <MapExplorer
            assessments={assessments}
            selectedAssetId={selectedAssetId}
            onSelectAsset={(id) => setSelectedAssetId(id)}
            activeHazardFilter="all"
            onHazardFilterChange={() => {}}
            currentScenario={currentScenario}
            currentDecade={currentDecade}
            currentReturnPeriod={currentReturnPeriod}
            currentResolution={currentResolution}
            onAddAssetAtCoords={(lat, lon) => {
              setInitialCoordinates({ lat, lon });
              setIsAddAssetOpen(true);
            }}
          />
        )}

        {activeTab === 'sovereigns' && <SovereignsView />}

        {activeTab === 'corporate' && (
          <CorporateEntityExplorer
            onLoadEntityPortfolio={(entName) => {
              showToast(`Entity portfolio filter applied for ${entName}`);
            }}
          />
        )}
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-cyan-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl border border-cyan-400/30 animate-in fade-in slide-in-from-bottom-5">
          {toastMessage}
        </div>
      )}

      {/* Modals */}
      <HazardDeepDiveModal
        assessment={selectedAssessment}
        onClose={() => setSelectedAssetId(null)}
        activeScenario={currentScenario}
      />

      <AssetUploaderModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadAssets={handleUploadAssets}
        onLoadSamplePortfolio={handleLoadSamplePortfolio}
      />

      <AddAssetModal
        isOpen={isAddAssetOpen}
        onClose={() => {
          setIsAddAssetOpen(false);
          setInitialCoordinates(null);
        }}
        onAddAsset={(asset) => {
          handleAddAsset(asset);
          setInitialCoordinates(null);
        }}
        initialCoordinates={initialCoordinates}
      />

      <RegulatoryReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        summary={portfolioSummary}
        assessments={assessments}
        scenario={currentScenario}
        decade={currentDecade}
        resolution={currentResolution}
      />

      <ScenarioComparisonModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        assets={assets}
      />

      <TaxonomyExplorerModal
        isOpen={isTaxonomyOpen}
        onClose={() => setIsTaxonomyOpen(false)}
        onSelectTypeForNewAsset={(assetType, cat) => {
          setIsAddAssetOpen(true);
        }}
      />
    </div>
  );
};

export default App;
