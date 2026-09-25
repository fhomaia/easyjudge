import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// Depois de um deploy, uma aba aberta ainda conhece os nomes ANTIGOS dos
// arquivos de cada tela (code-splitting, nome com hash). Ao abrir uma tela
// ainda não carregada, o arquivo antigo não existe mais, o Cloudflare
// devolve o index.html (fallback de SPA) e a tela fica em branco
// ("Failed to fetch dynamically imported module"). Recarregar busca a
// versão nova. Trava de 10s pra não entrar em loop se o erro for outro
// (ex.: sem rede). Notas pendentes do jurado ficam no IndexedDB.
const RELOAD_KEY = 'easyjudge-chunk-reload-at'
window.addEventListener('vite:preloadError', (event) => {
  let last = 0
  try {
    last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
  } catch {
    // sem storage: segue sem a trava
  }
  if (Date.now() - last < 10_000) return
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // idem
  }
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
