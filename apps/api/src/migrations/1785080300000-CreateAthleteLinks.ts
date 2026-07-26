import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAthleteLinks1785080300000 implements MigrationInterface {
  name = 'CreateAthleteLinks1785080300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "athlete_links" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "program_user_id" uuid, "program_email" character varying NOT NULL, "athlete_user_id" uuid, "first_name" character varying(100), "last_name" character varying(100), "email" character varying, "confirmed_at" TIMESTAMP WITH TIME ZONE, "created_by_id" character varying, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_athlete_links" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_athlete_links_program_user_id" ON "athlete_links" ("program_user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_athlete_links_athlete_user_id" ON "athlete_links" ("athlete_user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_athlete_links_email" ON "athlete_links" ("email") `,
    );
    await queryRunner.query(
      `ALTER TABLE "athlete_links" ADD CONSTRAINT "FK_athlete_links_program_user_id" FOREIGN KEY ("program_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "athlete_links" ADD CONSTRAINT "FK_athlete_links_athlete_user_id" FOREIGN KEY ("athlete_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "athlete_links" DROP CONSTRAINT "FK_athlete_links_athlete_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "athlete_links" DROP CONSTRAINT "FK_athlete_links_program_user_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_athlete_links_email"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_athlete_links_athlete_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_athlete_links_program_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "athlete_links"`);
  }
}
