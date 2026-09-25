import { useAuthStore } from "@/store/auth";

// Token vencido (dura 7 dias, ver JwtModule no backend) ou conta
// desativada: a API responde 401 "Unauthorized" (mensagem padrão do
// Passport). Antes disso o app só conferia se EXISTIA token, então a tela
// ficava em "carregando" pra sempre. Encerra a sessão local e guarda onde
// a pessoa estava pra voltar depois do login. sessionStorage: só vale
// nesta aba, e try/catch porque o storage pode estar bloqueado.
const RETURN_TO_KEY = "easyjudge-session-return-to";
const EXPIRED_KEY = "easyjudge-session-expired";

// Só o 401 de autenticação — outras rotas usam 401 com mensagem própria
// ("Senha atual incorreta."), que não pode deslogar ninguém.
export const SESSION_EXPIRED_MESSAGE = "Unauthorized";

export function handleUnauthorized(sentToken: string): void {
  const state = useAuthStore.getState();
  // A sessão já mudou desde o envio (logout, novo login, "ver como").
  if (state.accessToken !== sentToken) return;
  // Token do "ver como" venceu: volta pra própria conta. Se o token
  // original também tiver vencido, o próximo 401 cai no logout abaixo.
  if (state.impersonatorToken) {
    state.stopImpersonation();
    return;
  }
  try {
    sessionStorage.setItem(RETURN_TO_KEY, window.location.pathname + window.location.search);
    sessionStorage.setItem(EXPIRED_KEY, "1");
  } catch {
    // sem storage: só não volta pra tela anterior
  }
  state.logout();
}

// Lido pela tela de login pra mostrar o aviso (não limpa).
export function wasSessionExpired(): boolean {
  try {
    return sessionStorage.getItem(EXPIRED_KEY) === "1";
  } catch {
    return false;
  }
}

// Uso único, depois de logar de novo.
export function consumeSessionReturnTo(): string | null {
  try {
    const path = sessionStorage.getItem(RETURN_TO_KEY);
    sessionStorage.removeItem(RETURN_TO_KEY);
    sessionStorage.removeItem(EXPIRED_KEY);
    return path && path.startsWith("/") && !path.startsWith("/login") ? path : null;
  } catch {
    return null;
  }
}
