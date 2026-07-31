import type { UserProfile, UserRole } from "@/api/client";

export const ROLE_LABELS: Record<UserRole, string> = {
  organization: "Produtor esportivo",
  judge: "Jurado",
  program: "Programa",
  athlete: "Atleta",
};

// "Espectador" não é um UserRole de verdade — no cadastro, quem escolhe
// essa opção também vira role=athlete por trás (só pula as etapas de
// equipe/vínculo de programa, ver RegisterDialog). Existe só pra essa
// tela de cadastro; o rótulo de conta exibido de fato (sidebar) usa
// getAccountLabel abaixo, que decide "Atleta" x "Espectador" a partir do
// vínculo confirmado, não do que foi escolhido no cadastro.
export type SignupRole = UserRole | "spectator";

export const SIGNUP_ROLE_LABELS: Record<SignupRole, string> = {
  ...ROLE_LABELS,
  spectator: "Espectador",
};

// Um atleta sem nenhum vínculo CONFIRMADO com um programa aparece como
// "Espectador" na sidebar — é o que ele é, na prática, até vincular uma
// equipe — independente de ter escolhido "Atleta" ou "Espectador" no
// cadastro. Vínculo pendente de confirmação ainda conta como
// "Espectador" (decisão explícita: só conta depois que o programa
// confirma).
export function getAccountLabel(
  profile: Pick<UserProfile, "role" | "hasConfirmedAthleteLink">,
): string {
  if (profile.role === "athlete" && !profile.hasConfirmedAthleteLink) {
    return "Espectador";
  }
  return ROLE_LABELS[profile.role];
}
