import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContestationResolvedAtToScheduleEntries1785012000000 implements MigrationInterface {
  name = 'AddContestationResolvedAtToScheduleEntries1785012000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" ADD "contestation_resolved_at" timestamptz`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" DROP COLUMN "contestation_resolved_at"`,
    );
  }
}
