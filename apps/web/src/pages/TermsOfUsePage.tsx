import { Link } from "react-router-dom";
import { LegalPageLayout, type LegalSection } from "@/components/LegalPageLayout";

const SECTIONS: LegalSection[] = [
  {
    id: "sobre-a-plataforma",
    title: "1. Sobre a plataforma",
    content: (
      <p>
        A Cheer Cup é uma plataforma para gestão de notas e resultados de competições de
        cheerleading, usada por jurados, produtores de evento, programas/ginásios, atletas e
        espectadores. Ao criar uma conta, você concorda com estes Termos de Uso e com a nossa{" "}
        <Link
          to="/privacy"
          target="_blank"
          className="text-brand-blue underline underline-offset-2 hover:text-brand-yellow"
        >
          Política de Privacidade
        </Link>
        .
      </p>
    ),
  },
  {
    id: "cadastro-e-conta",
    title: "2. Cadastro e conta",
    content: (
      <>
        <p>
          Você é responsável por manter a exatidão dos dados informados no cadastro e pela
          confidencialidade da sua senha. Cada pessoa deve manter uma única conta, vinculada ao
          papel que efetivamente exerce (jurado, produtor, programa/ginásio, atleta ou
          espectador).
        </p>
        <p>
          Ao criar uma conta, o usuário declara que possui 13 anos ou mais e que as informações
          fornecidas são verdadeiras. Caso seja constatado que a idade informada é falsa, a Cheer
          Cup poderá suspender ou excluir a conta.
        </p>
      </>
    ),
  },
  {
    id: "uso-da-plataforma",
    title: "3. Uso da plataforma",
    content: (
      <p>
        A plataforma deve ser usada apenas para os fins a que se destina: organização de eventos
        de cheerleading, lançamento e consulta de notas, e acompanhamento de resultados. Notas
        lançadas por jurados fazem parte do registro oficial da competição e não devem ser
        adulteradas ou lançadas de forma fraudulenta.
      </p>
    ),
  },
  {
    id: "conteudo-enviado-por-voce",
    title: "4. Conteúdo enviado por você",
    content: (
      <p>
        Logos, documentos de regulamento e demais arquivos enviados por produtores e programas
        permanecem de titularidade de quem os enviou. Ao fazer upload, você declara ter os
        direitos necessários sobre esse conteúdo e autoriza a Cheer Cup a armazená-lo e exibi-lo
        dentro da plataforma, para os participantes do evento correspondente.
      </p>
    ),
  },
  {
    id: "disponibilidade-do-servico",
    title: "5. Disponibilidade do serviço",
    content: (
      <p>
        A Cheer Cup está em evolução constante e pode passar por manutenções, alterações de
        funcionalidades ou indisponibilidades pontuais. Recomendamos verificar a conectividade
        antes de eventos ao vivo; a plataforma mantém um buffer local para reduzir o impacto de
        quedas de conexão durante o lançamento de notas, mas não garante disponibilidade
        ininterrupta.
      </p>
    ),
  },
  {
    id: "cancelamento-de-conta",
    title: "6. Cancelamento de conta",
    content: (
      <p>
        Você pode solicitar o encerramento da sua conta e a exclusão dos seus dados pessoais a
        qualquer momento, entrando em contato pelo email abaixo — respeitados os prazos legais de
        retenção de dados de competições já encerradas (ex.: resultados oficiais).
      </p>
    ),
  },
  {
    id: "alteracoes-destes-termos",
    title: "7. Alterações destes termos",
    content: (
      <p>
        Podemos atualizar estes Termos de Uso periodicamente. Alterações relevantes serão
        comunicadas dentro da plataforma. O uso continuado após uma atualização implica
        concordância com os novos termos.
      </p>
    ),
  },
  {
    id: "contato",
    title: "8. Contato",
    content: (
      <p>
        Dúvidas sobre estes termos podem ser enviadas para{" "}
        <a
          href="mailto:contato@cheercup.com.br"
          className="text-brand-blue underline underline-offset-2 hover:text-brand-yellow"
        >
          contato@cheercup.com.br
        </a>
        .
      </p>
    ),
  },
];

export function TermsOfUsePage() {
  return (
    <LegalPageLayout title="Termos de Uso" updatedAt="1 de agosto de 2026" sections={SECTIONS} />
  );
}
