import { MigrationInterface, QueryRunner } from "typeorm";

// Gerada via `migration:generate`, mas com o diff limpo à mão: o banco
// de dev tinha drift pré-existente (constraints/índices de
// program_participations com nome customizado, enum de
// event_members.roles) que a geração automática tentou "corrigir"
// junto — nada disso tem relação com score_events, então foi removido
// daqui pra não arriscar mexer em schema não relacionado.
export class CreateScoreEvents1784854147724 implements MigrationInterface {
    name = 'CreateScoreEvents1784854147724'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."score_events_kind_enum" AS ENUM('score_set', 'deduction_add', 'deduction_remove', 'comment_set', 'sketch_set')`);
        await queryRunner.query(`CREATE TYPE "public"."score_events_deduction_type_enum" AS ENUM('athlete_fall', 'major_athlete_fall', 'building_bobble', 'building_fall', 'major_building_fall', 'legality_infractions', 'skill_out_of_level', 'time_limit_violations', 'boundary_violations')`);
        await queryRunner.query(`CREATE TABLE "score_events" ("id" uuid NOT NULL, "schedule_entry_id" character varying NOT NULL, "judge_participation_id" character varying NOT NULL, "kind" "public"."score_events_kind_enum" NOT NULL, "criterion_id" uuid, "value" double precision, "deduction_type" "public"."score_events_deduction_type_enum", "undoes_event_id" uuid, "presentation_elapsed_ms" integer, "text" text, "client_created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1b2270cf7ddc638ef13a1424da1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3decc72f44a02a1277fb771d43" ON "score_events" ("schedule_entry_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_1b0efa703682c8b109c6ebb2d0" ON "score_events" ("judge_participation_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_1b0efa703682c8b109c6ebb2d0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3decc72f44a02a1277fb771d43"`);
        await queryRunner.query(`DROP TABLE "score_events"`);
        await queryRunner.query(`DROP TYPE "public"."score_events_deduction_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."score_events_kind_enum"`);
    }

}
