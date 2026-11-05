import { MigrationInterface, QueryRunner } from 'typeorm';

// Pedido de inscrição feito pelo atleta (2026-10-10). Só acrescenta:
// tabela dos pedidos (um aberto por atleta+programa+evento) e os tipos de
// notificação do pedido.
export class CreateAthleteRegistrationRequests1790320000000 implements MigrationInterface {
  name = 'CreateAthleteRegistrationRequests1790320000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "athlete_registration_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "alias_id" uuid NOT NULL, "program_id" uuid NOT NULL, "program_athlete_id" uuid NOT NULL, "athlete_user_id" uuid NOT NULL, "status" varchar(20) NOT NULL DEFAULT 'draft', "category_ids" jsonb NOT NULL DEFAULT '[]', "note" text, "response_message" text, "submitted_at" TIMESTAMP WITH TIME ZONE, "responded_at" TIMESTAMP WITH TIME ZONE, "responded_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_athlete_registration_requests" PRIMARY KEY ("id"), CONSTRAINT "FK_athlete_registration_requests_program" FOREIGN KEY ("program_id") REFERENCES "program_participations"("id") ON DELETE CASCADE, CONSTRAINT "FK_athlete_registration_requests_athlete" FOREIGN KEY ("program_athlete_id") REFERENCES "program_athletes"("id") ON DELETE CASCADE, CONSTRAINT "FK_athlete_registration_requests_user" FOREIGN KEY ("athlete_user_id") REFERENCES "users"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_athlete_registration_requests_alias_id" ON "athlete_registration_requests" ("alias_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_athlete_registration_requests_program_id" ON "athlete_registration_requests" ("program_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_athlete_registration_requests_athlete_user_id" ON "athlete_registration_requests" ("athlete_user_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_athlete_registration_requests_open" ON "athlete_registration_requests" ("program_id", "athlete_user_id") WHERE "status" IN ('draft', 'submitted', 'changes_requested')`,
    );
    for (const value of [
      'athlete_registration_submitted',
      'athlete_registration_answered',
    ]) {
      await queryRunner.query(
        `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS '${value}'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "athlete_registration_requests"`);
  }
}
