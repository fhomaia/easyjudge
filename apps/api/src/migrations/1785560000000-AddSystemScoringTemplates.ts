import { MigrationInterface, QueryRunner } from 'typeorm';

// Id fixo (não gerado via uuid_generate_v4()) de propósito: migrations
// futuras que inserem o CONTEÚDO de cada modelo oficial (um de cada
// vez, sob pedido do usuário — ver CLAUDE.md/plan desta feature)
// precisam reusar exatamente este id como created_by_id, sem depender
// de uma query pra descobri-lo.
export const SYSTEM_SCORING_TEMPLATES_OWNER_ID =
  '00000000-0000-4000-8000-000000000001';

export class AddSystemScoringTemplates1785560000000
  implements MigrationInterface
{
  name = 'AddSystemScoringTemplates1785560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scoring_templates" ADD "is_system_template" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "scoring_templates" ADD "source" character varying`,
    );

    // Conta reservada, dona de todo template de sistema — nunca loga
    // (sem password_hash), nunca é retornada em nenhuma resposta da API
    // (ScoringTemplate.createdBy não é carregado em nenhuma query do
    // ScoringTemplatesService hoje). É só mais um "dono" pro
    // findOwnTemplateOrThrow já existente barrar edição/exclusão por
    // qualquer usuário real, sem precisar de nenhum conceito novo de
    // admin de plataforma.
    await queryRunner.query(
      `INSERT INTO "users" ("id", "role", "first_name", "last_name", "email") VALUES ($1, 'organization', 'Modelos', 'Oficiais', 'templates@cheercup.com.br')`,
      [SYSTEM_SCORING_TEMPLATES_OWNER_ID],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "users" WHERE "id" = $1`, [
      SYSTEM_SCORING_TEMPLATES_OWNER_ID,
    ]);
    await queryRunner.query(
      `ALTER TABLE "scoring_templates" DROP COLUMN "source"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scoring_templates" DROP COLUMN "is_system_template"`,
    );
  }
}
