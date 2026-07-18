import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateScoringTemplatesAndCriteria1783994223696 implements MigrationInterface {
  name = 'CreateScoringTemplatesAndCriteria1783994223696';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."scoring_criteria_type_enum" AS ENUM('group', 'score_item')`,
    );
    await queryRunner.query(
      `CREATE TABLE "scoring_criteria" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "template_id" uuid NOT NULL, "parent_id" uuid, "type" "public"."scoring_criteria_type_enum" NOT NULL, "name" character varying(150) NOT NULL, "description" text, "max_score" double precision NOT NULL, "weight" double precision NOT NULL DEFAULT '1', "order" integer NOT NULL DEFAULT '0', "show_in_judging_sheet" boolean NOT NULL DEFAULT true, "allow_decimal_scoring" boolean NOT NULL DEFAULT true, "is_required" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8df76962c0b1622a2cd986b734d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_18a1a2b483a6c8f59dbed8a540" ON "scoring_criteria" ("template_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7550ec36d6569225ee43876f2f" ON "scoring_criteria" ("parent_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "scoring_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(150) NOT NULL, "description" text, "target_score" double precision NOT NULL DEFAULT '100', "created_by_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_78db8960f43b510f0cbf0dd0158" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9f3b5d15bcdfa9f0663fa1db58" ON "scoring_templates" ("created_by_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "scoring_criteria" ADD CONSTRAINT "FK_18a1a2b483a6c8f59dbed8a5405" FOREIGN KEY ("template_id") REFERENCES "scoring_templates"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "scoring_criteria" ADD CONSTRAINT "FK_7550ec36d6569225ee43876f2fd" FOREIGN KEY ("parent_id") REFERENCES "scoring_criteria"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "scoring_templates" ADD CONSTRAINT "FK_9f3b5d15bcdfa9f0663fa1db583" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scoring_templates" DROP CONSTRAINT "FK_9f3b5d15bcdfa9f0663fa1db583"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scoring_criteria" DROP CONSTRAINT "FK_7550ec36d6569225ee43876f2fd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scoring_criteria" DROP CONSTRAINT "FK_18a1a2b483a6c8f59dbed8a5405"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9f3b5d15bcdfa9f0663fa1db58"`,
    );
    await queryRunner.query(`DROP TABLE "scoring_templates"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7550ec36d6569225ee43876f2f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_18a1a2b483a6c8f59dbed8a540"`,
    );
    await queryRunner.query(`DROP TABLE "scoring_criteria"`);
    await queryRunner.query(`DROP TYPE "public"."scoring_criteria_type_enum"`);
  }
}
