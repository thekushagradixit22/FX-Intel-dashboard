import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// If you deploy to GitHub Pages under a repo subpath (username.github.io/repo-name),
// uncomment and set base to '/repo-name/'. Vercel/Netlify don't need this.
export default defineConfig({
  plugins: [react()],
  // base: '/fx-intel-dashboard/',
})
