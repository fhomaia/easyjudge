import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        // Encaminha o upgrade de conexão do Socket.io (cliente conecta
        // em `/api/socket.io`, o rewrite acima já strippa `/api` antes
        // de chegar na API, batendo com o path default `/socket.io` do
        // engine.io) — sem isso o handshake WebSocket não sobe em dev.
        ws: true,
      },
      // arquivos enviados (logos de evento/equipe) são servidos direto
      // pela API em /uploads, fora do prefixo /api — mesmo raciocínio
      // do proxy acima, evita hardcode de localhost:3000 no frontend.
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
