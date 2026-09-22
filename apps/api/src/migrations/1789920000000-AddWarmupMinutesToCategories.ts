import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWarmupMinutesToCategories1789920000000
  implements MigrationInterface
{
  name = 'AddWarmupMinutesToCategories1789920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "categories" ADD "warmup_minutes" integer`,
    );
    await queryRunner.query(
      `UPDATE "categories" SET "warmup_minutes" = CASE WHEN "category_format" = 'team_cheer' THEN 10 ELSE 5 END`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "warmup_minutes" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "categories" DROP COLUMN "warmup_minutes"`,
    );
  }
}
