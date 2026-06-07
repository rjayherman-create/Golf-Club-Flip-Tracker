# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  # Golf Flip Tracker

  Golf Flip Tracker is a local-first tool for finding used golf clubs and bags, pricing deals, tracking inventory, and managing sales.

  ## Run locally

  ```bash
  npm install
  npm run server
  npm run dev
  ```

  The app uses a local API server on `http://127.0.0.1:3001` and Vite for the UI.

  ## Live-ready build

  ```bash
  npm run build
  npm run preview
  ```

  Path-based routes are supported through the SPA fallback in `public/_redirects`, so deep links like `/sourcing`, `/lead-form`, and `/lead-analyzer` load correctly on static hosts.

  ## Main routes

  - `/` dashboard
  - `/sourcing` local sourcing radar
  - `/lead-form` add deal
  - `/lead-analyzer` analyze deal
  - `/inventory` inventory
  - `/listings` listing generator
  - `/sales` sales tracker
  - `/sources` source map / source list
  - `/value-guide` brand value guide
  - `/settings` settings

  ## Notes

  - Manual Facebook imports stay separate from automated public-source radar.
  - The dashboard now puts local sourcing first, followed by add deal and analyze.
      reactX.configs['recommended-typescript'],
