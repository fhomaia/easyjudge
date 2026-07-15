import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateJudgingAssignments1784138070235 implements MigrationInterface {
    name = 'CreateJudgingAssignments1784138070235'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "criterion_judge_assignments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "criterion_id" uuid NOT NULL, "judge_participation_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_e42cdd0264fa854591f9037307c" UNIQUE ("criterion_id", "judge_participation_id"), CONSTRAINT "PK_0af6a0d77a882f332f152f40d0d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d3eb795de9c4f210e734960ed5" ON "criterion_judge_assignments" ("criterion_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8fa54b27bc10f19ace3dc1269d" ON "criterion_judge_assignments" ("judge_participation_id") `);
        await queryRunner.query(`CREATE TYPE "public"."special_role_assignments_role_enum" AS ENUM('legality_judge', 'head_judge')`);
        await queryRunner.query(`CREATE TABLE "special_role_assignments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "event_id" uuid NOT NULL, "role" "public"."special_role_assignments_role_enum" NOT NULL, "judge_participation_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_333cdf233d7df43056dc295d48b" UNIQUE ("event_id", "role", "judge_participation_id"), CONSTRAINT "PK_084990ac99aeec1c4d5b91313bc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_51a841a8a5bc19a7ebcb291c12" ON "special_role_assignments" ("event_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8221456fe84703db76086f10d3" ON "special_role_assignments" ("judge_participation_id") `);
        await queryRunner.query(`ALTER TABLE "criterion_judge_assignments" ADD CONSTRAINT "FK_d3eb795de9c4f210e734960ed57" FOREIGN KEY ("criterion_id") REFERENCES "scoring_criteria"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "criterion_judge_assignments" ADD CONSTRAINT "FK_8fa54b27bc10f19ace3dc1269d3" FOREIGN KEY ("judge_participation_id") REFERENCES "judge_participations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "special_role_assignments" ADD CONSTRAINT "FK_51a841a8a5bc19a7ebcb291c12f" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "special_role_assignments" ADD CONSTRAINT "FK_8221456fe84703db76086f10d31" FOREIGN KEY ("judge_participation_id") REFERENCES "judge_participations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "special_role_assignments" DROP CONSTRAINT "FK_8221456fe84703db76086f10d31"`);
        await queryRunner.query(`ALTER TABLE "special_role_assignments" DROP CONSTRAINT "FK_51a841a8a5bc19a7ebcb291c12f"`);
        await queryRunner.query(`ALTER TABLE "criterion_judge_assignments" DROP CONSTRAINT "FK_8fa54b27bc10f19ace3dc1269d3"`);
        await queryRunner.query(`ALTER TABLE "criterion_judge_assignments" DROP CONSTRAINT "FK_d3eb795de9c4f210e734960ed57"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8221456fe84703db76086f10d3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_51a841a8a5bc19a7ebcb291c12"`);
        await queryRunner.query(`DROP TABLE "special_role_assignments"`);
        await queryRunner.query(`DROP TYPE "public"."special_role_assignments_role_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8fa54b27bc10f19ace3dc1269d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d3eb795de9c4f210e734960ed5"`);
        await queryRunner.query(`DROP TABLE "criterion_judge_assignments"`);
    }

}
