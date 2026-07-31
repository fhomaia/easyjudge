import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBirthDateToUsers1785510000000 implements MigrationInterface {
  name = 'AddBirthDateToUsers1785510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "birth_date" date`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "birth_date"`);
  }
}
