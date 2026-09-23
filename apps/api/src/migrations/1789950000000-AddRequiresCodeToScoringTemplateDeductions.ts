import { MigrationInterface, QueryRunner } from 'typeorm';

// `TemplateDeduction.requiresCode` (pedido do usuário, 2026-09-23):
// antes só a "Legality Infractions" mostrava o campo de código na tela
// do jurado de legalidade, hardcoded no id fixo "legality_infractions"
// (ver histórico de LegalityDeductionsPanel.tsx) — agora é um flag por
// regra, editável na tela de Deduções do template. Backfill: todo
// template existente que já tem a regra padrão "legality_infractions"
// (semeada pela migration MoveDeductionsToScoringTemplates) ganha
// requiresCode=true SÓ nela, preservando as demais regras como estão —
// não dá pra fazer um UPDATE ... SET deductions = '[...]' fixo igual a
// migration anterior, porque cada template pode já ter sido editado
// (regras removidas/renomeadas/adicionadas) desde o seed. Escrita à mão
// (migration:generate traz deriva de schema alheia, ver CLAUDE.md).
export class AddRequiresCodeToScoringTemplateDeductions1789950000000
  implements MigrationInterface
{
  name = 'AddRequiresCodeToScoringTemplateDeductions1789950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "scoring_templates"
      SET "deductions" = (
        SELECT jsonb_agg(
          CASE
            WHEN elem->>'id' = 'legality_infractions'
              THEN elem || '{"requiresCode": true}'::jsonb
            ELSE elem || '{"requiresCode": false}'::jsonb
          END
        )
        FROM jsonb_array_elements("deductions") elem
      )
      WHERE jsonb_array_length("deductions") > 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "scoring_templates"
      SET "deductions" = (
        SELECT jsonb_agg(elem - 'requiresCode')
        FROM jsonb_array_elements("deductions") elem
      )
      WHERE jsonb_array_length("deductions") > 0
    `);
  }
}
