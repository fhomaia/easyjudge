import { MigrationInterface, QueryRunner } from 'typeorm';

// Tipos de dedução personalizados (regulamento -> "Personalizado"):
// `score_events.deduction_type` deixa de ser enum do Postgres (só os 9
// tipos IASF) e vira texto, pra guardar também `custom_<uuid>`. Os
// valores existentes são preservados como estão (USING ...::text) —
// nenhuma linha de score_events é apagada/alterada, só o tipo da
// coluna. `regulations.custom_deductions` guarda a lista de tipos
// criados por evento. Escrita à mão (o migration:generate traz deriva
// de schema alheia, ver CLAUDE.md).
export class DeductionTypeToVarchar1789900000000 implements MigrationInterface {
  name = 'DeductionTypeToVarchar1789900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "score_events" ALTER COLUMN "deduction_type" TYPE character varying USING "deduction_type"::text`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."score_events_deduction_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "regulations" ADD "custom_deductions" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "regulations" DROP COLUMN "custom_deductions"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."score_events_deduction_type_enum" AS ENUM('athlete_fall', 'major_athlete_fall', 'building_bobble', 'building_fall', 'major_building_fall', 'legality_infractions', 'skill_out_of_level', 'time_limit_violations', 'boundary_violations')`,
    );
    // Só reverte se nenhuma linha usar tipo personalizado — senão o
    // cast falha (de propósito: não perder nota em silêncio).
    await queryRunner.query(
      `ALTER TABLE "score_events" ALTER COLUMN "deduction_type" TYPE "public"."score_events_deduction_type_enum" USING "deduction_type"::"public"."score_events_deduction_type_enum"`,
    );
  }
}
