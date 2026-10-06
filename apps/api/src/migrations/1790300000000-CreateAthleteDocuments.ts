import { MigrationInterface, QueryRunner } from 'typeorm';

// Documentos dos atletas na inscrição (2026-10-06). Só acrescenta: tabela
// de arquivos privados (bucket R2 privado), biblioteca do atleta,
// documentos enviados por atleta do evento e item pedido, o envio feito
// pelo próprio atleta e o tipo de notificação de documento contestado.
export class CreateAthleteDocuments1790300000000 implements MigrationInterface {
  name = 'CreateAthleteDocuments1790300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "private_files" ("key" varchar(200) NOT NULL, "file_name" varchar(255) NOT NULL, "mime_type" varchar(100) NOT NULL, "size" integer NOT NULL, "uploaded_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_private_files" PRIMARY KEY ("key"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "file_key" varchar(200) NOT NULL, "label" varchar(120), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_user_documents" PRIMARY KEY ("id"), CONSTRAINT "FK_user_documents_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_documents_user_id" ON "user_documents" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE TABLE "athlete_requirement_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "alias_id" uuid NOT NULL, "program_athlete_id" uuid NOT NULL, "requirement_id" varchar(60) NOT NULL, "file_keys" jsonb NOT NULL DEFAULT '[]', "status" varchar(20) NOT NULL DEFAULT 'sent', "contest_reason" text, "contested_at" TIMESTAMP WITH TIME ZONE, "contested_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_athlete_requirement_documents" PRIMARY KEY ("id"), CONSTRAINT "FK_athlete_requirement_documents_athlete" FOREIGN KEY ("program_athlete_id") REFERENCES "program_athletes"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_athlete_requirement_documents_athlete_req" ON "athlete_requirement_documents" ("program_athlete_id", "requirement_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_athlete_requirement_documents_alias_id" ON "athlete_requirement_documents" ("alias_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "program_athletes" ADD "athlete_submitted_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'document_contested'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "program_athletes" DROP COLUMN "athlete_submitted_at"`,
    );
    await queryRunner.query(`DROP TABLE "athlete_requirement_documents"`);
    await queryRunner.query(`DROP TABLE "user_documents"`);
    await queryRunner.query(`DROP TABLE "private_files"`);
  }
}
