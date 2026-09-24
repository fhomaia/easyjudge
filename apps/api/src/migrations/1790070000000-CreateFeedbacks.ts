import { MigrationInterface, QueryRunner } from 'typeorm';

// Avaliações separadas do evento e da plataforma (ver EventFeedback/
// PlatformFeedback). Só cria tabelas, não mexe em dado existente.
export class CreateFeedbacks1790070000000 implements MigrationInterface {
  name = 'CreateFeedbacks1790070000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "event_feedbacks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "alias_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "rating" smallint NOT NULL,
        "comment" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_event_feedbacks_alias_user" UNIQUE ("alias_id", "user_id"),
        CONSTRAINT "CHK_event_feedbacks_rating" CHECK ("rating" BETWEEN 1 AND 5),
        CONSTRAINT "PK_event_feedbacks_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_feedbacks_alias_id" ON "event_feedbacks" ("alias_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_feedbacks" ADD CONSTRAINT "FK_event_feedbacks_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE TABLE "platform_feedbacks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "rating" smallint NOT NULL,
        "comment" text,
        "user_role" character varying NOT NULL,
        "page" character varying,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_platform_feedbacks_rating" CHECK ("rating" BETWEEN 1 AND 5),
        CONSTRAINT "PK_platform_feedbacks_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_feedbacks" ADD CONSTRAINT "FK_platform_feedbacks_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform_feedbacks" DROP CONSTRAINT "FK_platform_feedbacks_user"`,
    );
    await queryRunner.query(`DROP TABLE "platform_feedbacks"`);
    await queryRunner.query(
      `ALTER TABLE "event_feedbacks" DROP CONSTRAINT "FK_event_feedbacks_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_event_feedbacks_alias_id"`,
    );
    await queryRunner.query(`DROP TABLE "event_feedbacks"`);
  }
}
