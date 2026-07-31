import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "@/store/auth";

// `/api/socket.io` (não a raiz `/socket.io`) — mesmo prefixo do proxy
// do Vite já usado por toda chamada REST (`api/client.ts`, `API_BASE`),
// que já faz `rewrite` strippando `/api` antes de chegar na API; isso
// bate com o path default `/socket.io` do engine.io do lado do
// servidor, sem precisar de nenhuma config própria lá. Sem host fixo
// (same-origin) — mesmo raciocínio de nunca hardcodar `localhost:3000`
// já usado nos outros proxies (`/api`, `/uploads`).
const SOCKET_PATH = "/api/socket.io";

// Conexão nova por chamada (não singleton global) — cada página do
// painel "evento ao vivo" que usa `useEventLiveSocket` cria/fecha a
// própria conexão no mount/unmount. Mais simples de raciocinar numa
// POC do que gerenciar um socket compartilhado entre navegações; o
// custo é reconectar ao trocar de subpágina do mesmo evento, aceitável.
export function createEventSocket(): Socket | null {
  const accessToken = useAuthStore.getState().accessToken;
  if (!accessToken) return null;

  return io({
    path: SOCKET_PATH,
    auth: { token: accessToken },
    transports: ["websocket", "polling"],
  });
}
