import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEventScoringTemplates1785690000000
  implements MigrationInterface
{
  name = 'CreateEventScoringTemplates1785690000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "event_scoring_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "alias_id" uuid NOT NULL, "template_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_event_scoring_templates_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_scoring_templates_alias_id" ON "event_scoring_templates" ("alias_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_event_scoring_templates_alias_template" ON "event_scoring_templates" ("alias_id", "template_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_scoring_templates" ADD CONSTRAINT "FK_event_scoring_templates_template" FOREIGN KEY ("template_id") REFERENCES "scoring_templates"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "event_scoring_templates"`);
  }
}
