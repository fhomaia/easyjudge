import { useEffect } from "react";

// Enquanto `active`, o navegador pergunta "Sair do site?" ao fechar a
// aba, recarregar ou digitar outra URL — situações em que um upload em
// andamento seria cancelado. O texto da pergunta é do próprio navegador
// (não dá pra personalizar). Navegar entre telas DENTRO do app não
// precisa disso: o `fetch` do upload continua rodando mesmo depois da
// página desmontar.
export function useBeforeUnloadWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Chrome exige returnValue definido pra exibir o aviso.
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}
