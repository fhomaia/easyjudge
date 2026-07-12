import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLogoUrlToEventsAndTeams1783887903011 implements MigrationInterface {
    name = 'AddLogoUrlToEventsAndTeams1783887903011'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "teams" ADD "logo_url" character varying`);
        await queryRunner.query(`ALTER TABLE "events" ADD "logo_url" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "logo_url"`);
        await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN "logo_url"`);
    }

}
