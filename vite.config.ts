import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { powerApps } from '@microsoft/power-apps-vite/plugin'

// https://vite.dev/config/
export default defineConfig({
  // Le plugin powerApps() gère le chemin relatif des assets (base: './'),
  // le middleware du serveur de dev et l'intégration avec la plateforme Power Apps.
  plugins: [react(), powerApps()],
  build: {
    // Inline les petits assets (logo Afriland ~10 KB, favicon, etc.) comme
    // data: URL directement dans le JS — supprime toute dépendance à la
    // résolution de chemin par le wrapper Power Apps player.
    assetsInlineLimit: 32_768, // 32 KB
    // Sourcemaps désactivés : on évite plusieurs centaines de Mo de mémoire
    // pendant la phase rendering (jsPDF + autotable + xlsx sont massifs).
    sourcemap: false,
    // Isole les libs PDF/Excel dans des chunks dédiés, séparés du bundle
    // principal — réduit le coût mémoire de minification et accélère le
    // démarrage tant qu'aucun rapport n'est demandé.
    rollupOptions: {
      output: {
        // Forme fonctionnelle (object form non typée par les .d.ts Vite 8).
        manualChunks(id: string) {
          if (id.includes('node_modules/xlsx')) return 'export-xlsx';
          if (id.includes('node_modules/jspdf')) return 'export-pdf';
          return undefined;
        },
      },
    },
    // Limite d'alerte plus généreuse — xlsx fait à lui seul ~800 KB minified.
    chunkSizeWarningLimit: 1500,
  },
})
