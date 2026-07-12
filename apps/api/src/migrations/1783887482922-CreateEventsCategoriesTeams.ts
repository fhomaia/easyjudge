import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateEventsCategoriesTeams1783887482922 implements MigrationInterface {
    name = 'CreateEventsCategoriesTeams1783887482922'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "event_id" uuid NOT NULL, "name" character varying(150) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_39c8f73f2fcde968ed18ac9952" ON "categories" ("event_id") `);
        await queryRunner.query(`CREATE TABLE "teams" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "event_id" uuid NOT NULL, "name" character varying(150) NOT NULL, "email" character varying NOT NULL, "city" character varying(100) NOT NULL, "state" character varying(2) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7e5523774a38b08a6236d322403" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_26d243fdc44c2b67e541b796a8" ON "teams" ("event_id") `);
        await queryRunner.query(`CREATE TABLE "events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(150) NOT NULL, "start_date" date NOT NULL, "competition_days" integer NOT NULL, "location" character varying(150) NOT NULL, "created_by_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_08e606dc5182b142dc916e7aba" ON "events" ("created_by_id") `);
        await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "FK_39c8f73f2fcde968ed18ac99528" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teams" ADD CONSTRAINT "FK_26d243fdc44c2b67e541b796a81" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "FK_08e606dc5182b142dc916e7abab" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "FK_08e606dc5182b142dc916e7abab"`);
        await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_26d243fdc44c2b67e541b796a81"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_39c8f73f2fcde968ed18ac99528"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_08e606dc5182b142dc916e7aba"`);
        await queryRunner.query(`DROP TABLE "events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_26d243fdc44c2b67e541b796a8"`);
        await queryRunner.query(`DROP TABLE "teams"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_39c8f73f2fcde968ed18ac9952"`);
        await queryRunner.query(`DROP TABLE "categories"`);
    }

}
