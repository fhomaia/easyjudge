import { MigrationInterface, QueryRunner } from 'typeorm';
import { IASF_2526_TEAM_CHEER_ALL_GIRL_TEMPLATE_ID } from './1785640000000-AddIasf2526TeamCheerAllGirlTemplate';
import { IASF_2526_TEAM_CHEER_COED_TEMPLATE_ID } from './1785650000000-AddIasf2526TeamCheerCoedTemplate';

// Correção: os dois templates IASF foram criados com year=2025 (chute
// pelo início da temporada "2025-2026", já que o campo `year` é um
// único inteiro) - o usuário confirmou que a súmula em si é de 2026,
// não 2025. Ajusta o campo e a menção "2025-2026 season" na descrição
// pra só "2026 season", consistente.
export class FixIasfYear1785680000000 implements MigrationInterface {
  name = 'FixIasfYear1785680000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "scoring_templates" SET "year" = 2026, "description" = REPLACE("description", '2025-2026 season', '2026 season') WHERE "id" IN ($1, $2)`,
      [IASF_2526_TEAM_CHEER_ALL_GIRL_TEMPLATE_ID, IASF_2526_TEAM_CHEER_COED_TEMPLATE_ID],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "scoring_templates" SET "year" = 2025, "description" = REPLACE("description", '2026 season', '2025-2026 season') WHERE "id" IN ($1, $2)`,
      [IASF_2526_TEAM_CHEER_ALL_GIRL_TEMPLATE_ID, IASF_2526_TEAM_CHEER_COED_TEMPLATE_ID],
    );
  }
}
