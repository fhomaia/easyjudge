import { MigrationInterface, QueryRunner } from 'typeorm';

// Código de compartilhamento (QR + texto) — estável através das
// versões de um mesmo evento (gerado uma vez no primeiro publish, ver
// EventsService.publishEvent). Nullable: eventos ainda não publicados
// (ou publicados antes desta migration, até a próxima republicação)
// não têm código.
//
// Índice único escopado a `active = true` (mesmo padrão de
// IDX_events_alias_id_active) — de propósito, NÃO "WHERE event_code
// IS NOT NULL" sozinho: ao republicar, o código é carregado adiante
// pra versão nova, mas a versão antiga (agora active=false) continua
// com o MESMO event_code gravado (é histórico, nunca é limpo) — um
// índice único sem o filtro de active bateria nela mesma a cada
// republicação.
export class AddEventCodeToEvents1785200000000 implements MigrationInterface {
  name = 'AddEventCodeToEvents1785200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD "event_code" character varying(16)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_events_event_code" ON "events" ("event_code") WHERE "event_code" IS NOT NULL AND "active" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_events_event_code"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "event_code"`);
  }
}
