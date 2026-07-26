// Único usuário que pode "entrar como" qualquer outra conta (ver
// AuthService.impersonate) — não é um papel (`UserRole`), é uma
// exceção fixa pro dono da plataforma inspecionar o que cada perfil
// vê sem precisar da senha da pessoa. Comparação sempre em
// lowercase (mesmo padrão de UsersService.findByEmailInsensitive).
export const IMPERSONATOR_EMAIL = 'fhomaia@gmail.com';
