import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWithdrawalToScheduleEntries1785093094000
  implements MigrationInterface
{
  name = 'AddWithdrawalToScheduleEntries1785093094000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" ADD "withdrawn_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" ADD "removed_from_schedule" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" DROP COLUMN "removed_from_schedule"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" DROP COLUMN "withdrawn_at"`,
    );
  }
}
