import { MigrationInterface, QueryRunner } from 'typeorm';

// Configuração da inscrição por evento (2026-10-06): dados e documentos
// pedidos aos atletas. Só cria a tabela.
export class CreateRegistrationSettings1790270000000 implements MigrationInterface {
  name = 'CreateRegistrationSettings1790270000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "registration_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "alias_id" uuid NOT NULL, "allow_submit_without_documents" boolean NOT NULL DEFAULT false, "requirements" jsonb NOT NULL DEFAULT '[]', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_registration_settings" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_registration_settings_alias_id" ON "registration_settings" ("alias_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_registration_settings_alias_id"`);
    await queryRunner.query(`DROP TABLE "registration_settings"`);
  }
}
