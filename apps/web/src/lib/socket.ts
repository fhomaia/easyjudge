import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "@/store/auth";
import { API_URL } from "@/api/client";

// Em dev (sem VITE_API_URL), conecta same-origin em `/api/socket.io` —
// mesmo proxy do Vite usado pelo REST, que faz `rewrite` strippando
// `/api` antes de chegar na API, batendo com o path default
// `/socket.io` do engine.io do lado do servidor. Em produção,
// VITE_API_URL já aponta direto pro backend (sem proxy de servidor
// possível num build estático), então conecta nele direto, sem prefixo.
const SOCKET_PATH = API_URL ? "/socket.io" : "/api/socket.io";

// Conexão nova por chamada (não singleton global) — cada página do
// painel "evento ao vivo" que usa `useEventLiveSocket` cria/fecha a
// própria conexão no mount/unmount. Mais simples de raciocinar numa
// POC do que gerenciar um socket compartilhado entre navegações; o
// custo é reconectar ao trocar de subpágina do mesmo evento, aceitável.
export function createEventSocket(): Socket | null {
  const accessToken = useAuthStore.getState().accessToken;
  if (!accessToken) return null;

  const options = {
    path: SOCKET_PATH,
    auth: { token: accessToken },
    transports: ["websocket", "polling"],
  };
  return API_URL ? io(API_URL, options) : io(options);
}
