import { MigrationInterface, QueryRunner } from 'typeorm';
import { USS_NON_TUMBLING_COED_TEMPLATE_ID } from './1789960000000-AddUssNonTumblingCoedTemplate';

// Ajusta as 5 regras de dedução de Legalidade do template USS
// Non-Tumbling — pedido do usuário (2026-09-23): "Uniform Top
// Guidelines (USASF)" e "Athletic Performance Standards (APS)" não
// precisam de especificação (requiresCode: false, as outras 3
// continuam true); e o rótulo de todas as 5 perde o prefixo
// "Legality: " (só o texto depois dos dois-pontos vira o nome).
interface DeductionSeed {
  id: string;
  label: string;
  value: number;
  requiresCode: boolean;
}

const CHANGES: Record<string, { label: string; requiresCode: boolean }> = {
  legality_uniform_top: { label: 'Uniform Top Guidelines (USASF)', requiresCode: false },
  legality_aps: { label: 'Athletic Performance Standards (APS)', requiresCode: false },
  legality_general_rules: { label: 'General Rules / Out of Level Tumbling', requiresCode: true },
  legality_building_out_of_level: { label: 'Building Out of Level', requiresCode: true },
  legality_level_rules_restrictions: {
    label: 'All Level Rules/Skill Restrictions by Division',
    requiresCode: true,
  },
};

const OLD: Record<string, { label: string; requiresCode: boolean }> = {
  legality_uniform_top: { label: 'Legality: Uniform Top Guidelines (USASF)', requiresCode: true },
  legality_aps: { label: 'Legality: Athletic Performance Standards (APS)', requiresCode: true },
  legality_general_rules: {
    label: 'Legality: General Rules / Out of Level Tumbling',
    requiresCode: true,
  },
  legality_building_out_of_level: { label: 'Legality: Building Out of Level', requiresCode: true },
  legality_level_rules_restrictions: {
    label: 'Legality: All Level Rules/Skill Restrictions by Division',
    requiresCode: true,
  },
};

export class RenameUssNonTumblingLegalityDeductions1790030000000
  implements MigrationInterface
{
  name = 'RenameUssNonTumblingLegalityDeductions1790030000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.apply(queryRunner, CHANGES);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.apply(queryRunner, OLD);
  }

  private async apply(
    queryRunner: QueryRunner,
    changes: Record<string, { label: string; requiresCode: boolean }>,
  ): Promise<void> {
    const [row] = await queryRunner.query(
      `SELECT deductions FROM "scoring_templates" WHERE "id" = $1`,
      [USS_NON_TUMBLING_COED_TEMPLATE_ID],
    );
    const deductions: DeductionSeed[] = row.deductions;
    const updated = deductions.map((d) => {
      const change = changes[d.id];
      return change ? { ...d, label: change.label, requiresCode: change.requiresCode } : d;
    });
    await queryRunner.query(`UPDATE "scoring_templates" SET "deductions" = $1::jsonb WHERE "id" = $2`, [
      JSON.stringify(updated),
      USS_NON_TUMBLING_COED_TEMPLATE_ID,
    ]);
  }
}
