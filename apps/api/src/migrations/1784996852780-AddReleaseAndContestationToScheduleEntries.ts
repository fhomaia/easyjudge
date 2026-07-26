import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReleaseAndContestationToScheduleEntries1784996852780 implements MigrationInterface {
  name = 'AddReleaseAndContestationToScheduleEntries1784996852780';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" ADD "scores_released_at" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" ADD "contestation_released_at" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" ADD "contestation_requested_at" timestamptz`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" DROP COLUMN "contestation_requested_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" DROP COLUMN "contestation_released_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" DROP COLUMN "scores_released_at"`,
    );
  }
}
