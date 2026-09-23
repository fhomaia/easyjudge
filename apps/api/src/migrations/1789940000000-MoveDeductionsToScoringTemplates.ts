import { MigrationInterface, QueryRunner } from 'typeorm';

const IASF_DEFAULT_DEDUCTIONS_JSON = JSON.stringify([
  { id: 'athlete_fall', label: 'Athlete Fall', value: -1 },
  { id: 'major_athlete_fall', label: 'Major Athlete Fall', value: -2 },
  { id: 'building_bobble', label: 'Building Bobble', value: -2 },
  { id: 'building_fall', label: 'Building Fall', value: -3 },
  { id: 'major_building_fall', label: 'Major Building Fall', value: -4 },
  { id: 'legality_infractions', label: 'Legality Infractions', value: -4 },
  { id: 'skill_out_of_level', label: 'Skill Performed Out of Level', value: -1 },
  { id: 'time_limit_violations', label: 'Time Limit Violations', value: -1 },
  { id: 'boundary_violations', label: 'Boundary Violations', value: -1 },
]);

// Move as regras de dedução do Regulamento (por evento) pro Sistema de
// Pontuação (por template) — quem determina as deduções é o sistema de
// pontuação, não o evento (2026-09-23, ver CLAUDE.md/plano desta
// sessão). Produção ainda não tem usuário real (ver memory
// project_production_no_users_yet), então o backfill simplesmente
// semeia TODO template existente (inclusive os de sistema) com as 9
// regras padrão da IASF, sem tentar preservar valor por evento. Escrita
// à mão (migration:generate traz deriva de schema alheia, ver CLAUDE.md).
export class MoveDeductionsToScoringTemplates1789940000000
  implements MigrationInterface
{
  name = 'MoveDeductionsToScoringTemplates1789940000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scoring_templates" ADD "deductions" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `UPDATE "scoring_templates" SET "deductions" = $1::jsonb`,
      [IASF_DEFAULT_DEDUCTIONS_JSON],
    );

    await queryRunner.query(
      `ALTER TABLE "regulations" DROP COLUMN "hidden_deductions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "regulations" DROP COLUMN "custom_deductions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "regulations" DROP COLUMN "deduction_values"`,
    );
    await queryRunner.query(
      `ALTER TABLE "regulations" DROP COLUMN "deduction_mode"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."regulations_deduction_mode_enum"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."regulations_deduction_mode_enum" AS ENUM('iasf', 'custom')`,
    );
    await queryRunner.query(
      `ALTER TABLE "regulations" ADD "deduction_mode" "public"."regulations_deduction_mode_enum" NOT NULL DEFAULT 'iasf'`,
    );
    await queryRunner.query(
      `ALTER TABLE "regulations" ADD "deduction_values" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "regulations" ADD "custom_deductions" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "regulations" ADD "hidden_deductions" jsonb`,
    );

    await queryRunner.query(
      `ALTER TABLE "scoring_templates" DROP COLUMN "deductions"`,
    );
  }
}
