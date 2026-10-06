import { MigrationInterface, QueryRunner } from 'typeorm';

// Quem enviou a ficha de inscrição (2026-10-06): a tag "Inscrito pelo
// organizador" some quando o próprio programa envia. Fichas já enviadas
// pelo programa (conta = quem criou) ficam com ele como remetente.
export class AddProgramSubmittedBy1790290000000 implements MigrationInterface {
  name = 'AddProgramSubmittedBy1790290000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "program_participations" ADD "submitted_by" uuid`,
    );
    await queryRunner.query(
      `UPDATE "program_participations" SET "submitted_by" = "user_id" WHERE "submitted_at" IS NOT NULL AND "user_id" IS NOT NULL AND "user_id" = "created_by_id"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "program_participations" DROP COLUMN "submitted_by"`,
    );
  }
}
