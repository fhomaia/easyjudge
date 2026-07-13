import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventVersioningAndMembers1783910423695 implements MigrationInterface {
  name = 'AddEventVersioningAndMembers1783910423695';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Versionamento do evento: alias_id é a identidade lógica estável
    // através das versões, version incrementa a cada publicação,
    // active marca qual linha é a vigente pra cada alias_id.
    await queryRunner.query(`ALTER TABLE "events" ADD "alias_id" uuid`);
    // Backfill: eventos já existentes viram a v1 (ativa) do próprio alias.
    await queryRunner.query(
      `UPDATE "events" SET "alias_id" = "id" WHERE "alias_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ALTER COLUMN "alias_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD "version" integer NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD "active" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_events_alias_id" ON "events" ("alias_id")`,
    );
    // Só uma versão ativa por alias_id.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_events_alias_id_active" ON "events" ("alias_id") WHERE "active" = true`,
    );

    // event_members: relação N x N entre users e eventos (via alias_id),
    // com papel por evento (admin/judge/participant/spectator).
    await queryRunner.query(
      `CREATE TYPE "public"."event_members_role_enum" AS ENUM('admin', 'judge', 'participant', 'spectator')`,
    );
    await queryRunner.query(
      `CREATE TABLE "event_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "alias_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role" "public"."event_members_role_enum" NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_event_members_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_members_alias_id" ON "event_members" ("alias_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_members_user_id" ON "event_members" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_event_members_alias_id_user_id" ON "event_members" ("alias_id", "user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_members" ADD CONSTRAINT "FK_event_members_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // Backfill: quem criou cada evento existente vira admin dele.
    await queryRunner.query(
      `INSERT INTO "event_members" ("alias_id", "user_id", "role") SELECT "alias_id", "created_by_id", 'admin' FROM "events"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_members" DROP CONSTRAINT "FK_event_members_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "event_members"`);
    await queryRunner.query(`DROP TYPE "public"."event_members_role_enum"`);

    await queryRunner.query(`DROP INDEX "public"."IDX_events_alias_id_active"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_events_alias_id"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "active"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "version"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "alias_id"`);
  }
}
