import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeUserDocumentOptional1785500000000
  implements MigrationInterface
{
  name = 'MakeUserDocumentOptional1785500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "document_type" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "document_number" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "document_number" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "document_type" SET NOT NULL`,
    );
  }
}
