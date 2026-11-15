# CLIMARIS

Physical climate-risk screening for loan books, from open data. React + TypeScript + Vite.

```
npm install
npm run dev      # http://localhost:5173
npm test         # engine tests
npm run build
```

Everything runs in the browser: hazard data is fetched from public APIs (Open-Meteo / ERA5 / CMIP6 / GloFAS,
USGS, NOAA) for each location and cached locally. See CHANGES.md and the in-app Methodology page.
