import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateJudgeParticipationsAndProfiles1784117377055 implements MigrationInterface {
    name = 'CreateJudgeParticipationsAndProfiles1784117377055'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "judge_participations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "event_id" uuid NOT NULL, "created_by_id" uuid NOT NULL, "user_id" uuid, "name" character varying(150) NOT NULL, "email" character varying NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_89a142b63cd1b3fe47b6945c9dd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5b21bad120f1e1c1f7ed4f5568" ON "judge_participations" ("event_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_51e5346e68dfb16f5290933bb4" ON "judge_participations" ("created_by_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_36d63a4e5a32888a64e8291e2b" ON "judge_participations" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "judge_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "name" character varying(150) NOT NULL, "contact_email" character varying NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_73c011f79ee66f4312d8ccf0e7" UNIQUE ("user_id"), CONSTRAINT "PK_fa2402e977e3803d435786dbaab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_73c011f79ee66f4312d8ccf0e7" ON "judge_profiles" ("user_id") `);
        await queryRunner.query(`ALTER TABLE "judge_participations" ADD CONSTRAINT "FK_5b21bad120f1e1c1f7ed4f5568d" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "judge_participations" ADD CONSTRAINT "FK_51e5346e68dfb16f5290933bb49" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "judge_participations" ADD CONSTRAINT "FK_36d63a4e5a32888a64e8291e2bf" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "judge_profiles" ADD CONSTRAINT "FK_73c011f79ee66f4312d8ccf0e75" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "judge_profiles" DROP CONSTRAINT "FK_73c011f79ee66f4312d8ccf0e75"`);
        await queryRunner.query(`ALTER TABLE "judge_participations" DROP CONSTRAINT "FK_36d63a4e5a32888a64e8291e2bf"`);
        await queryRunner.query(`ALTER TABLE "judge_participations" DROP CONSTRAINT "FK_51e5346e68dfb16f5290933bb49"`);
        await queryRunner.query(`ALTER TABLE "judge_participations" DROP CONSTRAINT "FK_5b21bad120f1e1c1f7ed4f5568d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_73c011f79ee66f4312d8ccf0e7"`);
        await queryRunner.query(`DROP TABLE "judge_profiles"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_36d63a4e5a32888a64e8291e2b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_51e5346e68dfb16f5290933bb4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5b21bad120f1e1c1f7ed4f5568"`);
        await queryRunner.query(`DROP TABLE "judge_participations"`);
    }

}
