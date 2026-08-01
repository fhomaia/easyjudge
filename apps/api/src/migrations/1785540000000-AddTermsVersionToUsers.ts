import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTermsVersionToUsers1785540000000
  implements MigrationInterface
{
  name = 'AddTermsVersionToUsers1785540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "terms_version" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "terms_version"`);
  }
}
