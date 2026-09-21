# AgniDrishti (अग्निदृष्टि)
> **"See Beyond the Heat"** — AI-Powered Satellite Thermal Anomaly Classification & GIS Intelligence Platform.

AgniDrishti sits on top of NASA FIRMS satellite data (VIIRS / MODIS) as an automated spatial intelligence investigator. It ingests thermal hotspots, groups them using DBSCAN clustering, enriches them with OpenStreetMap industrial boundaries and land-cover data, compares each observation against a 30-day site-specific baseline, executes a multi-spectral evidence audit, and assigns an operational priority for emergency and environmental responders.

---

## Architecture Overview

```
NASA FIRMS Satellite Telemetry (VIIRS / MODIS)
                     │
                     ▼
             Spatial Clustering
          (DBSCAN Epsilon = 10km)
                     │
                     ▼
          Multi-Source Enrichment
     (OSM 2.5km Buffer & Land Cover)
                     │
                     ▼
           Site-Specific Baseline
     (30-Day Mean, Std Dev, Z-Score)
                     │
                     ▼
        Rule-Based Evidence Auditor
    (Supporting vs Conflicting Signals)
                     │
                     ▼
          Classification Engine
  (INDUSTRIAL | NATURAL | UNCERTAIN)
                     │
                     ▼
           Operational Priority
        (HIGH | MEDIUM | LOW)
                     │
                     ▼
       AgniDrishti GIS Command Center
(2D Leaflet | Satellite | Interactive 3D Canvas)
```

---

## Features

- **5-Page Navigation Command Center**:
  - **Dashboard**: High-level operational KPIs, Leaflet overview map preview, urgent anomaly stream, and industrial facilities spotlight.
  - **Live Map**: Full-screen GIS workspace with 3 modes (**2D Dark Map**, **Satellite Imagery**, and **Interactive 3D Canvas** with FRP elevation pillars), layer toggles, and minimum FRP intensity slider.
  - **Alerts**: Filterable tabular registry with live search, classification, priority, and industrial baseline status filters with pagination.
  - **Facilities**: Catalog of monitored refineries, LNG terminals, and steel complexes tracking detections, mean FRP, peak FRP, and 30-day baseline means.
  - **Analytics**: Temporal observation trend bar charts, source classification distribution, priority breakdown, radiative power (FRP) spectrum, and diurnal overpasses.
- **Deep Analytical Overlays**:
  - **Alert Details Drawer**: Multi-tab inspector (`Overview`, `Evidence Audit`, `Historical Baseline`, `Satellite Info`).
  - **Facility Details Drawer**: Deep site metrics and associated detection links.
  - **Incident Intelligence Briefing Modal**: Printable incident report with PDF preview, multi-spectral evidence audit, and JSON export.
  - **Global Search (`Ctrl+K`)**: Fast search across facilities and alerts.
  - **Settings Modal**: Pipeline calibration inspection and benchmark test suite execution.

---

## Tech Stack

- **Backend**: Python 3.13, FastAPI, Uvicorn, SQLite / JSON, Pydantic v2, Pytest.
- **Frontend**: React 18, TypeScript, Vite, Leaflet, HTML5 Canvas 3D Projection, Lucide Icons, Vanilla CSS (Dark Theme Design System).
- **Data Sources**: NASA FIRMS (VIIRS S-NPP / NOAA-20 / NOAA-21), OpenStreetMap Overpass API.

---

## Quick Start Guide

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 2. Backend Setup
```bash
# Clone the repository
git clone <YOUR_GITHUB_REPO_URL>
cd backend-AD

# Install Python dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env and insert your NASA_FIRMS_API_KEY if making live satellite queries

# Start the FastAPI backend server
python -m uvicorn main:app --host 127.0.0.1 --port 8001
```

Backend API documentation is available at `http://127.0.0.1:8001/docs`.

### 3. Frontend Setup
```bash
# In a new terminal, enter the frontend directory
cd frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```

Open `http://localhost:3000` (or `http://localhost:3001`) in your browser to access the command center.

### 4. Running Tests
```bash
# Run backend analytical test suite
pytest test_agnidrishti.py -v
```

---

## License
MIT License
