import { create } from "zustand";

export type UploadStatus = "uploading" | "done" | "error";

export interface UploadItem {
  id: number;
  label: string;
  status: UploadStatus;
  message?: string;
}

interface UploadsState {
  items: UploadItem[];
  dismiss: (id: number) => void;
}

// Fica FORA da página de propósito: o `fetch` do upload continua depois
// que a tela desmonta (o usuário pode sair pra próxima etapa), então o
// resultado (sucesso/erro) precisa ter onde aparecer em qualquer tela —
// ver UploadStatusBanner, renderizado uma vez em App.tsx.
export const useUploadsStore = create<UploadsState>((set) => ({
  items: [],
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

let nextId = 1;
const DONE_VISIBLE_MS = 4000;

function patch(id: number, changes: Partial<UploadItem>) {
  useUploadsStore.setState((s) => ({
    items: s.items.map((i) => (i.id === id ? { ...i, ...changes } : i)),
  }));
}

// Registra um upload em andamento e devolve o mesmo resultado/erro da
// promessa original (quem chama continua tratando como antes).
// `errorMessage` extrai o texto do erro (ex.: ApiError.message).
export async function trackUpload<T>(
  label: string,
  promise: Promise<T>,
  errorMessage: (err: unknown) => string,
): Promise<T> {
  const id = nextId++;
  useUploadsStore.setState((s) => ({
    items: [...s.items, { id, label, status: "uploading" }],
  }));
  try {
    const result = await promise;
    patch(id, { status: "done" });
    setTimeout(() => useUploadsStore.getState().dismiss(id), DONE_VISIBLE_MS);
    return result;
  } catch (err) {
    // Erro fica até o usuário dispensar — é o único aviso de que o
    // arquivo NÃO chegou, principalmente se ele já saiu da página.
    patch(id, { status: "error", message: errorMessage(err) });
    throw err;
  }
}
