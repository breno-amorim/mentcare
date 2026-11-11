import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.tsx'
import { AuthProvider } from './app/AuthContext.tsx'
import { ToastProvider } from './app/ToastContext.tsx'
import { setBackend } from './data/backend.ts'
import { createMemoryBackend } from './data/memoryBackend.ts'
import { createSupabaseBackend } from './data/supabaseBackend.ts'
import './index.css'

// Com URL e chave públicas do Supabase configuradas, usa o banco real.
// Sem elas, cai no modo demonstração (dados no navegador).
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
setBackend(url && anonKey ? createSupabaseBackend(url, anonKey) : createMemoryBackend())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  </StrictMode>,
)
