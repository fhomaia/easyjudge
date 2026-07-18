import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomFormatLabelToCategories1783987224061 implements MigrationInterface {
  name = 'AddCustomFormatLabelToCategories1783987224061';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "categories" ADD "custom_format_label" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "categories" DROP COLUMN "custom_format_label"`,
    );
  }
}
