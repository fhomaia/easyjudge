import { MigrationInterface, QueryRunner } from 'typeorm';

// Parâmetros do "gerar automaticamente" por EVENTO (uma linha por
// aliasId, sem FK, mesmo padrão dos outros filhos de evento). Sem linha
// = padrão (formato primeiro, nível crescente), então eventos
// existentes não mudam de comportamento.
export class CreateScheduleAutoSettings1789840000000
  implements MigrationInterface
{
  name = 'CreateScheduleAutoSettings1789840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "schedule_auto_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "alias_id" uuid NOT NULL,
        "order_primary" character varying NOT NULL DEFAULT 'format',
        "level_direction" character varying NOT NULL DEFAULT 'asc',
        "format_order" jsonb NOT NULL DEFAULT '[]',
        "special_events" jsonb NOT NULL DEFAULT '[]',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_schedule_auto_settings_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_schedule_auto_settings_alias_id" ON "schedule_auto_settings" ("alias_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_schedule_auto_settings_alias_id"`,
    );
    await queryRunner.query(`DROP TABLE "schedule_auto_settings"`);
  }
}
