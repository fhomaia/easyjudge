import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResourceToCriterionJudgeAssignments1784406421249 implements MigrationInterface {
  name = 'AddResourceToCriterionJudgeAssignments1784406421249';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Atribuições existentes não têm recurso associado (o conceito não
    // existia antes) — não dá pra migrar pra um valor válido, e o
    // volume de dados nesta fase (POC) é só de teste manual.
    await queryRunner.query(`DELETE FROM "criterion_judge_assignments"`);
    await queryRunner.query(
      `ALTER TABLE "criterion_judge_assignments" DROP CONSTRAINT "UQ_e42cdd0264fa854591f9037307c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "criterion_judge_assignments" ADD "resource_id" uuid NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1dd32cb81731a5ddfcf680c3e1" ON "criterion_judge_assignments" ("resource_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "criterion_judge_assignments" ADD CONSTRAINT "UQ_479abece5720ace3b7406e57912" UNIQUE ("criterion_id", "resource_id", "judge_participation_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "criterion_judge_assignments" ADD CONSTRAINT "FK_1dd32cb81731a5ddfcf680c3e14" FOREIGN KEY ("resource_id") REFERENCES "schedule_resources"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "criterion_judge_assignments" DROP CONSTRAINT "FK_1dd32cb81731a5ddfcf680c3e14"`,
    );
    await queryRunner.query(
      `ALTER TABLE "criterion_judge_assignments" DROP CONSTRAINT "UQ_479abece5720ace3b7406e57912"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1dd32cb81731a5ddfcf680c3e1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "criterion_judge_assignments" DROP COLUMN "resource_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "criterion_judge_assignments" ADD CONSTRAINT "UQ_e42cdd0264fa854591f9037307c" UNIQUE ("criterion_id", "judge_participation_id")`,
    );
  }
}
