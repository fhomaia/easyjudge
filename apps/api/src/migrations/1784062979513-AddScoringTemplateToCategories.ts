import { MigrationInterface, QueryRunner } from "typeorm";

export class AddScoringTemplateToCategories1784062979513 implements MigrationInterface {
    name = 'AddScoringTemplateToCategories1784062979513'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "categories" ADD "scoring_template_id" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_4d5430d3b49f62250b18834e95" ON "categories" ("scoring_template_id") `);
        await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "FK_4d5430d3b49f62250b18834e956" FOREIGN KEY ("scoring_template_id") REFERENCES "scoring_templates"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_4d5430d3b49f62250b18834e956"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4d5430d3b49f62250b18834e95"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "scoring_template_id"`);
    }

}
