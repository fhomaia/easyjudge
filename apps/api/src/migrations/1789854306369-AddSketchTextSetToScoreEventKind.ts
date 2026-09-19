import { MigrationInterface, QueryRunner } from 'typeorm';

// Novo ScoreEventKind (SKETCH_TEXT_SET) pro rascunho digitado —
// guardado à parte de SKETCH_SET (mesma tabela/coluna `text`, só um
// valor novo de enum) pra desenho e texto do rascunho nunca mais se
// apagarem um ao outro ao trocar de modo (pedido do usuário,
// 2026-09-19). Migration só aditiva: `ADD VALUE` não afeta nenhuma
// linha existente. Gerada pelo TypeORM originalmente arrastava deriva
// de schema alheia (índices/FKs/enum de EventMemberRole não
// relacionados) — reescrita à mão só com o necessário.
export class AddSketchTextSetToScoreEventKind1789854306369
  implements MigrationInterface
{
  name = 'AddSketchTextSetToScoreEventKind1789854306369';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."score_events_kind_enum" ADD VALUE 'sketch_text_set'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres não tem "DROP VALUE" de enum — precisa recriar o tipo
    // sem o valor novo (só chega a rodar num rollback manual; nenhuma
    // linha deve existir com kind='sketch_text_set' nesse ponto, já
    // que reverter implica desfazer o deploy que introduziu o recurso).
    await queryRunner.query(
      `ALTER TYPE "public"."score_events_kind_enum" RENAME TO "score_events_kind_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."score_events_kind_enum" AS ENUM('score_set', 'deduction_add', 'deduction_remove', 'comment_set', 'sketch_set', 'sheet_submitted', 'timer_started', 'timer_stopped', 'deduction_code_set')`,
    );
    await queryRunner.query(
      `ALTER TABLE "score_events" ALTER COLUMN "kind" TYPE "public"."score_events_kind_enum" USING "kind"::"text"::"public"."score_events_kind_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."score_events_kind_enum_old"`);
  }
}
