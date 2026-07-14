import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPresentationTimeToCategories1784064543734 implements MigrationInterface {
    name = 'AddPresentationTimeToCategories1784064543734'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "categories" ADD "presentation_time_seconds" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "presentation_time_seconds"`);
    }

}
