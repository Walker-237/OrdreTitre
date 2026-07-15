import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { setConfig } from '@microsoft/power-apps/app'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth'
import { RbacProvider } from './rbac'
import { StoreProvider } from './data/store'

// Init du SDK Power Apps — handshake avec le player. En mode local (Vite dev
// hors du flux apps.powerapps.com/.../a/local), c'est un no-op.
setConfig({})

// HashRouter : Code App Power Apps = SPA statique sans réécriture d'URL.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <RbacProvider>
        <AuthProvider>
          <StoreProvider>
            <App />
          </StoreProvider>
        </AuthProvider>
      </RbacProvider>
    </HashRouter>
  </StrictMode>,
)
