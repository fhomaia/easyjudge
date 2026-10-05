import { MigrationInterface, QueryRunner } from 'typeorm';

// Atletas inscritos por programa num evento + quais competem em cada
// equipe+categoria (2026-10-04, ver ProgramAthlete/TeamCategoryAthlete).
// Só cria tabelas e acrescenta 3 ações ao log de atividade do evento.
export class CreateProgramAthletes1790180000000 implements MigrationInterface {
  name = 'CreateProgramAthletes1790180000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "program_athletes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "program_id" uuid NOT NULL,
        "alias_id" uuid NOT NULL,
        "first_name" character varying(100) NOT NULL,
        "last_name" character varying(100) NOT NULL DEFAULT '',
        "email" character varying(255) NOT NULL,
        "cpf" character varying(11),
        "birth_date" date,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_program_athletes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_program_athletes_program" FOREIGN KEY ("program_id")
          REFERENCES "program_participations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_program_athletes_program" ON "program_athletes" ("program_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_program_athletes_alias" ON "program_athletes" ("alias_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_program_athletes_email" ON "program_athletes" ("program_id", LOWER("email"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_program_athletes_cpf" ON "program_athletes" ("program_id", "cpf") WHERE "cpf" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "team_category_athletes" (
        "team_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        "athlete_id" uuid NOT NULL,
        CONSTRAINT "PK_team_category_athletes" PRIMARY KEY ("team_id", "category_id", "athlete_id"),
        CONSTRAINT "FK_team_category_athletes_team" FOREIGN KEY ("team_id")
          REFERENCES "teams"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_team_category_athletes_category" FOREIGN KEY ("category_id")
          REFERENCES "categories"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_team_category_athletes_athlete" FOREIGN KEY ("athlete_id")
          REFERENCES "program_athletes"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_team_category_athletes_athlete" ON "team_category_athletes" ("athlete_id")`,
    );

    for (const value of [
      'athlete_created',
      'athlete_updated',
      'athlete_deleted',
    ]) {
      await queryRunner.query(
        `ALTER TYPE "public"."event_activity_logs_action_enum" ADD VALUE IF NOT EXISTS '${value}'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Os valores do enum ficam (Postgres não remove valor de enum sem
    // recriar o tipo; linhas com eles são apagadas).
    await queryRunner.query(
      `DELETE FROM "event_activity_logs" WHERE "action" IN ('athlete_created', 'athlete_updated', 'athlete_deleted')`,
    );
    await queryRunner.query(`DROP TABLE "team_category_athletes"`);
    await queryRunner.query(`DROP TABLE "program_athletes"`);
  }
}
