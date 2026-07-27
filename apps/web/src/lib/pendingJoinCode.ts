// Guarda o código de um /join/:code enquanto o usuário deslogado passa
// pelo login/cadastro (ver JoinEventPage) — o app não tem nenhum
// mecanismo de "volta pra onde eu estava depois do login" hoje
// (ProtectedRoute/GuestRoute sempre redirecionam pra destino fixo), e
// construir isso de forma genérica seria escopo maior que o pedido.
// localStorage (não sessionStorage) porque o login troca de página
// inteira (Navigate), e o QR pode ter sido escaneado abrindo o link
// numa aba/contexto diferente do que termina o cadastro.
const KEY = "easyjudge-pending-join-code";

export function savePendingJoinCode(code: string): void {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  localStorage.setItem(KEY, normalized);
}

// Lê e já limpa — uso único, pra não "vazar" pra um login não
// relacionado numa sessão futura.
export function consumePendingJoinCode(): string | null {
  const code = localStorage.getItem(KEY);
  if (code) localStorage.removeItem(KEY);
  return code;
}
