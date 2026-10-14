import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { NotificationProvider } from './context/NotificationContext.jsx'
import './styles/tokens.css'
import './styles/components.css'

// Every deploy replaces the hashed chunk files. A tab opened before a deploy
// still points at the old names, so the first lazy page it opens (e.g.
// /roles) fails to fetch and the page never loads. Vite raises this event for
// that failure; one reload picks up the new index.html and chunk names. The
// timestamp guard stops a genuinely broken deploy from reload-looping.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  try {
    const last = Number(sessionStorage.getItem('mellow_chunk_reload_at') || 0)
    if (Date.now() - last < 15000) return
    sessionStorage.setItem('mellow_chunk_reload_at', String(Date.now()))
  } catch {
    // sessionStorage can be unavailable (private windows); reloading once
    // unguarded is still better than a dead page.
  }
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </AuthProvider>
      <Analytics />
    </BrowserRouter>
  </React.StrictMode>,
)
