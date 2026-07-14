// DTOs validados pelo ValidationPipe global (transform: true) viram
// instâncias de classe via class-transformer. Com o alvo TS >= ES2022,
// campos opcionais declarados na classe (ex: `name?: string`) compilam
// para propriedades próprias inicializadas como `undefined` — mesmo
// quando o campo não veio no body da requisição. Um `Object.assign(
// entity, dto)` direto sobrescreve os campos não enviados com
// `undefined` (silenciosamente, já que TypeORM ignora colunas
// `undefined` no UPDATE gerado, mas o objeto em memória — e a resposta
// JSON — fica com esses campos ausentes). Usar antes de mesclar um DTO
// parcial numa entidade.
export function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
