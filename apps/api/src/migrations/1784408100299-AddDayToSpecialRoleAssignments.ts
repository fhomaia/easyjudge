import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDayToSpecialRoleAssignments1784408100299 implements MigrationInterface {
  name = 'AddDayToSpecialRoleAssignments1784408100299';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Atribuições existentes não têm dia associado (o conceito não
    // existia antes) — não dá pra migrar pra um valor válido, e o
    // volume de dados nesta fase (POC) é só de teste manual.
    await queryRunner.query(`DELETE FROM "special_role_assignments"`);
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" DROP CONSTRAINT "UQ_333cdf233d7df43056dc295d48b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" ADD "schedule_day_id" uuid NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_40e181c198c4e0a3249dc90a3a" ON "special_role_assignments" ("schedule_day_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" ADD CONSTRAINT "UQ_9905368bbfcedf32e15a21b4946" UNIQUE ("event_id", "role", "schedule_day_id", "judge_participation_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" ADD CONSTRAINT "FK_40e181c198c4e0a3249dc90a3a3" FOREIGN KEY ("schedule_day_id") REFERENCES "schedule_days"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" DROP CONSTRAINT "FK_40e181c198c4e0a3249dc90a3a3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" DROP CONSTRAINT "UQ_9905368bbfcedf32e15a21b4946"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_40e181c198c4e0a3249dc90a3a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" DROP COLUMN "schedule_day_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" ADD CONSTRAINT "UQ_333cdf233d7df43056dc295d48b" UNIQUE ("event_id", "role", "judge_participation_id")`,
    );
  }
}
