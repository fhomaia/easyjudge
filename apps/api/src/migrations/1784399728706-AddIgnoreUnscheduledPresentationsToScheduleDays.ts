import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIgnoreUnscheduledPresentationsToScheduleDays1784399728706 implements MigrationInterface {
  name = 'AddIgnoreUnscheduledPresentationsToScheduleDays1784399728706';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule_days" ADD "ignore_unscheduled_presentations" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule_days" DROP COLUMN "ignore_unscheduled_presentations"`,
    );
  }
}
