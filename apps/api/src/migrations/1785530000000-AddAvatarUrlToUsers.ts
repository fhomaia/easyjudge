import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAvatarUrlToUsers1785530000000 implements MigrationInterface {
  name = 'AddAvatarUrlToUsers1785530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "avatar_url" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatar_url"`);
  }
}
