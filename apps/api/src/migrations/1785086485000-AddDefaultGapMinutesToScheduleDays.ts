import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDefaultGapMinutesToScheduleDays1785086485000 implements MigrationInterface {
  name = 'AddDefaultGapMinutesToScheduleDays1785086485000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule_days" ADD "default_gap_minutes" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule_days" DROP COLUMN "default_gap_minutes"`,
    );
  }
}
