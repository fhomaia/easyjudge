import { MigrationInterface, QueryRunner } from 'typeorm';

// Escrita à mão (não via `migration:generate`) — o schema atual já
// tinha divergido do que os entities descrevem antes desta mudança
// (nomes de constraint/índice manuais de migrations anteriores vs. o
// que o TypeORM geraria hoje), então `migration:generate` tentava
// "corrigir" um monte de coisa não relacionada a este PR (renomear
// enum de roles, recriar índices/FKs existentes). Esta migration só
// cria a tabela nova, sem mexer em mais nada.
export class CreateEventActivityLogs1784758300000
  implements MigrationInterface
{
  name = 'CreateEventActivityLogs1784758300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."event_activity_logs_action_enum" AS ENUM('created', 'updated', 'published', 'unpublished', 'started', 'deleted')`,
    );
    await queryRunner.query(
      `CREATE TABLE "event_activity_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "event_alias_id" uuid NOT NULL, "action" "public"."event_activity_logs_action_enum" NOT NULL, "actor_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_event_activity_logs" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_activity_logs_event_alias_id" ON "event_activity_logs" ("event_alias_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_activity_logs_actor_id" ON "event_activity_logs" ("actor_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_activity_logs" ADD CONSTRAINT "FK_event_activity_logs_actor_id" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_activity_logs" DROP CONSTRAINT "FK_event_activity_logs_actor_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_event_activity_logs_actor_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_event_activity_logs_event_alias_id"`,
    );
    await queryRunner.query(`DROP TABLE "event_activity_logs"`);
    await queryRunner.query(
      `DROP TYPE "public"."event_activity_logs_action_enum"`,
    );
  }
}
