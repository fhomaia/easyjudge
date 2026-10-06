import { MigrationInterface, QueryRunner } from 'typeorm';

// Respostas dos atletas aos dados pedidos na inscrição (2026-10-06). Só
// cria a tabela.
export class CreateAthleteRequirementValues1790280000000 implements MigrationInterface {
  name = 'CreateAthleteRequirementValues1790280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "athlete_requirement_values" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "alias_id" uuid NOT NULL, "program_athlete_id" uuid NOT NULL, "requirement_id" varchar(60) NOT NULL, "value" text NOT NULL, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_athlete_requirement_values" PRIMARY KEY ("id"), CONSTRAINT "FK_athlete_requirement_values_athlete" FOREIGN KEY ("program_athlete_id") REFERENCES "program_athletes"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_athlete_requirement_values_athlete_req" ON "athlete_requirement_values" ("program_athlete_id", "requirement_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_athlete_requirement_values_alias_id" ON "athlete_requirement_values" ("alias_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "athlete_requirement_values"`);
  }
}
