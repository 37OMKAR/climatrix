const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SAMPLE_LOANS = [
  {
    key: "loan-1", row: 1, borrower: "Tata Motors Commercial Hub", loanId: "TL-2024-8841",
    district: "Pune", state: "Maharashtra", country: "India", sector: "Automotive & Manufacturing", cls: "industrial",
    amount: 145000000, tenureMonths: 84, startYear: 2024, maturityYear: 2031,
    lat: 18.5204, lon: 73.8567, geo: { status: "given", precision: "address", label: "Pune, Maharashtra" }, issues: []
  },
  {
    key: "loan-2", row: 2, borrower: "Adani Logistics Gateway", loanId: "TL-2023-1092",
    district: "Mumbai Suburban", state: "Maharashtra", country: "India", sector: "Ports & Infrastructure", cls: "infrastructure",
    amount: 320000000, tenureMonths: 120, startYear: 2023, maturityYear: 2033,
    lat: 19.0760, lon: 72.8777, geo: { status: "given", precision: "address", label: "Mumbai, Maharashtra" }, issues: []
  },
  {
    key: "loan-3", row: 3, borrower: "Sun Pharma Research Park", loanId: "TL-2024-4412",
    district: "Vadodara", state: "Gujarat", country: "India", sector: "Chemical & Pharma", cls: "industrial",
    amount: 98000000, tenureMonths: 60, startYear: 2024, maturityYear: 2029,
    lat: 22.3072, lon: 73.1812, geo: { status: "given", precision: "address", label: "Vadodara, Gujarat" }, issues: []
  },
  {
    key: "loan-4", row: 4, borrower: "Infosys Cloud Campus", loanId: "TL-2022-7719",
    district: "Bengaluru Urban", state: "Karnataka", country: "India", sector: "Commercial Real Estate", cls: "commercial",
    amount: 210000000, tenureMonths: 144, startYear: 2022, maturityYear: 2034,
    lat: 12.9716, lon: 77.5946, geo: { status: "given", precision: "address", label: "Bengaluru, Karnataka" }, issues: []
  },
  {
    key: "loan-5", row: 5, borrower: "Coromandel Agro Facilities", loanId: "TL-2024-3301",
    district: "Visakhapatnam", state: "Andhra Pradesh", country: "India", sector: "Agriculture & Fertilizer", cls: "agriculture",
    amount: 65000000, tenureMonths: 48, startYear: 2024, maturityYear: 2028,
    lat: 17.6868, lon: 83.2185, geo: { status: "given", precision: "address", label: "Visakhapatnam, Andhra Pradesh" }, issues: []
  },
  {
    key: "loan-6", row: 6, borrower: "DLF CyberCity Tower B", loanId: "TL-2023-5590",
    district: "Gurugram", state: "Haryana", country: "India", sector: "Commercial Real Estate", cls: "commercial",
    amount: 450000000, tenureMonths: 180, startYear: 2023, maturityYear: 2038,
    lat: 28.4595, lon: 77.0266, geo: { status: "given", precision: "address", label: "Gurugram, Haryana" }, issues: []
  },
  {
    key: "loan-7", row: 7, borrower: "Cochin Shipyard Terminal", loanId: "TL-2024-9021",
    district: "Ernakulam", state: "Kerala", country: "India", sector: "Marine & Shipbuilding", cls: "infrastructure",
    amount: 180000000, tenureMonths: 96, startYear: 2024, maturityYear: 2032,
    lat: 9.9312, lon: 76.2673, geo: { status: "given", precision: "address", label: "Kochi, Kerala" }, issues: []
  }
];

async function run() {
  const dir = path.resolve('docs/images');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  // Pre-seed sample loans into localStorage so portfolio screen is rich and full!
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((loans) => {
    localStorage.setItem('climaris:loans:v1', JSON.stringify(loans));
  }, SAMPLE_LOANS);

  // 1. Capture Location Page with Google Earth & Selected Point
  console.log('Capturing Location Page...');
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Click on the map in a prominent location (e.g. coastal India)
  const mapEl = await page.$('.leaflet-container');
  if (mapEl) {
    const box = await mapEl.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width * 0.49, box.y + box.height * 0.52);
      console.log('Clicked map');
      await page.waitForTimeout(3000);
    }
  }

  await page.screenshot({ path: path.join(dir, 'climatrix_location_screening.png'), fullPage: false });
  console.log('Saved climatrix_location_screening.png');

  // 2. Capture Portfolio Page (Reload so seeded loans load and compute)
  console.log('Capturing Portfolio Page...');
  const portfolioBtn = await page.$('button:has-text("Portfolio")');
  if (portfolioBtn) {
    await portfolioBtn.click();
    await page.waitForTimeout(3500); // Give time for sites to compute
    await page.screenshot({ path: path.join(dir, 'climatrix_portfolio_stress_test.png'), fullPage: false });
    console.log('Saved climatrix_portfolio_stress_test.png');
  }

  // 3. Capture Methodology & Dataset Page
  console.log('Capturing Methodology Page...');
  const methodBtn = await page.$('button:has-text("Methodology")');
  if (methodBtn) {
    await methodBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(dir, 'climatrix_methodology_datasets.png'), fullPage: false });
    console.log('Saved climatrix_methodology_datasets.png');
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
}

run().catch(console.error);
