import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropUserDocumentUnique1790150000000 implements MigrationInterface {
  name = 'DropUserDocumentUnique1790150000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_5f6c1b67ac12a1e7eb454a48e5"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Falha se já houver documentos repetidos no banco.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5f6c1b67ac12a1e7eb454a48e5" ON "users" ("document_number")`,
    );
  }
}
