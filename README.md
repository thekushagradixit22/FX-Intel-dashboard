# FX-Intel | Decision Support System v2.4

An institutional-grade, single-page algorithmic trading intelligence dashboard built using **React**, **Vite**, and **Tailwind CSS**. **FX-Intel** processes real-time simulated market feeds to deliver high-fidelity predictive analytics, machine learning signals, and key technical indicators for major currency pairs (EUR/USD, GBP/USD, USD/JPY).

---

## 🚀 Key Features Visualized

* **Dynamic Candlestick Charting:** Real-time simulated price action plotting open, high, low, and close points alongside automated **BUY** and **SELL** signal overlays.
* **Live Indicator Stream:** Real-time tracking of foundational oscillators and indicators including **RSI (14)**, **MACD (12, 26, 9)**, **Stochastic %K**, and **ATR (14)**.
* **Predictive Signal Engine:** A dedicated ML module displaying directional confidence percentages (e.g., *Bearish Continuation*) and overall system recommendations.
* **Feature Importance Breakdown:** Dynamic progress bars mapping out the weight distribution of core market drivers (Moving Averages, RSI, MACD, and Fibonacci Levels).
* **Quant Metrics Summary:** Embedded performance tracking showcasing a client-side **Random Forest Classifier** configuration with an $84.2\%$ accuracy score and a $2.1$ Sharpe Ratio.
* **Actionable Trade Setups:** Automated generation of structural parameters including Entry Zones, Stop Loss thresholds, and Risk/Reward ratios.

---

## 🛠️ Project Structure

```text
fx-intel-dashboard/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx              # React mounting and entry point
    ├── App.jsx                # Layout shell wrapper
    ├── FXIntelDashboard.jsx   # Core dashboard UI, chart layouts, and ML engine simulation
    └── index.css              # Tailwind CSS directives & custom utility animations
💻 Getting Started
Run It Locally
Clone the repository and navigate into the project directory:

Bash
cd fx-intel-dashboard
Install the necessary dependencies:

Bash
npm install
Boot up the Vite local development server:

Bash
npm run dev
Open the local address printed by Vite in your browser (typically http://localhost:5173).

📦 Version Control & Deployment
Push to GitHub
Create an empty repository on GitHub, then run the following commands in your terminal:

Bash
git init
git add .
git commit -m "Initial commit: FX-Intel dashboard v2.4 core"
git branch -M main
git remote add origin [https://github.com/](https://github.com/)<your-username>/<your-repo>.git
git push -u origin main
Make It Live
⚡ Option A — Vercel (Recommended)
Head to Vercel and log in with your GitHub account.

Click Add New Project and import your fx-intel-dashboard repository.

Vercel automatically configures Vite settings. Leave defaults as-is:

Build Command: npm run build

Output Directory: dist

Click Deploy. Your live production link will be ready in under a minute!

🌌 Option B — Netlify
Go to Netlify → Add new site → Import an existing project.

Connect your GitHub profile and pick your repository.

Configure your build settings: set Build command to npm run build and Publish directory to dist.

Click Deploy.

🐙 Option C — GitHub Pages
Install the deployment helper package as a development dependency:

Bash
npm install --save-dev gh-pages
Open your package.json file and append these deployments to your scripts block:

JSON
"scripts": {
  "predeploy": "npm run build",
  "deploy": "gh-pages -d dist"
}
Open vite.config.js, uncomment or add the base property, and point it to your repository name:

JavaScript
export default defineConfig({
  base: '/<your-repo-name>/',
  // ... other configs
})
Execute the deployment script:

Bash
npm run deploy
Navigate to your GitHub Repository Settings → Pages, and toggle the source branch to gh-pages. Your dashboard will drop live at https://<your-username>.github.io/<your-repo-name>/.
