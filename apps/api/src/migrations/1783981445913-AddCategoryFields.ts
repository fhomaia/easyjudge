import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCategoryFields1783981445913 implements MigrationInterface {
    name = 'AddCategoryFields1783981445913'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "event_members" DROP CONSTRAINT "FK_event_members_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_events_alias_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_events_alias_id_active"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_event_members_alias_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_event_members_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_event_members_alias_id_user_id"`);
        await queryRunner.query(`CREATE TYPE "public"."categories_modality_enum" AS ENUM('all_star', 'university', 'school')`);
        await queryRunner.query(`ALTER TABLE "categories" ADD "modality" "public"."categories_modality_enum" NOT NULL DEFAULT 'all_star'`);
        await queryRunner.query(`ALTER TABLE "categories" ALTER COLUMN "modality" DROP DEFAULT`);
        await queryRunner.query(`CREATE TYPE "public"."categories_division_enum" AS ENUM('coed', 'all_girl', 'all_boy')`);
        await queryRunner.query(`ALTER TABLE "categories" ADD "division" "public"."categories_division_enum" NOT NULL DEFAULT 'coed'`);
        await queryRunner.query(`ALTER TABLE "categories" ALTER COLUMN "division" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "categories" ADD "level" integer NOT NULL DEFAULT 1`);
        await queryRunner.query(`ALTER TABLE "categories" ALTER COLUMN "level" DROP DEFAULT`);
        await queryRunner.query(`CREATE TYPE "public"."categories_status_enum" AS ENUM('active', 'inactive')`);
        await queryRunner.query(`ALTER TABLE "categories" ADD "status" "public"."categories_status_enum" NOT NULL DEFAULT 'active'`);
        await queryRunner.query(`CREATE INDEX "IDX_d896152950c06400ad40ed7291" ON "events" ("alias_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_7c2ef0b43646079d25465ca7bd" ON "event_members" ("alias_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d428fa2fcb5c4d17598284064b" ON "event_members" ("user_id") `);
        await queryRunner.query(`ALTER TABLE "event_members" ADD CONSTRAINT "FK_d428fa2fcb5c4d17598284064b8" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "event_members" DROP CONSTRAINT "FK_d428fa2fcb5c4d17598284064b8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d428fa2fcb5c4d17598284064b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7c2ef0b43646079d25465ca7bd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d896152950c06400ad40ed7291"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."categories_status_enum"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "level"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "division"`);
        await queryRunner.query(`DROP TYPE "public"."categories_division_enum"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "modality"`);
        await queryRunner.query(`DROP TYPE "public"."categories_modality_enum"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_event_members_alias_id_user_id" ON "event_members" ("alias_id", "user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_event_members_user_id" ON "event_members" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_event_members_alias_id" ON "event_members" ("alias_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_events_alias_id_active" ON "events" ("alias_id") WHERE (active = true)`);
        await queryRunner.query(`CREATE INDEX "IDX_events_alias_id" ON "events" ("alias_id") `);
        await queryRunner.query(`ALTER TABLE "event_members" ADD CONSTRAINT "FK_event_members_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
