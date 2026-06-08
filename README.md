# Golf Flip Tracker

Golf Flip Tracker is a standalone local-first app for finding used golf club deals, checking resale value, tracking inventory, creating listings, and recording profit.

## Run Locally

```bash
npm install
npm run server
npm run dev
```

The local API runs on `http://127.0.0.1:3001`. The Vite UI usually runs on `http://127.0.0.1:5173`, or the next open Vite port.

## Production Build

```bash
npm run build
npm start
```

`npm start` serves the built app and API from the local Node server.

## Main Routes

- `/` dashboard and quick actions
- `/source-deals` sourcing hub for lead inbox, Facebook import, public scans, follow-ups, and sourcing settings
- `/add-club` structured club/deal entry
- `/identify-from-photo` photo-based club identification workflow
- `/value-checker` manual comp and buy-threshold calculator
- `/inventory` inventory and bundle tracking
- `/listings` Facebook listing generator
- `/sold-profit` sale and profit tracking
- `/csv-export` reseller report downloads
- `/settings` profile, region, defaults, backups, and roadmap

## Notes

- Sourcing is the primary workflow. Start in `/source-deals`, verify photos and comps, then move good buys into inventory.
- Facebook import is manual and compliant: paste listing URLs or details rather than scraping.
- Photo identification uses the local API. If `OPENAI_API_KEY` is missing, the server returns a fallback result so the flow remains testable.
- Data is stored locally in browser storage and mirrored to `data/db.json` when the API server is running.
