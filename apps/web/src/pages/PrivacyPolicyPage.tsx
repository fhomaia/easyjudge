import { Link } from "react-router-dom";
import { LegalPageLayout, type LegalSection } from "@/components/LegalPageLayout";

const SECTIONS: LegalSection[] = [
  {
    id: "quais-dados-coletamos",
    title: "1. Quais dados coletamos",
    content: (
      <>
        <p>Ao criar uma conta na Cheer Cup, coletamos:</p>
        <ul className="ml-5 grid list-disc gap-1">
          <li>Nome (e sobrenome, exceto para contas de programa/ginásio);</li>
          <li>
            CPF ou CNPJ — obrigatório para jurado, produtor e programa/ginásio; opcional (e sempre
            CPF) para atleta e espectador;
          </li>
          <li>Data de nascimento, quando o documento informado é CPF;</li>
          <li>Email e senha;</li>
          <li>Papel na plataforma (jurado, produtor, programa/ginásio, atleta ou espectador);</li>
          <li>
            Opcionalmente, nome da equipe/instituição e o email de um programa ao qual você deseja
            se vincular (no caso de contas de atleta).
          </li>
        </ul>
        <p>
          Durante o uso da plataforma, também tratamos os dados operacionais necessários ao
          funcionamento do serviço: notas atribuídas por jurados, cronogramas de apresentação,
          vínculos entre atletas e programas, e notificações do evento.
        </p>
      </>
    ),
  },
  {
    id: "acesso-a-camera",
    title: "2. Acesso à câmera (QR code)",
    content: (
      <p>
        Ao escolher escanear o código de um evento, a plataforma pede acesso à sua câmera. Esse
        acesso é usado só para ler o QR code na hora — o vídeo é processado inteiramente no seu
        próprio navegador, nunca é enviado para nossos servidores, gravado ou armazenado. Você
        pode negar essa permissão a qualquer momento e continuar digitando o código manualmente.
      </p>
    ),
  },
  {
    id: "por-que-coletamos",
    title: "3. Por que coletamos esses dados",
    content: (
      <p>
        Tratamos seus dados pessoais para viabilizar o cadastro e a autenticação na plataforma,
        permitir a organização e o julgamento de competições de cheerleading, e garantir a
        integridade e a auditoria das notas lançadas — a base legal, na maioria dos casos, é a
        execução do contrato de uso da plataforma (art. 7º, V, da LGPD) ou o legítimo interesse em
        manter um registro confiável das competições.
      </p>
    ),
  },
  {
    id: "com-quem-compartilhamos",
    title: "4. Com quem compartilhamos",
    content: (
      <p>
        Não vendemos seus dados pessoais. Dados de identificação (nome e papel) são visíveis para
        outros participantes do mesmo evento, na medida necessária para a operação da competição
        (ex.: um produtor vê o nome dos jurados escalados; um atleta vê o nome do programa a que
        está vinculado). Usamos fornecedores de infraestrutura (banco de dados, armazenamento de
        arquivos e envio de email) apenas para operar o serviço, sob contrato.
      </p>
    ),
  },
  {
    id: "retencao-dos-dados",
    title: "5. Retenção dos dados",
    content: (
      <p>
        Mantemos seus dados enquanto sua conta estiver ativa e pelo tempo necessário para cumprir
        obrigações legais ou preservar o histórico oficial de competições já realizadas (notas e
        resultados). Você pode solicitar a exclusão da sua conta a qualquer momento — ver seção
        "Seus direitos" abaixo.
      </p>
    ),
  },
  {
    id: "criancas-e-adolescentes",
    title: "6. Crianças e adolescentes",
    content: (
      <p>
        A Cheer Cup aceita cadastro de contas próprias a partir de 13 anos — ao se cadastrar, o
        usuário declara ter essa idade (ver Termos de Uso, "Cadastro e conta"). Além disso, atletas
        menores de idade podem ter dados tratados na plataforma sem conta própria, por vínculo com
        um programa/equipe. Se você é responsável legal por um adolescente com conta na Cheer Cup,
        ou por um atleta menor de idade vinculado a um programa/equipe, e tem dúvidas sobre como os
        dados dele são tratados, ou deseja exercer os direitos previstos no art. 14 da LGPD em nome
        dele, entre em contato pelo canal abaixo.
      </p>
    ),
  },
  {
    id: "seus-direitos",
    title: "7. Seus direitos",
    content: (
      <p>
        Nos termos da LGPD, você pode solicitar a qualquer momento: confirmação do tratamento,
        acesso, correção, anonimização, portabilidade, eliminação dos dados tratados com base no
        consentimento, e informações sobre com quem compartilhamos seus dados. Basta entrar em
        contato pelo email abaixo.
      </p>
    ),
  },
  {
    id: "seguranca",
    title: "8. Segurança",
    content: (
      <p>
        Senhas são armazenadas de forma criptografada (nunca em texto plano) e o acesso aos dados
        de cada evento é restrito a quem tem vínculo com ele. Adotamos medidas técnicas e
        organizacionais razoáveis para proteger seus dados contra acesso não autorizado, perda ou
        alteração indevida.
      </p>
    ),
  },
  {
    id: "alteracoes-desta-politica",
    title: "9. Alterações desta política",
    content: (
      <p>
        Podemos atualizar esta Política de Privacidade periodicamente. Alterações relevantes serão
        comunicadas dentro da plataforma.
      </p>
    ),
  },
  {
    id: "contato",
    title: "10. Contato",
    content: (
      <p>
        Para exercer seus direitos ou tirar dúvidas sobre esta política, escreva para{" "}
        <a
          href="mailto:contato@cheercup.com.br"
          className="text-brand-blue underline underline-offset-2 hover:text-brand-yellow"
        >
          contato@cheercup.com.br
        </a>
        . Veja também os{" "}
        <Link
          to="/terms"
          target="_blank"
          className="text-brand-blue underline underline-offset-2 hover:text-brand-yellow"
        >
          Termos de Uso
        </Link>
        .
      </p>
    ),
  },
];

export function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      title="Política de Privacidade"
      updatedAt="1 de agosto de 2026"
      sections={SECTIONS}
    />
  );
}
