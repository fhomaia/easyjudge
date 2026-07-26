// Mesmo valor de apps/api/src/common/constants/impersonation.ts — só
// pra decidir se mostra o botão de impersonar na UI. A trava de
// verdade é sempre no backend (ver AuthService.impersonate), não aqui;
// duplicado porque não existe pacote de tipos compartilhados ainda
// (ver CLAUDE.md).
export const IMPERSONATOR_EMAIL = "fhomaia@gmail.com";
