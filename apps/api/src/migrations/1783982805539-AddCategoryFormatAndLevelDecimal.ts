import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCategoryFormatAndLevelDecimal1783982805539 implements MigrationInterface {
    name = 'AddCategoryFormatAndLevelDecimal1783982805539'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."categories_category_format_enum" AS ENUM('team_cheer', 'group_stunt', 'coed', 'partner', 'custom')`);
        await queryRunner.query(`ALTER TABLE "categories" ADD "category_format" "public"."categories_category_format_enum" NOT NULL DEFAULT 'team_cheer'`);
        await queryRunner.query(`ALTER TABLE "categories" ALTER COLUMN "category_format" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "categories" ADD "non_tumbling" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "level"`);
        await queryRunner.query(`ALTER TABLE "categories" ADD "level" double precision NOT NULL DEFAULT 1`);
        await queryRunner.query(`ALTER TABLE "categories" ALTER COLUMN "level" DROP DEFAULT`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "level"`);
        await queryRunner.query(`ALTER TABLE "categories" ADD "level" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "non_tumbling"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "category_format"`);
        await queryRunner.query(`DROP TYPE "public"."categories_category_format_enum"`);
    }

}
