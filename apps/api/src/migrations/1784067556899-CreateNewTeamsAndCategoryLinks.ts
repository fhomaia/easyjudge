import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNewTeamsAndCategoryLinks1784067556899 implements MigrationInterface {
  name = 'CreateNewTeamsAndCategoryLinks1784067556899';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "programs" DROP CONSTRAINT "FK_26d243fdc44c2b67e541b796a81"`,
    );
    await queryRunner.query(
      `ALTER TABLE "programs" DROP CONSTRAINT "FK_programs_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_26d243fdc44c2b67e541b796a8"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_programs_user_id"`);
    await queryRunner.query(
      `CREATE TABLE "teams" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "program_id" uuid NOT NULL, "name" character varying(150) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7e5523774a38b08a6236d322403" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8c4bfa5ce5c420829700f8119b" ON "teams" ("program_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "team_categories" ("team_id" uuid NOT NULL, "category_id" uuid NOT NULL, CONSTRAINT "PK_99cfebbc5d6b6e9190ad5351810" PRIMARY KEY ("team_id", "category_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bc99e770b42edebbcea024cb74" ON "team_categories" ("team_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_95b8c1b14eb959cfba606c1a65" ON "team_categories" ("category_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2caff4c94e1d52431f484e71ed" ON "programs" ("event_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7f41ced131b5c9b9f8b99d088f" ON "programs" ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" ADD CONSTRAINT "FK_8c4bfa5ce5c420829700f8119bf" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "programs" ADD CONSTRAINT "FK_2caff4c94e1d52431f484e71edb" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "programs" ADD CONSTRAINT "FK_7f41ced131b5c9b9f8b99d088f8" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_categories" ADD CONSTRAINT "FK_bc99e770b42edebbcea024cb746" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_categories" ADD CONSTRAINT "FK_95b8c1b14eb959cfba606c1a657" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "team_categories" DROP CONSTRAINT "FK_95b8c1b14eb959cfba606c1a657"`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_categories" DROP CONSTRAINT "FK_bc99e770b42edebbcea024cb746"`,
    );
    await queryRunner.query(
      `ALTER TABLE "programs" DROP CONSTRAINT "FK_7f41ced131b5c9b9f8b99d088f8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "programs" DROP CONSTRAINT "FK_2caff4c94e1d52431f484e71edb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" DROP CONSTRAINT "FK_8c4bfa5ce5c420829700f8119bf"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7f41ced131b5c9b9f8b99d088f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2caff4c94e1d52431f484e71ed"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_95b8c1b14eb959cfba606c1a65"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bc99e770b42edebbcea024cb74"`,
    );
    await queryRunner.query(`DROP TABLE "team_categories"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8c4bfa5ce5c420829700f8119b"`,
    );
    await queryRunner.query(`DROP TABLE "teams"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_programs_user_id" ON "programs" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_26d243fdc44c2b67e541b796a8" ON "programs" ("event_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "programs" ADD CONSTRAINT "FK_programs_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "programs" ADD CONSTRAINT "FK_26d243fdc44c2b67e541b796a81" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
