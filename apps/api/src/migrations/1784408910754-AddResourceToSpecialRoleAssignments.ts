import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResourceToSpecialRoleAssignments1784408910754 implements MigrationInterface {
  name = 'AddResourceToSpecialRoleAssignments1784408910754';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" DROP CONSTRAINT "FK_40e181c198c4e0a3249dc90a3a3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_40e181c198c4e0a3249dc90a3a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" DROP CONSTRAINT "UQ_9905368bbfcedf32e15a21b4946"`,
    );
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" RENAME COLUMN "schedule_day_id" TO "resource_id"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b96c3e6c863280a2f75a7df4cc" ON "special_role_assignments" ("resource_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" ADD CONSTRAINT "UQ_90eed53496a25a006e9aa7f1618" UNIQUE ("event_id", "role", "resource_id", "judge_participation_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" ADD CONSTRAINT "FK_b96c3e6c863280a2f75a7df4cc3" FOREIGN KEY ("resource_id") REFERENCES "schedule_resources"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" DROP CONSTRAINT "FK_b96c3e6c863280a2f75a7df4cc3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" DROP CONSTRAINT "UQ_90eed53496a25a006e9aa7f1618"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b96c3e6c863280a2f75a7df4cc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" RENAME COLUMN "resource_id" TO "schedule_day_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" ADD CONSTRAINT "UQ_9905368bbfcedf32e15a21b4946" UNIQUE ("event_id", "role", "judge_participation_id", "schedule_day_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_40e181c198c4e0a3249dc90a3a" ON "special_role_assignments" ("schedule_day_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" ADD CONSTRAINT "FK_40e181c198c4e0a3249dc90a3a3" FOREIGN KEY ("schedule_day_id") REFERENCES "schedule_days"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
