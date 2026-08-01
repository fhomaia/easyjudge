import type { PresentationDetail } from "@/api/client";

// "Hit zero" (termo do cheer): a apresentação teve legalidade
// acompanhada (existe jurado de legalidade atribuído à pista) E
// nenhuma dedução foi registrada. `legality === null` não conta como
// zero — não é uma comemoração de verdade, é ausência de dado (não
// havia jurado de legalidade pra essa apresentação). Compartilhado
// entre a celebração na tela (PresentationNotesDetail) e o selo no PDF
// (presentationDetailExport), pra não duplicar a regra nos dois.
export function isPresentationHitZero(detail: PresentationDetail): boolean {
  return detail.legality !== null && detail.legality.deductions.length === 0;
}
