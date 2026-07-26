import { MigrationInterface, QueryRunner } from 'typeorm';

// "Liberar notas"/"Liberar contestação" viraram ação global do evento
// (a pedido do usuário — um switch só libera pra todas as
// apresentações de uma vez, em vez de visitar uma por uma). Migra o
// estado atual de `schedule_entries` (se alguma linha já tivesse sido
// liberada manualmente) pro evento — soma via bool_or, já que a coluna
// nova é por evento (aliasId), não por versão/linha. `contestation_requested_at`
// continua em `schedule_entries` (é por apresentação de verdade — uma
// equipe contesta a própria rotina, não o evento inteiro).
export class MoveReleaseFlagsToEvents1785010000000 implements MigrationInterface {
  name = 'MoveReleaseFlagsToEvents1785010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD "scores_released_at" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD "contestation_released_at" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD "results_released_at" timestamptz`,
    );

    await queryRunner.query(`
      UPDATE "events" e SET "scores_released_at" = now()
      WHERE EXISTS (
        SELECT 1 FROM "schedule_entries" se
        INNER JOIN "schedule_resources" sr ON sr.id = se.resource_id
        INNER JOIN "schedule_days" sd ON sd.id = sr.schedule_day_id
        WHERE sd.alias_id = e.alias_id AND se.scores_released_at IS NOT NULL
      )
    `);
    await queryRunner.query(`
      UPDATE "events" e SET "contestation_released_at" = now()
      WHERE EXISTS (
        SELECT 1 FROM "schedule_entries" se
        INNER JOIN "schedule_resources" sr ON sr.id = se.resource_id
        INNER JOIN "schedule_days" sd ON sd.id = sr.schedule_day_id
        WHERE sd.alias_id = e.alias_id AND se.contestation_released_at IS NOT NULL
      )
    `);

    await queryRunner.query(
      `ALTER TABLE "schedule_entries" DROP COLUMN "scores_released_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" DROP COLUMN "contestation_released_at"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" ADD "scores_released_at" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" ADD "contestation_released_at" timestamptz`,
    );

    await queryRunner.query(`
      UPDATE "schedule_entries" se SET "scores_released_at" = now()
      FROM "schedule_resources" sr
      INNER JOIN "schedule_days" sd ON sd.id = sr.schedule_day_id
      INNER JOIN "events" e ON e.alias_id = sd.alias_id
      WHERE sr.id = se.resource_id AND e.scores_released_at IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "schedule_entries" se SET "contestation_released_at" = now()
      FROM "schedule_resources" sr
      INNER JOIN "schedule_days" sd ON sd.id = sr.schedule_day_id
      INNER JOIN "events" e ON e.alias_id = sd.alias_id
      WHERE sr.id = se.resource_id AND e.contestation_released_at IS NOT NULL
    `);

    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "results_released_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "contestation_released_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "scores_released_at"`,
    );
  }
}
