import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountStatusToUsers1785550000000
  implements MigrationInterface
{
  name = 'AddAccountStatusToUsers1785550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "active" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "deactivated_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deleted_at"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "deactivated_at"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "active"`);
  }
}
