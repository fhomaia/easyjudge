// Idade mínima de 13 anos (ver CLAUDE.md, "Data de nascimento...") —
// usado tanto no cadastro (RegisterDialog) quanto em "Meu perfil"
// (ProfilePage, preenchimento tardio pra quem pulou no cadastro).
export function getMaxBirthDate(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 13);
  return d;
}
