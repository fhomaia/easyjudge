import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveDefaultWarmupMinutesFromScheduleDays1789930000000
  implements MigrationInterface
{
  name = 'RemoveDefaultWarmupMinutesFromScheduleDays1789930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule_days" DROP COLUMN "default_warmup_minutes"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule_days" ADD "default_warmup_minutes" integer NOT NULL DEFAULT 10`,
    );
  }
}
