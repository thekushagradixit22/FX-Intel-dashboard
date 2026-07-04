# FX-Intel | Decision Support System v2.4

A premium, single-page mock trading dashboard built with React, Vite, and Tailwind CSS.
All data is simulated client-side — there is no real market feed.

## Run it locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Push it to GitHub

```bash
cd fx-intel-dashboard
git init
git add .
git commit -m "Initial commit: FX-Intel dashboard"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

(Create the empty repo on GitHub first at github.com/new, then swap in its URL above.)

## Make it live

### Option A — Vercel (recommended, zero config)
1. Go to vercel.com and sign in with your GitHub account.
2. Click "Add New Project" and import the repo you just pushed.
3. Vercel auto-detects Vite — leave the defaults (build command `npm run build`, output dir `dist`).
4. Click Deploy. You'll get a live URL in about a minute, and every future push to `main` auto-redeploys.

### Option B — Netlify
1. Go to netlify.com → "Add new site" → "Import an existing project" → pick your repo.
2. Build command: `npm run build`, publish directory: `dist`.
3. Deploy.

### Option C — GitHub Pages
1. Install the deploy helper: `npm install --save-dev gh-pages`
2. In `package.json`, add:
   ```json
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d dist"
   }
   ```
3. In `vite.config.js`, uncomment the `base` line and set it to `'/<your-repo-name>/'`.
4. Run `npm run deploy`.
5. In your GitHub repo settings → Pages, set the source to the `gh-pages` branch.
6. Your site will be live at `https://<your-username>.github.io/<your-repo-name>/`.

## Project structure

```
fx-intel-dashboard/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx              # React entry point
    ├── App.jsx                # Renders the dashboard
    ├── FXIntelDashboard.jsx   # The dashboard itself
    └── index.css              # Tailwind directives
```
