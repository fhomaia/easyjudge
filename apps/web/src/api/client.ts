import { useAuthStore } from "@/store/auth";

const API_BASE = "/api";

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
  documentType: DocumentType;
  documentNumber: string;
  email: string;
  teamOrInstitutionName?: string;
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
};

export interface UserProfile {
  id: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  email: string;
}

export const usersApi = {
  me: () => authRequest<UserProfile>("/users/me"),
};

export type EventStatus = "created" | "published" | "started" | "completed";
export type EventMemberRole = "admin" | "judge" | "participant" | "spectator";

export interface Event {
  id: string;
  aliasId: string;
  name: string;
  startDate: string;
  competitionDays: number;
  location: string;
  logoUrl: string | null;
  status: EventStatus;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  currentUserRole: EventMemberRole;
  categoriesCount?: number;
  programsCount?: number;
  categoriesUpdatedAt?: string | null;
  programsUpdatedAt?: string | null;
}

export interface CreateEventPayload {
  name: string;
  startDate: string;
  competitionDays: number;
  location: string;
}

export type UpdateEventPayload = Partial<CreateEventPayload>;

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

  remove: (id: string) =>
    authRequest<void>(`/events/${id}`, { method: "DELETE" }),

  uploadLogo: (id: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return authUpload<Event>(`/events/${id}/logo`, formData);
  },
};

export type CategoryStatus = "active" | "inactive";
export type CategoryModality = "all_star" | "university" | "school";
export type CategoryDivision = "coed" | "all_girl" | "all_boy";
export type CategoryFormat = "team_cheer" | "group_stunt" | "coed" | "partner" | "custom";

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
  list: (eventId: string) => authRequest<Category[]>(`/events/${eventId}/categories`),

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
    authRequest<void>(`/events/${eventId}/categories/${id}`, { method: "DELETE" }),
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
  list: (eventId: string) => authRequest<Program[]>(`/events/${eventId}/programs`),

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
    authRequest<void>(`/events/${eventId}/programs/${id}`, { method: "DELETE" }),

  uploadLogo: (eventId: string, id: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return authUpload<Program>(`/events/${eventId}/programs/${id}/logo`, formData);
  },
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

export const teamsApi = {
  list: (eventId: string, programId: string) =>
    authRequest<Team[]>(`/events/${eventId}/programs/${programId}/teams`),

  create: (eventId: string, programId: string, payload: TeamPayload) =>
    authRequest<Team>(`/events/${eventId}/programs/${programId}/teams`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (eventId: string, programId: string, teamId: string, payload: TeamPayload) =>
    authRequest<Team>(`/events/${eventId}/programs/${programId}/teams/${teamId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  remove: (eventId: string, programId: string, teamId: string) =>
    authRequest<void>(`/events/${eventId}/programs/${programId}/teams/${teamId}`, {
      method: "DELETE",
    }),

  addCategory: (eventId: string, programId: string, teamId: string, categoryId: string) =>
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

  get: (eventId: string, id: string) => authRequest<Judge>(`/events/${eventId}/judges/${id}`),

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

  remove: (id: string) => authRequest<void>(`/scoring-templates/${id}`, { method: "DELETE" }),
};

export const scoringCriteriaApi = {
  list: (templateId: string) =>
    authRequest<ScoringCriterion[]>(`/scoring-templates/${templateId}/criteria`),

  create: (templateId: string, payload: CreateScoringCriterionPayload) =>
    authRequest<ScoringCriterion>(`/scoring-templates/${templateId}/criteria`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (templateId: string, id: string, payload: UpdateScoringCriterionPayload) =>
    authRequest<ScoringCriterion>(`/scoring-templates/${templateId}/criteria/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  remove: (templateId: string, id: string) =>
    authRequest<void>(`/scoring-templates/${templateId}/criteria/${id}`, {
      method: "DELETE",
    }),

  move: (templateId: string, id: string, payload: MoveScoringCriterionPayload) =>
    authRequest<ScoringCriterion[]>(`/scoring-templates/${templateId}/criteria/${id}/move`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export type SpecialJudgeRole = "legality_judge" | "head_judge";
export type BulkAssignStrategy = "unassigned_only" | "replace" | "add";

export interface CriterionAssignmentsState {
  criterionAssignments: Array<{ criterionId: string; judgeIds: string[] }>;
  specialRoles: Array<{ role: SpecialJudgeRole; judgeIds: string[] }>;
}

export const judgingApi = {
  getAssignments: (eventId: string, templateId: string) =>
    authRequest<CriterionAssignmentsState>(
      `/events/${eventId}/judging?templateId=${templateId}`,
    ),

  getSpecialRoles: (eventId: string) =>
    authRequest<Array<{ role: SpecialJudgeRole; judgeIds: string[] }>>(
      `/events/${eventId}/judging/special-roles`,
    ),

  setCriterionJudges: (
    eventId: string,
    templateId: string,
    criterionId: string,
    judgeIds: string[],
  ) =>
    authRequest<void>(
      `/events/${eventId}/judging/templates/${templateId}/criteria/${criterionId}/judges`,
      { method: "PUT", body: JSON.stringify({ judgeIds }) },
    ),

  bulkAssign: (
    eventId: string,
    templateId: string,
    criterionId: string,
    judgeParticipationId: string,
    strategy: BulkAssignStrategy,
  ) =>
    authRequest<void>(
      `/events/${eventId}/judging/templates/${templateId}/criteria/${criterionId}/bulk-assign`,
      { method: "POST", body: JSON.stringify({ judgeParticipationId, strategy }) },
    ),

  setSpecialRoleJudges: (eventId: string, role: SpecialJudgeRole, judgeIds: string[]) =>
    authRequest<void>(`/events/${eventId}/judging/special-roles/${role}`, {
      method: "PUT",
      body: JSON.stringify({ judgeIds }),
    }),
};

export type RegulationDeductionMode = "iasf" | "custom";
export type RegulationDocumentKind =
  | "official_regulation"
  | "safety_rules"
  | "code_of_conduct"
  | "additional";
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
  get: (eventId: string) => authRequest<Regulation>(`/events/${eventId}/regulation`),

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
    return authUpload<Regulation>(`/events/${eventId}/regulation/documents`, formData);
  },

  deleteDocument: (eventId: string, documentId: string) =>
    authRequest<void>(`/events/${eventId}/regulation/documents/${documentId}`, {
      method: "DELETE",
    }),
};
