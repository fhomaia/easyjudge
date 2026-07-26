import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProgramEmailToUsers1785080100000 implements MigrationInterface {
  name = 'AddProgramEmailToUsers1785080100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "program_email" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "program_email"`);
  }
}
