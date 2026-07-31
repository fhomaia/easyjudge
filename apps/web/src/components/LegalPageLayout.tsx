import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export interface LegalSection {
  id: string;
  title: string;
  content: ReactNode;
}

interface LegalPageLayoutProps {
  title: string;
  updatedAt: string;
  sections: LegalSection[];
}

// Layout compartilhado por TermsOfUsePage/PrivacyPolicyPage. No mobile é
// só o conteúdo empilhado (como antes); a partir de `lg` vira duas
// colunas com um sumário fixo à esquerda — sem isso, o texto ficava
// preso a um `max-w-2xl` central, deixando bastante espaço vazio dos
// dois lados numa tela larga. Não esticamos o próprio texto pra ocupar
// a largura toda (parágrafo muito largo prejudica leitura) — o espaço
// extra vira o sumário, não mais texto por linha.
export function LegalPageLayout({ title, updatedAt, sections }: LegalPageLayoutProps) {
  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto max-w-5xl px-6 py-12 lg:px-10 lg:py-16">
        <Link
          to="/login"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Voltar
        </Link>

        <header className="mt-8 flex flex-col items-center gap-4 text-center">
          <img src="/logo.png" alt="Cheer Cup" className="w-20 rounded-full" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Última atualização: {updatedAt}</p>
          </div>
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[220px_1fr]">
          <nav className="hidden self-start lg:sticky lg:top-12 lg:block">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Nesta página
            </p>
            <ul className="mt-4 grid gap-2.5 border-l pl-4 text-sm">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="grid gap-8 text-sm leading-relaxed text-foreground/90">
            {sections.map((section) => (
              <section key={section.id} id={section.id} className="grid scroll-mt-8 gap-2">
                <h2 className="text-base font-semibold text-foreground">{section.title}</h2>
                {section.content}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
