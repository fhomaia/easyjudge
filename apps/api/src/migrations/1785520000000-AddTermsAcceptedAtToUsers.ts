import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTermsAcceptedAtToUsers1785520000000
  implements MigrationInterface
{
  name = 'AddTermsAcceptedAtToUsers1785520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "terms_accepted_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "terms_accepted_at"`,
    );
  }
}
