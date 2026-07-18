import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRegulationsAndDocuments1784061182099 implements MigrationInterface {
  name = 'CreateRegulationsAndDocuments1784061182099';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."regulation_documents_kind_enum" AS ENUM('official_regulation', 'safety_rules', 'code_of_conduct', 'additional')`,
    );
    await queryRunner.query(
      `CREATE TABLE "regulation_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "regulation_id" uuid NOT NULL, "kind" "public"."regulation_documents_kind_enum" NOT NULL, "name" character varying(255) NOT NULL, "file_url" character varying NOT NULL, "mime_type" character varying(100) NOT NULL, "size_bytes" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3f0d14c4abefb4d4bdaae682941" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_404de4bd6490300932e6d8e268" ON "regulation_documents" ("regulation_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."regulations_deduction_mode_enum" AS ENUM('iasf', 'custom')`,
    );
    await queryRunner.query(
      `CREATE TABLE "regulations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "event_id" uuid NOT NULL, "deduction_mode" "public"."regulations_deduction_mode_enum" NOT NULL DEFAULT 'iasf', "deduction_values" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_fd245fad4f4345645d57b5e93a" UNIQUE ("event_id"), CONSTRAINT "PK_a16db742c6f0c1ef5a149be81fb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_fd245fad4f4345645d57b5e93a" ON "regulations" ("event_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "regulation_documents" ADD CONSTRAINT "FK_404de4bd6490300932e6d8e2682" FOREIGN KEY ("regulation_id") REFERENCES "regulations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "regulations" ADD CONSTRAINT "FK_fd245fad4f4345645d57b5e93ab" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "regulations" DROP CONSTRAINT "FK_fd245fad4f4345645d57b5e93ab"`,
    );
    await queryRunner.query(
      `ALTER TABLE "regulation_documents" DROP CONSTRAINT "FK_404de4bd6490300932e6d8e2682"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fd245fad4f4345645d57b5e93a"`,
    );
    await queryRunner.query(`DROP TABLE "regulations"`);
    await queryRunner.query(
      `DROP TYPE "public"."regulations_deduction_mode_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_404de4bd6490300932e6d8e268"`,
    );
    await queryRunner.query(`DROP TABLE "regulation_documents"`);
    await queryRunner.query(
      `DROP TYPE "public"."regulation_documents_kind_enum"`,
    );
  }
}
