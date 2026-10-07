import type { ReactNode } from "react";
import { UserRound, Users } from "lucide-react";
import type { RegistrationIssue } from "@/api/client";

interface IssueTeam {
  id: string;
  name: string;
  categories: { id: string; name: string }[];
}

const afterColon = (message: string) => message.slice(message.indexOf(": ") + 2);
export const issueSubject = (message: string) => message.slice(0, message.indexOf(": "));
const isAthleteData = (i: RegistrationIssue) =>
  i.kind === "missing_requirement" || i.kind === "missing_document";

// Texto de um item de pendência dentro do grupo da equipe+categoria:
// "Atleta: motivo" (ou só o motivo). Pendência de crossover ganha uma
// etiqueta pra dizer de onde vem (regras do Regulamento).
export function IssueText({ issue }: { issue: RegistrationIssue }) {
  let text = afterColon(issue.message);
  if (!isAthleteData(issue) && issue.athleteId) {
    text = `${issue.message.slice(0, issue.message.indexOf(", "))}: ${text}`;
  }
  return (
    <>
      {issue.kind === "crossover" && (
        <span className="mr-1.5 inline-block rounded-full bg-violet-500/15 px-2 py-0.5 align-[1px] text-[11px] font-medium text-violet-700 dark:text-violet-300">
          Crossover
        </span>
      )}
      {text}
    </>
  );
}

// Pendências de uma ficha de inscrição, agrupadas: primeiro por
// equipe+categoria (número de atletas, idade, data de nascimento), depois
// por atleta (dados e documentos que faltam). Usado na ficha do programa e
// na aba Pendências do produtor. As mensagens vêm prontas da API ("Equipe
// em Categoria: ...", "Atleta, Equipe em Categoria: ...", "Atleta: falta
// ..."); aqui só se separa o prefixo, que vira o título do grupo. `renderActions`
// acrescenta botões/campos em cada item (ex.: "Preencher").
export function RegistrationIssueGroups({
  issues,
  teams,
  renderActions,
}: {
  issues: RegistrationIssue[];
  teams: IssueTeam[];
  renderActions?: (issue: RegistrationIssue) => ReactNode;
}) {
  // Por equipe+categoria, na ordem em que aparecem.
  const pairGroups = new Map<
    string,
    { title: string; category: string | null; items: RegistrationIssue[] }
  >();
  for (const issue of issues.filter((i) => !isAthleteData(i))) {
    const key = `${issue.teamId}:${issue.categoryId}`;
    const team = teams.find((t) => t.id === issue.teamId);
    const category = team?.categories.find((c) => c.id === issue.categoryId);
    const head = issueSubject(issue.message);
    const group = pairGroups.get(key) ?? {
      // Sem a equipe na lista (não deveria acontecer): o texto da API.
      title: team?.name ?? (issue.athleteId ? head.slice(head.indexOf(", ") + 2) : head),
      category: category?.name ?? null,
      items: [],
    };
    group.items.push(issue);
    pairGroups.set(key, group);
  }
  // Por atleta, em ordem alfabética.
  const athleteGroups = new Map<string, { title: string; items: RegistrationIssue[] }>();
  for (const issue of issues.filter(isAthleteData)) {
    const key = issue.athleteId ?? issueSubject(issue.message);
    const group = athleteGroups.get(key) ?? { title: issueSubject(issue.message), items: [] };
    group.items.push(issue);
    athleteGroups.set(key, group);
  }
  const sortedAthletes = [...athleteGroups.values()].sort((a, b) =>
    a.title.localeCompare(b.title, "pt-BR"),
  );


  function renderGroup(
    group: { title: string; category?: string | null; items: RegistrationIssue[] },
    key: string,
    kind: "pair" | "athlete",
  ) {
    return (
      <div key={key} className="grid gap-1.5">
        {/* Título: equipe com a categoria em etiqueta, ou o atleta. */}
        <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold tracking-wide text-foreground uppercase">
          {kind === "pair" ? (
            <Users className="size-3.5 shrink-0" />
          ) : (
            <UserRound className="size-3.5 shrink-0" />
          )}
          {group.title}
          {group.category && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium tracking-normal text-primary normal-case">
              {group.category}
            </span>
          )}
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          {group.items.map((issue, index) => (
            <li key={`${issue.kind}-${issue.athleteId ?? ""}-${issue.requirementId ?? index}`}>
              <IssueText issue={issue} />
              {renderActions?.(issue)}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {[...pairGroups.entries()].map(([key, group]) => renderGroup(group, key, "pair"))}
      {sortedAthletes.map((group) => renderGroup(group, `athlete:${group.title}`, "athlete"))}
    </div>
  );
}
