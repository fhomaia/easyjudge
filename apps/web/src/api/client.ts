import { useAuthStore } from "@/store/auth";

// Em dev, sem VITE_API_URL definida, cai pro proxy do Vite (`/api`,
// ver vite.config.ts) — same-origin, sem CORS. Em produção (build
// estático, sem proxy de servidor), VITE_API_URL aponta direto pro
// backend (ex: https://cheercup-api.onrender.com, sem sufixo/rota
// própria — os endpoints da API são montados na raiz, não sob /api).
export const API_URL = import.meta.env.VITE_API_URL as string | undefined;
const API_BASE = API_URL ?? "/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : (data?.message ?? "Erro inesperado. Tente novamente.");
    throw new ApiError(message, res.status);
  }

  return data as T;
}

function authRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const accessToken = useAuthStore.getState().accessToken;
  return request<T>(path, {
    ...options,
    headers: {
      ...options.headers,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
}

// Upload de arquivo (multipart) — não usa request()/authRequest() porque
// aqueles forçam Content-Type: application/json, o que quebraria o
// boundary do FormData (o navegador precisa definir o Content-Type
// sozinho nesse caso).
async function authUpload<T>(path: string, formData: FormData): Promise<T> {
  const accessToken = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: formData,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : (data?.message ?? "Erro inesperado. Tente novamente.");
    throw new ApiError(message, res.status);
  }

  return data as T;
}

export type UserRole = "judge" | "athlete" | "organization" | "program";
export type DocumentType = "cpf" | "cnpj";

export interface RegisterPayload {
  role: UserRole;
  firstName: string;
  lastName: string;
  // Opcional só pra role="athlete" (inclui "espectador" da tela de
  // cadastro, que vira athlete — ver RegisterDialog): só CPF é aceito,
  // e informar é opcional. Demais papéis continuam com CPF/CNPJ
  // obrigatório.
  documentType?: DocumentType;
  documentNumber?: string;
  // Só relevante (e enviado) quando documentType === "cpf" (pedido de
  // LGPD — quem usa CNPJ, uma instituição, não tem data de nascimento).
  birthDate?: string;
  email: string;
  teamOrInstitutionName?: string;
  // Só relevante pra role="athlete" — email do programa a que o atleta
  // quer se vincular (fica pendente de confirmação do programa).
  programEmail?: string;
  // Precisa ser true — RegisterDialog trava o botão de confirmar até o
  // checkbox de Termos de Uso/Política de Privacidade ser marcado.
  acceptedTerms: boolean;
}

export const authApi = {
  register: (payload: RegisterPayload) =>
    request<{ userId: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  verifyEmail: (userId: string, code: string) =>
    request<{ ok: true }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ userId, code }),
    }),

  resendCode: (userId: string) =>
    request<{ ok: true }>(`/auth/resend-code/${userId}`, {
      method: "POST",
    }),

  setPassword: (userId: string, password: string, confirmPassword: string) =>
    request<{ accessToken: string }>("/auth/set-password", {
      method: "POST",
      body: JSON.stringify({ userId, password, confirmPassword }),
    }),

  login: (email: string, password: string) =>
    request<{ accessToken: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  // "Entrar como" outro usuário — restrito a uma única conta no
  // backend (ver AuthService.impersonate); autenticado, por isso usa
  // authRequest (não request como o resto deste objeto, que é
  // pré-login).
  impersonate: (email: string) =>
    authRequest<ImpersonateResponse>("/auth/impersonate", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
};

export interface ImpersonateResponse {
  accessToken: string;
  impersonating: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
  };
}

export interface UserProfile {
  id: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  documentType: DocumentType | null;
  documentNumber: string | null;
  birthDate: string | null;
  hasConfirmedAthleteLink: boolean;
}

// Nome sempre editável; documentNumber/birthDate só valem enquanto o
// usuário ainda não tinha um valor salvo (ver UsersService.updateProfile
// no backend — tentar mudar um valor já preenchido dá 409).
export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  documentType?: DocumentType;
  documentNumber?: string;
  birthDate?: string;
}

