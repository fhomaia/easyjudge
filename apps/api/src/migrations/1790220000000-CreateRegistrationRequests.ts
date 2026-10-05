import { MigrationInterface, QueryRunner } from 'typeorm';

// Ficha de inscrição travada depois de enviada (2026-10-05): o programa
// só pede alteração ou cancelamento ao organizador
// (`registration_requests`), que pode liberar a edição de novo
// (`program_participations.reopened_at`). Notificações novas só pra
// admin/assessor (audiência `managers`).
export class CreateRegistrationRequests1790220000000 implements MigrationInterface {
  name = 'CreateRegistrationRequests1790220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "program_participations" ADD "reopened_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `CREATE TYPE "registration_requests_type_enum" AS ENUM ('change', 'cancel')`,
    );
    await queryRunner.query(`
      CREATE TABLE "registration_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "alias_id" uuid NOT NULL,
        "program_id" uuid NOT NULL,
        "type" "registration_requests_type_enum" NOT NULL,
        "message" text NOT NULL,
        "created_by_id" uuid NOT NULL,
        "resolved_at" TIMESTAMP WITH TIME ZONE,
        "resolved_by_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_registration_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_registration_requests_program" FOREIGN KEY ("program_id")
          REFERENCES "program_participations"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_registration_requests_program" ON "registration_requests" ("program_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_registration_requests_alias" ON "registration_requests" ("alias_id")`,
    );
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'registration_submitted'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'registration_request'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notifications_audience_enum" ADD VALUE IF NOT EXISTS 'managers'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Os valores novos dos enums de notificação ficam (Postgres não
    // remove valor de enum).
    await queryRunner.query(`DROP TABLE "registration_requests"`);
    await queryRunner.query(`DROP TYPE "registration_requests_type_enum"`);
    await queryRunner.query(
      `ALTER TABLE "program_participations" DROP COLUMN "reopened_at"`,
    );
  }
}
