import { MigrationInterface, QueryRunner } from 'typeorm';

// Passam a exigir especificação nos modelos oficiais que têm esses tipos
// (pedido do usuário, 2026-09-28):
// - "Skill Performed Out of Level": no Batalha foi lançada 5 vezes sem
//   dizer qual habilidade (os modelos novos já nascem assim, ver
//   IASF_DEFAULT_DEDUCTIONS);
// - "Division Violation" (modelo USS Non-Tumbling).
// Sistemas próprios dos usuários não mudam. Só a marcação: nota já
// lançada não muda.
const DEDUCTION_IDS = ['skill_out_of_level', 'division_violation'];

function setRequiresCode(id: string, value: boolean): string {
  return `UPDATE "scoring_templates"
     SET "deductions" = (
       SELECT jsonb_agg(
         CASE WHEN d->>'id' = '${id}'
              THEN jsonb_set(d, '{requiresCode}', '${value}'::jsonb)
              ELSE d END
         ORDER BY ord)
       FROM jsonb_array_elements("deductions") WITH ORDINALITY AS t(d, ord)
     )
   WHERE "is_system_template" = true
     AND "deductions" @> '[{"id": "${id}"}]'::jsonb`;
}

export class LegalityDeductionsRequireCode1790120000000 implements MigrationInterface {
  name = 'LegalityDeductionsRequireCode1790120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const id of DEDUCTION_IDS) {
      await queryRunner.query(setRequiresCode(id, true));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const id of DEDUCTION_IDS) {
      await queryRunner.query(setRequiresCode(id, false));
    }
  }
}