export const usersApi = {
  me: () => authRequest<UserProfile>("/users/me"),

  updateProfile: (payload: UpdateProfilePayload) =>
    authRequest<UserProfile>("/users/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  changePassword: (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) =>
    authRequest<void>("/users/me/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    }),

  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return authUpload<UserProfile>("/users/me/avatar", formData);
  },

  removeAvatar: () =>
    authRequest<UserProfile>("/users/me/avatar", { method: "DELETE" }),

  deactivateAccount: (password: string) =>
    authRequest<void>("/users/me/deactivate", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  deleteAccount: (password: string) =>
    authRequest<void>("/users/me/delete", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
};

export type EventStatus = "created" | "published" | "started" | "completed";
export type EventMemberRole =
  "admin" | "assessor" | "judge" | "spectator" | "program" | "athlete";

export interface Event {
  id: string;
  aliasId: string;
  name: string;
  startDate: string;
  competitionDays: number;
  location: string;
  venue: string | null;
  logoUrl: string | null;
  // Código de compartilhamento (QR + texto) — só existe a partir do
  // primeiro publish, estável através das versões (ver
  // EventsService.publishEvent). null pra evento ainda "created", ou
  // já publicado antes desta feature existir (até a próxima
  // republicação).
  eventCode: string | null;
  status: EventStatus;
  startedAt: string | null;
  completedAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  // Papel mais "forte" (admin > assessor > judge > spectator) — telas
  // antigas (Home) só entendem um papel só. `currentUserRoles` (array
  // completo) é o que telas novas devem usar (ver useEventSetupGuard).
  currentUserRole: EventMemberRole;
  currentUserRoles: EventMemberRole[];
  categoriesCount?: number;
  programsCount?: number;
  judgesCount?: number;
  categoriesUpdatedAt?: string | null;
  programsUpdatedAt?: string | null;
}

export interface CreateEventPayload {
  name: string;
  startDate: string;
  // Não é mais coletado no formulário de criação — o número de dias
  // do evento agora é controlado na tela de Cronograma ("+ Dia").
  // Backend aplica default 1 quando omitido.
  competitionDays?: number;
  location: string;
  venue?: string;
}

export type UpdateEventPayload = Partial<CreateEventPayload>;

export type EventActivityAction =
  | "created"
  | "updated"
  | "published"
  | "unpublished"
  | "started"
  | "completed"
  | "deleted"
  | "category_created"
  | "category_updated"
  | "category_deleted"
  | "program_created"
  | "program_updated"
  | "program_deleted"
  | "team_created"
  | "team_updated"
  | "team_deleted"
  | "regulation_document_uploaded"
  | "regulation_document_removed"
  | "regulation_deductions_updated"
  | "staff_member_added"
  | "staff_member_updated"
  | "staff_member_removed"
  | "presentation_moved";

export interface EventActivityLogEntry {
  id: string;
  action: EventActivityAction;
  detail: string | null;
  actorName: string;
  createdAt: string;
}

export const eventsApi = {
  list: () => authRequest<Event[]>("/events"),

  get: (id: string) => authRequest<Event>(`/events/${id}`),

  create: (payload: CreateEventPayload) =>
    authRequest<Event>("/events", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (id: string, payload: UpdateEventPayload) =>
    authRequest<Event>(`/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  publish: (id: string) =>
    authRequest<Event>(`/events/${id}/publish`, { method: "POST" }),

  start: (id: string) =>
    authRequest<Event>(`/events/${id}/start`, { method: "POST" }),

  unpublish: (id: string) =>
    authRequest<Event>(`/events/${id}/unpublish`, { method: "POST" }),

  complete: (id: string) =>
    authRequest<Event>(`/events/${id}/complete`, { method: "POST" }),

  // Resgate de código/QR (ver Event.eventCode) — dá acesso de
  // espectador ao evento pra quem chamou. Sem membership prévia
  // exigida (funciona pra qualquer usuário autenticado).
  joinByCode: (code: string) =>
    authRequest<Event>("/events/join-by-code", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  getActivityLog: (id: string) =>
    authRequest<EventActivityLogEntry[]>(`/events/${id}/activity`),

  remove: (id: string) =>
    authRequest<void>(`/events/${id}`, { method: "DELETE" }),

  uploadLogo: (id: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return authUpload<Event>(`/events/${id}/logo`, formData);
  },

  // Contagem de pessoas por papel no roster — alimenta os cards
  // "Jurados cadastrados"/"Programas cadastrados"/"Espectadores"/
  // "Atletas" do painel Início.
  getMemberCounts: (id: string) =>
    authRequest<Partial<Record<EventMemberRole, number>>>(
      `/events/${id}/member-counts`,
    ),
};

// Roster de acessos do evento ("Gerenciar acessos") — quem faz parte
// do evento e com qual(is) papel(is). Uma pessoa pode ter mais de um
// papel (roles é um array). Jurados já vinculados via Painel de
// Jurados aparecem aqui automaticamente com o papel "judge" (sem
// precisar cadastrar de novo) — ver EventStaffPage.
export interface EventStaffMember {
  id: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  roles: EventMemberRole[];
  isOwner: boolean;
  isPending: boolean;
}

export interface CreateEventStaffMemberPayload {
  firstName: string;
  lastName: string;
  email: string;
  roles: EventMemberRole[];
}

export interface UpdateEventStaffMemberPayload {
  roles: EventMemberRole[];
}

export const eventStaffApi = {
  list: (eventId: string) =>
    authRequest<EventStaffMember[]>(`/events/${eventId}/staff`),

  create: (eventId: string, payload: CreateEventStaffMemberPayload) =>
    authRequest<EventStaffMember>(`/events/${eventId}/staff`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateRoles: (
    eventId: string,
    memberId: string,
    payload: UpdateEventStaffMemberPayload,
  ) =>
    authRequest<EventStaffMember>(`/events/${eventId}/staff/${memberId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  remove: (eventId: string, memberId: string) =>
    authRequest<void>(`/events/${eventId}/staff/${memberId}`, {
      method: "DELETE",
    }),
};

export type CategoryStatus = "active" | "inactive";
export type CategoryModality = "all_star" | "university" | "school";
export type CategoryDivision = "coed" | "all_girl" | "all_boy";
export type CategoryFormat =
  "team_cheer" | "group_stunt" | "coed" | "partner" | "custom";

export interface Category {
  id: string;
  eventId: string;
  name: string;
  modality: CategoryModality;
  division: CategoryDivision;
  categoryFormat: CategoryFormat;
  customFormatLabel: string | null;
  level: number;
  nonTumbling: boolean;
  status: CategoryStatus;
  scoringTemplateId: string | null;
  scoringTemplate: { id: string; name: string } | null;
  presentationTimeSeconds: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryPayload {
  name: string;
  modality: CategoryModality;
  division: CategoryDivision;
  categoryFormat: CategoryFormat;
  customFormatLabel?: string | null;
  level: number;
  nonTumbling: boolean;
  scoringTemplateId: string;
  presentationTimeSeconds: number;
}

export type UpdateCategoryPayload = Partial<CategoryPayload> & {
  status?: CategoryStatus;
};

export const categoriesApi = {
  list: (eventId: string) =>
    authRequest<Category[]>(`/events/${eventId}/categories`),

  create: (eventId: string, payload: CategoryPayload) =>
    authRequest<Category>(`/events/${eventId}/categories`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (eventId: string, id: string, payload: UpdateCategoryPayload) =>
    authRequest<Category>(`/events/${eventId}/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  remove: (eventId: string, id: string) =>
    authRequest<void>(`/events/${eventId}/categories/${id}`, {
      method: "DELETE",
    }),
};

export interface Program {
  id: string;
  eventId: string;
  userId: string | null;
  name: string;
  email: string;
  city: string;
  state: string;
  logoUrl: string | null;
  teamsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProgramPayload {
  name: string;
  email: string;
  city: string;
  state: string;
  userId?: string;
}

export type UpdateProgramPayload = Partial<ProgramPayload>;

export interface ProgramWithTeams extends Program {
  teams: Team[];
}

export interface ProgramCatalogEntry {
  source: "platform" | "own";
  programId?: string;
  userId: string | null;
  name: string;
  email: string;
  city: string | null;
  state: string | null;
  logoUrl: string | null;
  usedByMe?: boolean;
}

export const programsApi = {
  list: (eventId: string) =>
    authRequest<Program[]>(`/events/${eventId}/programs`),

  getCatalog: () => authRequest<ProgramCatalogEntry[]>("/programs/catalog"),

  get: (eventId: string, id: string) =>
    authRequest<ProgramWithTeams>(`/events/${eventId}/programs/${id}`),

  create: (eventId: string, payload: ProgramPayload) =>
    authRequest<Program>(`/events/${eventId}/programs`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (eventId: string, id: string, payload: UpdateProgramPayload) =>
    authRequest<Program>(`/events/${eventId}/programs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  remove: (eventId: string, id: string) =>
    authRequest<void>(`/events/${eventId}/programs/${id}`, {
      method: "DELETE",
    }),

  uploadLogo: (eventId: string, id: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return authUpload<Program>(
      `/events/${eventId}/programs/${id}/logo`,
      formData,
    );
  },
};

// Vínculo atleta<->programa, global (fora de qualquer evento) — ver
// AthleteLink no backend. `hasAccount`/`programResolved` indicam se o
// outro lado já tem conta na plataforma (convite/pedido ainda não
// reclamado); `confirmed` é o que efetivamente libera Notas.
export interface AthleteLinkView {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  programEmail: string;
  hasAccount: boolean;
  programResolved: boolean;
  confirmed: boolean;
  createdAt: string;
}

// Elenco de atletas do PRÓPRIO programa logado — global, não por
// evento (guard @Roles(PROGRAM) no backend).
export const athletesApi = {
  list: () => authRequest<AthleteLinkView[]>("/athletes"),

  create: (payload: { firstName: string; lastName: string; email: string }) =>
    authRequest<AthleteLinkView>("/athletes", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  remove: (id: string) =>
    authRequest<void>(`/athletes/${id}`, { method: "DELETE" }),

  confirm: (id: string) =>
    authRequest<AthleteLinkView>(`/athletes/${id}/confirm`, { method: "POST" }),
};

// "Meus programas" do PRÓPRIO atleta logado — global (guard
// @Roles(ATHLETE) no backend).
export const athleteProgramsApi = {
  list: () => authRequest<AthleteLinkView[]>("/athletes/me/programs"),

  request: (programEmail: string) =>
    authRequest<AthleteLinkView>("/athletes/me/programs", {
      method: "POST",
      body: JSON.stringify({ programEmail }),
    }),

  remove: (linkId: string) =>
    authRequest<void>(`/athletes/me/programs/${linkId}`, { method: "DELETE" }),
};

export interface Team {
  id: string;
  programId: string;
  name: string;
  categories: Category[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamPayload {
  name: string;
}

export interface TeamWithProgram extends Team {
  program: { id: string; name: string };
}

export const teamsApi = {
  list: (eventId: string, programId: string) =>
    authRequest<Team[]>(`/events/${eventId}/programs/${programId}/teams`),

  // Todas as equipes do evento, de qualquer programa — usado pela
  // gaveta de equipes na tabela de categorias.
  listForEvent: (eventId: string) =>
    authRequest<TeamWithProgram[]>(`/events/${eventId}/teams`),

  create: (eventId: string, programId: string, payload: TeamPayload) =>
    authRequest<Team>(`/events/${eventId}/programs/${programId}/teams`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (
    eventId: string,
    programId: string,
    teamId: string,
    payload: TeamPayload,
  ) =>
    authRequest<Team>(
      `/events/${eventId}/programs/${programId}/teams/${teamId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    ),

  remove: (eventId: string, programId: string, teamId: string) =>
    authRequest<void>(
      `/events/${eventId}/programs/${programId}/teams/${teamId}`,
      {
        method: "DELETE",
      },
    ),

  addCategory: (
    eventId: string,
    programId: string,
    teamId: string,
    categoryId: string,
  ) =>
    authRequest<Team>(
      `/events/${eventId}/programs/${programId}/teams/${teamId}/categories`,
      { method: "POST", body: JSON.stringify({ categoryId }) },
    ),

  removeCategory: (
    eventId: string,
    programId: string,
    teamId: string,
    categoryId: string,
  ) =>
    authRequest<Team>(
      `/events/${eventId}/programs/${programId}/teams/${teamId}/categories/${categoryId}`,
      { method: "DELETE" },
    ),
};

export interface Judge {
  id: string;
  eventId: string;
  createdById: string;
  userId: string | null;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface JudgePayload {
  name: string;
  email: string;
  userId?: string;
}

export type UpdateJudgePayload = Partial<JudgePayload>;

export interface JudgeCatalogEntry {
  source: "platform" | "own";
  judgeId?: string;
  userId: string | null;
  name: string;
  email: string;
  usedByMe?: boolean;
}

export const judgesApi = {
  list: (eventId: string) => authRequest<Judge[]>(`/events/${eventId}/judges`),

  getCatalog: () => authRequest<JudgeCatalogEntry[]>("/judges/catalog"),

  get: (eventId: string, id: string) =>
    authRequest<Judge>(`/events/${eventId}/judges/${id}`),

  create: (eventId: string, payload: JudgePayload) =>
    authRequest<Judge>(`/events/${eventId}/judges`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (eventId: string, id: string, payload: UpdateJudgePayload) =>
    authRequest<Judge>(`/events/${eventId}/judges/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  remove: (eventId: string, id: string) =>
    authRequest<void>(`/events/${eventId}/judges/${id}`, { method: "DELETE" }),
};

export type ScoringCriterionType = "group" | "score_item";

export interface ScoringTemplate {
  id: string;
  name: string;
  description: string | null;
  targetScore: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  criteriaCount?: number;
  distributedScore?: number;
  isComplete?: boolean;
  isLocked?: boolean;
  isSystemTemplate: boolean;
  source: string | null;
}

export interface ScoreBand {
  name: string;
  description: string | null;
  color: string;
  min: number;
  max: number;
}

export interface ScoringCriterion {
  id: string;
  templateId: string;
  parentId: string | null;
  type: ScoringCriterionType;
  name: string;
  description: string | null;
  maxScore: number;
  weight: number;
  order: number;
  showInJudgingSheet: boolean;
  allowDecimalScoring: boolean;
  isRequired: boolean;
  useScoreBands: boolean;
  scoreBands: ScoreBand[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScoringTemplatePayload {
  name: string;
  description?: string;
  targetScore?: number;
  cloneFromId?: string;
}

export type UpdateScoringTemplatePayload = Partial<ScoringTemplatePayload>;

export interface CreateScoringCriterionPayload {
  parentId?: string;
  type: ScoringCriterionType;
  name: string;
  description?: string;
  maxScore: number;
  weight?: number;
  showInJudgingSheet?: boolean;
  allowDecimalScoring?: boolean;
  isRequired?: boolean;
  useScoreBands?: boolean;
  scoreBands?: ScoreBand[];
}

// parentId de propósito não entra aqui — reparenting só acontece via
// scoringCriteriaApi.move.
export type UpdateScoringCriterionPayload = Partial<
  Omit<CreateScoringCriterionPayload, "parentId">
>;

export interface MoveScoringCriterionPayload {
  newParentId: string | null;
  newIndex: number;
}

export const scoringTemplatesApi = {
  list: () => authRequest<ScoringTemplate[]>("/scoring-templates"),

  get: (id: string) => authRequest<ScoringTemplate>(`/scoring-templates/${id}`),

  create: (payload: ScoringTemplatePayload) =>
    authRequest<ScoringTemplate>("/scoring-templates", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (id: string, payload: UpdateScoringTemplatePayload) =>
    authRequest<ScoringTemplate>(`/scoring-templates/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  remove: (id: string) =>
    authRequest<void>(`/scoring-templates/${id}`, { method: "DELETE" }),
};

export const scoringCriteriaApi = {
  list: (templateId: string) =>
    authRequest<ScoringCriterion[]>(
      `/scoring-templates/${templateId}/criteria`,
    ),

  create: (templateId: string, payload: CreateScoringCriterionPayload) =>
    authRequest<ScoringCriterion>(`/scoring-templates/${templateId}/criteria`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (
    templateId: string,
    id: string,
    payload: UpdateScoringCriterionPayload,
  ) =>
    authRequest<ScoringCriterion>(
      `/scoring-templates/${templateId}/criteria/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    ),

  remove: (templateId: string, id: string) =>
    authRequest<void>(`/scoring-templates/${templateId}/criteria/${id}`, {
      method: "DELETE",
    }),

  move: (
    templateId: string,
    id: string,
    payload: MoveScoringCriterionPayload,
  ) =>
    authRequest<ScoringCriterion[]>(
      `/scoring-templates/${templateId}/criteria/${id}/move`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
};

export type SpecialJudgeRole = "legality_judge" | "head_judge";
export type BulkAssignStrategy = "unassigned_only" | "replace" | "add";

export interface JudgingDay {
  id: string;
  date: string;
  dayIndex: number;
  resources: Array<{ id: string; name: string }>;
}

export interface CriterionAssignmentsState {
  days: JudgingDay[];
  criterionAssignments: Array<{
    criterionId: string;
    resourceId: string;
    judgeIds: string[];
  }>;
}

// Visão do jurado logado sobre a própria escala (ver JudgingService.
// getMyAssignments no backend) — usada pela tela de Notas pra saber
// quais apresentações do cronograma são "minhas" (lib/judgeSchedule.ts).
export interface JudgeAssignmentsSummary {
  isJudge: boolean;
  specialRoles: SpecialJudgeRole[];
  criterionGroups: string[];
  resourceIds: string[];
  criterionResourceTemplates: Array<{ resourceId: string; templateId: string }>;
}

export const judgingApi = {
  getAssignments: (eventId: string, templateId: string) =>
    authRequest<CriterionAssignmentsState>(
      `/events/${eventId}/judging?templateId=${templateId}`,
    ),

  me: (eventId: string) =>
    authRequest<JudgeAssignmentsSummary>(`/events/${eventId}/judging/me`),

  // Por recurso (2026-07-19) — o jurado de uma função especial (Head
  // Judge, Jurado de Legalidade) não pode estar em duas pistas ao
  // mesmo tempo, mesma razão da atribuição por recurso na árvore de
  // critérios.
  getSpecialRoles: (eventId: string, resourceId: string) =>
    authRequest<Array<{ role: SpecialJudgeRole; judgeIds: string[] }>>(
      `/events/${eventId}/judging/resources/${resourceId}/special-roles`,
    ),

  setCriterionJudges: (
    eventId: string,
    templateId: string,
    criterionId: string,
    resourceId: string,
    judgeIds: string[],
  ) =>
    authRequest<void>(
      `/events/${eventId}/judging/templates/${templateId}/criteria/${criterionId}/resources/${resourceId}/judges`,
      { method: "PUT", body: JSON.stringify({ judgeIds }) },
    ),

  bulkAssign: (
    eventId: string,
    templateId: string,
    criterionId: string,
    resourceId: string,
    judgeParticipationId: string,
    strategy: BulkAssignStrategy,
  ) =>
    authRequest<void>(
      `/events/${eventId}/judging/templates/${templateId}/criteria/${criterionId}/resources/${resourceId}/bulk-assign`,
      {
        method: "POST",
        body: JSON.stringify({ judgeParticipationId, strategy }),
      },
    ),

  setSpecialRoleJudges: (
    eventId: string,
    role: SpecialJudgeRole,
    resourceId: string,
    judgeIds: string[],
  ) =>
    authRequest<void>(
      `/events/${eventId}/judging/resources/${resourceId}/special-roles/${role}`,
      {
        method: "PUT",
        body: JSON.stringify({ judgeIds }),
      },
    ),
};

export type RegulationDeductionMode = "iasf" | "custom";
export type RegulationDocumentKind =
  "official_regulation" | "safety_rules" | "code_of_conduct" | "additional";
export type DeductionType =
  | "athlete_fall"
  | "major_athlete_fall"
  | "building_bobble"
  | "building_fall"
  | "major_building_fall"
  | "legality_infractions"
  | "skill_out_of_level"
  | "time_limit_violations"
  | "boundary_violations";

export interface RegulationDocument {
  id: string;
  kind: RegulationDocumentKind;
  name: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface DeductionRuleView {
  type: DeductionType;
  defaultValue: number;
  value: number;
}

export interface Regulation {
  eventId: string;
  deductionMode: RegulationDeductionMode;
  deductions: DeductionRuleView[];
  documents: RegulationDocument[];
  updatedAt: string | null;
}

export interface UpdateRegulationPayload {
  deductionMode?: RegulationDeductionMode;
  deductionValues?: Partial<Record<DeductionType, number>>;
}

export const regulationApi = {
  get: (eventId: string) =>
    authRequest<Regulation>(`/events/${eventId}/regulation`),

  updateDeductions: (eventId: string, payload: UpdateRegulationPayload) =>
    authRequest<Regulation>(`/events/${eventId}/regulation`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  uploadDocument: (
    eventId: string,
    kind: RegulationDocumentKind,
    file: File,
    name?: string,
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", kind);
    if (name) formData.append("name", name);
    return authUpload<Regulation>(
      `/events/${eventId}/regulation/documents`,
      formData,
    );
  },

  deleteDocument: (eventId: string, documentId: string) =>
    authRequest<void>(`/events/${eventId}/regulation/documents/${documentId}`, {
      method: "DELETE",
    }),
};

export type ScheduleEntryType =
  "presentation" | "warmup" | "break" | "ceremony" | "award";
export type ScheduleDistributionStrategy = "balanced" | "sequential";

export interface ScheduleEntry {
  id: string;
  resourceId: string;
  type: ScheduleEntryType;
  order: number;
  durationMinutes: number;
  teamId: string | null;
  teamName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  linkedEntryId: string | null;
  label: string | null;
  contestationRequestedAt: string | null;
  contestationResolvedAt: string | null;
  withdrawnAt: string | null;
  removedFromSchedule: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleResource {
  id: string;
  scheduleDayId: string;
  name: string;
  color: string | null;
  supportsPresentations: boolean;
  order: number;
  pairedResourceId: string | null;
  entries: ScheduleEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleDay {
  id: string;
  eventId: string;
  dayIndex: number;
  date: string;
  startMinutes: number;
  endMinutes: number;
  defaultWarmupMinutes: number;
  defaultGapMinutes: number;
  ignoreUnscheduledPresentations: boolean;
  resources: ScheduleResource[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateScheduleDayPayload {
  startMinutes?: number;
  endMinutes?: number;
  defaultWarmupMinutes?: number;
  defaultGapMinutes?: number;
  ignoreUnscheduledPresentations?: boolean;
}

export interface CreateScheduleResourcePayload {
  name: string;
  color?: string;
  supportsPresentations?: boolean;
  pairedResourceId?: string;
}

export interface UpdateScheduleResourcePayload {
  name?: string;
  color?: string;
  supportsPresentations?: boolean;
  pairedResourceId?: string | null;
}

export interface MoveScheduleResourcePayload {
  order: number;
}

export interface UnscheduledPair {
  teamId: string;
  teamName: string;
  categoryId: string;
  categoryName: string;
  durationMinutes: number;
}

export interface CreateScheduleEntryPayload {
  resourceId: string;
  type: ScheduleEntryType;
  order: number;
  durationMinutes?: number;
  teamId?: string;
  categoryId?: string;
  label?: string;
}

export interface MoveScheduleEntryPayload {
  resourceId: string;
  order: number;
}

export interface AutoGenerateSchedulePayload {
  startMinutes: number;
  lunchStartMinutes: number;
  lunchDurationMinutes: number;
  warmupMinutes: number;
  distribution: ScheduleDistributionStrategy;
}

export const scheduleApi = {
  listDays: (eventId: string) =>
    authRequest<ScheduleDay[]>(`/events/${eventId}/schedule/days`),

  addDay: (eventId: string) =>
    authRequest<ScheduleDay>(`/events/${eventId}/schedule/days`, {
      method: "POST",
    }),

  updateDay: (
    eventId: string,
    dayId: string,
    payload: UpdateScheduleDayPayload,
  ) =>
    authRequest<ScheduleDay>(`/events/${eventId}/schedule/days/${dayId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  removeDay: (eventId: string, dayId: string) =>
    authRequest<void>(`/events/${eventId}/schedule/days/${dayId}`, {
      method: "DELETE",
    }),

  getUnscheduled: (eventId: string, dayId: string) =>
    authRequest<UnscheduledPair[]>(
      `/events/${eventId}/schedule/days/${dayId}/unscheduled`,
    ),

  createResource: (
    eventId: string,
    dayId: string,
    payload: CreateScheduleResourcePayload,
  ) =>
    authRequest<ScheduleResource>(
      `/events/${eventId}/schedule/days/${dayId}/resources`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),

  updateResource: (
    eventId: string,
    dayId: string,
    resourceId: string,
    payload: UpdateScheduleResourcePayload,
  ) =>
    authRequest<ScheduleResource>(
      `/events/${eventId}/schedule/days/${dayId}/resources/${resourceId}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    ),

  removeResource: (eventId: string, dayId: string, resourceId: string) =>
    authRequest<void>(
      `/events/${eventId}/schedule/days/${dayId}/resources/${resourceId}`,
      {
        method: "DELETE",
      },
    ),

  moveResource: (
    eventId: string,
    dayId: string,
    resourceId: string,
    payload: MoveScheduleResourcePayload,
  ) =>
    authRequest<ScheduleResource[]>(
      `/events/${eventId}/schedule/days/${dayId}/resources/${resourceId}/move`,
      { method: "PATCH", body: JSON.stringify(payload) },
    ),

  createEntry: (
    eventId: string,
    dayId: string,
    payload: CreateScheduleEntryPayload,
  ) =>
    authRequest<ScheduleEntry[]>(
      `/events/${eventId}/schedule/days/${dayId}/entries`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),

  moveEntry: (
    eventId: string,
    dayId: string,
    entryId: string,
    payload: MoveScheduleEntryPayload,
  ) =>
    authRequest<ScheduleEntry>(
      `/events/${eventId}/schedule/days/${dayId}/entries/${entryId}/move`,
      { method: "PATCH", body: JSON.stringify(payload) },
    ),

  removeEntry: (eventId: string, dayId: string, entryId: string) =>
    authRequest<void>(
      `/events/${eventId}/schedule/days/${dayId}/entries/${entryId}`,
      {
        method: "DELETE",
      },
    ),

  autoGenerate: (
    eventId: string,
    dayId: string,
    payload: AutoGenerateSchedulePayload,
  ) =>
    authRequest<ScheduleDay>(
      `/events/${eventId}/schedule/days/${dayId}/auto-generate`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),

  replicateToAllDays: (eventId: string, sourceDayId: string) =>
    authRequest<ScheduleDay[]>(
      `/events/${eventId}/schedule/days/${sourceDayId}/replicate`,
      {
        method: "POST",
      },
    ),
};

// Tela de lançar notas — ver ScoringService no backend. `ScoreEvent` é
// append-only (event sourcing, "notas nunca podem ser perdidas" — ver
// CLAUDE.md); `ScoreEventInput` é o formato gerado NO CLIENTE (id via
// crypto.randomUUID()) e guardado no IndexedDB (lib/scoreEventsDb.ts)
// antes de qualquer tentativa de envio.
export type ScoreEventKind =
  | "score_set"
  | "deduction_add"
  | "deduction_remove"
  | "comment_set"
  | "sketch_set"
  | "sheet_submitted"
  | "timer_started"
  | "timer_stopped"
  | "deduction_code_set";

export interface ScoreEventInput {
  id: string;
  scheduleEntryId: string;
  kind: ScoreEventKind;
  criterionId?: string;
  value?: number;
  deductionType?: DeductionType;
  undoesEventId?: string;
  presentationElapsedMs?: number;
  text?: string;
  clientCreatedAt: string;
}

export interface ScoreEvent extends ScoreEventInput {
  judgeParticipationId: string;
  createdAt: string;
}

export interface ScoringCriterionView {
  id: string;
  name: string;
  description: string | null;
  maxScore: number;
  allowDecimalScoring: boolean;
  order: number;
  useScoreBands: boolean;
  scoreBands: ScoreBand[] | null;
  // Subgrupos intermediários (entre o item e o grupo-raiz, ex:
  // "Stunt"/"Pyramids" dentro de "Building") que têm descrição própria
  // — buildGroups achata a árvore em 2 níveis, então isso é o único
  // jeito de recuperar essa descrição pra exibir junto do item.
  subgroupDescriptions: { name: string; description: string }[];
  // Maior nota atribuída a este critério entre as apresentações da
  // MESMA categoria, com as equipes empatadas nesse valor (mais de uma
  // só em empate real) — `null` quando ainda não há nota pra comparar.
  // Usado só pelo texto compacto do mobile; o slider do desktop usa
  // `teamScores` abaixo.
  bestScore: { value: number; teamNames: string[] } | null;
  // Nota de cada OUTRA equipe da mesma categoria neste critério (exclui
  // a equipe da própria apresentação, já representada pelo polegar do
  // slider) — um marcador por equipe no slider do desktop.
  teamScores: { value: number; teamName: string }[];
}

export interface ScoringGroupView {
  id: string;
  name: string;
  description: string | null;
  criteria: ScoringCriterionView[];
}

export interface ScoringSheet {
  presentation: {
    id: string;
    teamName: string;
    categoryName: string;
    resourceId: string;
    resourceName: string;
    presentationTimeSeconds: number | null;
  };
  groups: ScoringGroupView[];
  isLegalityJudge: boolean;
  isHeadJudge: boolean;
  deductions: DeductionRuleView[];
  events: ScoreEvent[];
  contestationRequested: boolean;
  contestationResolved: boolean;
}

// Painel Head Judge (Modo Supervisão) — ver ScoringService no backend
// (getHeadJudgeRoster/getSheetForJudge/submitEventsAsHeadJudge/
// getChangeLog). Só visível pra quem `ScoringSheet.isHeadJudge` é true.
export type HeadJudgeRosterEntryStatus = "complete" | "incomplete";

export interface HeadJudgeRosterEntry {
  judgeParticipationId: string;
  name: string;
  groups: string[];
  specialRoles: SpecialJudgeRole[];
  status: HeadJudgeRosterEntryStatus;
}

export interface HeadJudgeRoster {
  team: { id: string; name: string };
  judges: HeadJudgeRosterEntry[];
}

export interface HeadJudgeSheet extends ScoringSheet {
  judge: { id: string; name: string };
}

export interface HeadJudgeLogEntry {
  id: string;
  kind: ScoreEventKind;
  judgeParticipationId: string;
  judgeName: string;
  actingJudgeParticipationId: string | null;
  actingJudgeName: string | null;
  criterionId: string | null;
  criterionName: string | null;
  value: number | null;
  deductionType: DeductionType | null;
  undoesEventId: string | null;
  clientCreatedAt: string;
}

// Visão do admin/assessor (leitura, sem edição) e do Programa (só das
// próprias equipes, só depois de liberado) na tela de Notas — ver
// ScoringService.getAdminOverview/buildPresentationDetail no backend.
// Diferente do Painel Head Judge, aqui todos os grupos + legalidade
// aparecem JUNTOS, cada critério com o nome do jurado responsável.
export interface AdminOverviewEntry {
  scheduleEntryId: string;
  teamName: string;
  categoryName: string;
  resourceName: string;
  dayDate: string;
  contestationRequested: boolean;
  contestationResolved: boolean;
  finalResult: number;
  percentage: number;
  withdrawn: boolean;
}

// Liberação global do evento — "Liberar notas"/"Liberar contestação"/
// "Liberar resultado", um switch só por evento (não mais por
// apresentação — ver ScoringService.getReleaseFlags/setReleaseFlags).
export interface ReleaseFlags {
  scoresReleased: boolean;
  contestationReleased: boolean;
  resultsReleased: boolean;
}

// `value` já é a média quando mais de um jurado pontua o mesmo
// critério (ver backend ScoringService.computeAverageScoreByCriterion)
// — por decisão do usuário, esta view não expõe jurado por jurado.
export interface PresentationDetailCriterion extends ScoringCriterionView {
  value: number | null;
}

export interface PresentationDetailGroup {
  id: string;
  name: string;
  criteria: PresentationDetailCriterion[];
}

export interface PresentationDetailLegality {
  judgeName: string;
  deductions: Array<{
    type: DeductionType;
    value: number;
    presentationElapsedMs: number | null;
    clientCreatedAt: string;
  }>;
}

export interface PresentationDetailNote {
  judgeName: string;
  comment: string;
}

export interface PresentationDetail {
  presentation: {
    id: string;
    teamName: string;
    categoryName: string;
    resourceName: string;
  };
  groups: PresentationDetailGroup[];
  legality: PresentationDetailLegality | null;
  notes: PresentationDetailNote[];
  scoresReleased: boolean;
  contestationReleased: boolean;
  contestationRequested: boolean;
}

export interface SetReleaseFlagsPayload {
  scoresReleased?: boolean;
  contestationReleased?: boolean;
  resultsReleased?: boolean;
}

// Página de Resultados — ver ScoringService.getEventResults no
// backend (admin/assessor/jurado sempre veem a apuração de trabalho).
export interface ResultsPresentation {
  scheduleEntryId: string;
  teamId: string;
  teamName: string;
  programId: string;
  programName: string;
  categoryId: string;
  categoryName: string;
  categoryFormat: CategoryFormat;
  totalScore: number;
  deductionsTotal: number;
  finalResult: number;
  maxScore: number;
  percentage: number;
}

export interface ResultsCategory {
  categoryId: string;
  categoryName: string;
  categoryFormat: CategoryFormat;
  teamCount: number;
  presentations: ResultsPresentation[];
  topByPercentage: ResultsPresentation | null;
  topByScore: ResultsPresentation | null;
  averagePercentage: number;
}

export interface ResultsProgram {
  programId: string;
  programName: string;
  totalPoints: number;
  presentationCount: number;
}

export interface EventResults {
  categories: ResultsCategory[];
  presentations: ResultsPresentation[];
  programs: ResultsProgram[];
  topOverall: ResultsPresentation | null;
  topTeamCheer: ResultsPresentation | null;
  topProgram: ResultsProgram | null;
  updatedAt: string;
}

// Resposta pública da página de Resultados (ver ResultsController) —
// admin/assessor/jurado sempre vêm `released: true`; programa/
// espectador só depois que o admin ligar "Liberar resultado" em
// ReleaseFlagsPanel (Event.resultsReleasedAt). `results` vem `null`
// enquanto não liberado.
export interface EventResultsResponse {
  released: boolean;
  results: EventResults | null;
}

export const adminScoringApi = {
  getOverview: (eventId: string) =>
    authRequest<AdminOverviewEntry[]>(
      `/events/${eventId}/scoring/admin/overview`,
    ),

  getDetail: (eventId: string, scheduleEntryId: string) =>
    authRequest<PresentationDetail>(
      `/events/${eventId}/scoring/admin/${scheduleEntryId}`,
    ),

  getRelease: (eventId: string) =>
    authRequest<ReleaseFlags>(`/events/${eventId}/scoring/admin/release`),

  setRelease: (eventId: string, payload: SetReleaseFlagsPayload) =>
    authRequest<ReleaseFlags>(`/events/${eventId}/scoring/admin/release`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};

export const resultsApi = {
  get: (eventId: string) =>
    authRequest<EventResultsResponse>(`/events/${eventId}/scoring/results`),
};

export const teamScoringApi = {
  getOverview: (eventId: string) =>
    authRequest<AdminOverviewEntry[]>(
      `/events/${eventId}/scoring/team/overview`,
    ),

  getDetail: (eventId: string, scheduleEntryId: string) =>
    authRequest<PresentationDetail>(
      `/events/${eventId}/scoring/team/${scheduleEntryId}`,
    ),

  contest: (eventId: string, scheduleEntryId: string) =>
    authRequest<void>(
      `/events/${eventId}/scoring/team/${scheduleEntryId}/contest`,
      {
        method: "POST",
      },
    ),

  // Ids das próprias equipes neste evento — usado pelo cronograma
  // (EventLiveSchedulePage) pra decidir em quais linhas mostrar
  // "Sinalizar desistência" (só nas apresentações do próprio programa).
  getMyTeamIds: (eventId: string) =>
    authRequest<string[]>(`/events/${eventId}/scoring/team/my-team-ids`),
};

// Visão do Atleta na tela de Notas — igual à do Programa, mas
// filtrada pelos times de todo programa com vínculo CONFIRMADO (ver
// ScoringService.getAthleteOverview). `locked: true` = ainda sem
// nenhum vínculo confirmado que participe deste evento (ou notas
// ainda não liberadas) — a tela mostra um aviso em vez da lista.
export const athleteScoringApi = {
  getOverview: (eventId: string) =>
    authRequest<{ locked: boolean; entries: AdminOverviewEntry[] }>(
      `/events/${eventId}/scoring/athlete/overview`,
    ),

  getDetail: (eventId: string, scheduleEntryId: string) =>
    authRequest<PresentationDetail>(
      `/events/${eventId}/scoring/athlete/${scheduleEntryId}`,
    ),
};

export const scoringApi = {
  getSheet: (eventId: string, scheduleEntryId: string) =>
    authRequest<ScoringSheet>(
      `/events/${eventId}/scoring/sheet/${scheduleEntryId}`,
    ),

  // Ids das apresentações que o jurado logado já marcou como enviadas
  // (clicou "Lançar notas") — alimenta a badge "Concluída" da tela de
  // Notas (ver EventLiveNotesPage/lib/judgeSchedule.ts).
  getMySubmissions: (eventId: string) =>
    authRequest<string[]>(`/events/${eventId}/scoring/me/submissions`),

  // Jurado marca a contestação desta apresentação como resolvida — ver
  // ScoringService.resolveContestation.
  resolveContestation: (eventId: string, scheduleEntryId: string) =>
    authRequest<void>(
      `/events/${eventId}/scoring/sheet/${scheduleEntryId}/resolve-contestation`,
      {
        method: "POST",
      },
    ),

  // Horário real de início (primeiro TIMER_STARTED) de cada
  // apresentação já iniciada — usado pra calcular o atraso do evento
  // (ver EventLiveDashboardPage, que já tem a hora AGENDADA de cada
  // apresentação via computeEventLiveSchedule/scheduleTime.ts).
  getStartedPresentations: (eventId: string) =>
    authRequest<Array<{ scheduleEntryId: string; startedAt: string }>>(
      `/events/${eventId}/scoring/started-presentations`,
    ),

  // Ids das apresentações já 100% pontuadas — usado pelo cronograma ao
  // vivo (computeEventLiveSchedule) pra não continuar mostrando uma
  // apresentação já concluída como "próxima" só porque o horário
  // AGENDADO ainda não passou (jurados podem terminar mais rápido que
  // a duração planejada).
  getCompletedPresentations: (eventId: string) =>
    authRequest<string[]>(`/events/${eventId}/scoring/completed-presentations`),

  submitEvents: (eventId: string, events: ScoreEventInput[]) =>
    authRequest<{ savedIds: string[] }>(`/events/${eventId}/scoring/events`, {
      method: "POST",
      body: JSON.stringify({ events }),
    }),

  // Fluxo de desistência — admin/assessor (qualquer apresentação) ou
  // programa (só das próprias equipes). `removeFromSchedule` só tem
  // efeito pra admin/assessor (ver ScoringService.withdrawPresentation).
  withdrawPresentation: (
    eventId: string,
    scheduleEntryId: string,
    payload: { removeFromSchedule?: boolean },
  ) =>
    authRequest<void>(
      `/events/${eventId}/scoring/entries/${scheduleEntryId}/withdraw`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),

  headJudge: {
    getRoster: (eventId: string, scheduleEntryId: string) =>
      authRequest<HeadJudgeRoster>(
        `/events/${eventId}/scoring/head-judge/${scheduleEntryId}/roster`,
      ),

    getSheet: (
      eventId: string,
      scheduleEntryId: string,
      judgeParticipationId: string,
    ) =>
      authRequest<HeadJudgeSheet>(
        `/events/${eventId}/scoring/head-judge/${scheduleEntryId}/judges/${judgeParticipationId}/sheet`,
      ),

    submitEvents: (
      eventId: string,
      scheduleEntryId: string,
      judgeParticipationId: string,
      events: ScoreEventInput[],
    ) =>
      authRequest<{ savedIds: string[] }>(
        `/events/${eventId}/scoring/head-judge/${scheduleEntryId}/judges/${judgeParticipationId}/events`,
        { method: "POST", body: JSON.stringify({ events }) },
      ),

    getLog: (eventId: string, scheduleEntryId: string) =>
      authRequest<HeadJudgeLogEntry[]>(
        `/events/${eventId}/scoring/head-judge/${scheduleEntryId}/log`,
      ),
  },
};

export type NotificationType =
  | "presentation_started"
  | "presentation_completed"
  | "scores_released"
  | "results_released"
  | "contestation_released"
  | "evaluation_pending"
  | "contestation_requested"
  | "presentation_cancelled"
  | "presentation_moved";

export interface NotificationView {
  id: string;
  type: NotificationType;
  title: string;
  scheduleEntryId: string | null;
  createdAt: string;
}

export const notificationsApi = {
  list: (eventId: string) =>
    authRequest<{ notifications: NotificationView[]; unreadCount: number }>(
      `/events/${eventId}/notifications`,
    ),

  markSeen: (eventId: string) =>
    authRequest<void>(`/events/${eventId}/notifications/seen`, {
      method: "POST",
    }),
};

export const supportApi = {
  contact: (message: string) =>
    authRequest<void>("/support/contact", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};
