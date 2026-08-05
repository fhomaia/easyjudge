// Mesma regra do backend (common/validators/strong-password.validator.ts)
// — validada em tempo real aqui pra o usuário ver o erro assim que
// termina de digitar, sem precisar tentar enviar primeiro. Compartilhado
// entre RegisterDialog (definir senha) e ForgotPasswordPage (redefinir).
export const PASSWORD_RULES: {
  key: string;
  label: string;
  test: (v: string) => boolean;
}[] = [
  { key: "length", label: "Mínimo 8 caracteres", test: (v) => v.length >= 8 },
  { key: "upper", label: "Uma letra maiúscula", test: (v) => /[A-Z]/.test(v) },
  { key: "number", label: "Um número", test: (v) => /\d/.test(v) },
  {
    key: "special",
    label: "Um caractere especial",
    test: (v) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(v),
  },
];

export function isPasswordStrong(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}
