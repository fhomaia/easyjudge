import { MigrationInterface, QueryRunner } from 'typeorm';
import { SPPB_2026_GROUP_ELITE_STUNT_TEMPLATE_ID } from './1785570000000-AddSppb2026GroupEliteStuntTemplate';

export class AddYearToScoringTemplates1785580000000
  implements MigrationInterface
{
  name = 'AddYearToScoringTemplates1785580000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scoring_templates" ADD "year" integer`,
    );
    await queryRunner.query(
      `UPDATE "scoring_templates" SET "year" = 2026 WHERE "id" = $1`,
      [SPPB_2026_GROUP_ELITE_STUNT_TEMPLATE_ID],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scoring_templates" DROP COLUMN "year"`,
    );
  }
}
