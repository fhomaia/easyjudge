export enum RegulationDocumentKind {
  OFFICIAL_REGULATION = 'official_regulation',
  SAFETY_RULES = 'safety_rules',
  CODE_OF_CONDUCT = 'code_of_conduct',
  ADDITIONAL = 'additional',
}

// Só um documento ativo por vez pra esses 3 — reenviar substitui o
// anterior (ver RegulationsService.uploadDocument). ADDITIONAL não
// entra aqui porque aceita múltiplos documentos.
export const SINGLE_SLOT_DOCUMENT_KINDS = [
  RegulationDocumentKind.OFFICIAL_REGULATION,
  RegulationDocumentKind.SAFETY_RULES,
  RegulationDocumentKind.CODE_OF_CONDUCT,
];
