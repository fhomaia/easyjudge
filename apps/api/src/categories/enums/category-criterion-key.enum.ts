// Critérios de divisão de categoria (2026-10-06). A lista é fixa da
// plataforma: o produtor liga/desliga, ordena e cria opções dentro de
// cada um, mas não cria critério novo. A modalidade (categoryFormat)
// não entra aqui: é sempre obrigatória.
export enum CategoryCriterionKey {
  INSTITUTION = 'institution',
  REGIME = 'regime',
  AGE_GROUP = 'age_group',
  GENDER = 'gender',
  LEVEL = 'level',
  SIZE = 'size',
}
