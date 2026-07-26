import { MigrationInterface, QueryRunner } from 'typeorm';

// Amplia o log de atividade do evento (antes só criado/editado/
// publicado/revertido/iniciado/excluído) pra também cobrir ações nas
// telas de cadastro (categorias, programas, equipes, regulamento,
// gerenciar acessos) — a pedido do usuário, 2026-07-26. `detail` é
// novo: nome da entidade afetada (ex: nome da categoria), pra formar
// mensagens como "Categoria criada: Senior Coed Elite" sem precisar de
// um valor de enum por combinação de ação+entidade.
export class ExpandEventActivityLog1785091124000 implements MigrationInterface {
  name = 'ExpandEventActivityLog1785091124000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_activity_logs" ADD "detail" character varying`,
    );
    const newValues = [
      'category_created',
      'category_updated',
      'category_deleted',
      'program_created',
      'program_updated',
      'program_deleted',
      'team_created',
      'team_updated',
      'team_deleted',
      'regulation_document_uploaded',
      'regulation_document_removed',
      'regulation_deductions_updated',
      'staff_member_added',
      'staff_member_updated',
      'staff_member_removed',
    ];
    for (const value of newValues) {
      await queryRunner.query(
        `ALTER TYPE "public"."event_activity_logs_action_enum" ADD VALUE '${value}'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "event_activity_logs" WHERE "action" NOT IN ('created', 'updated', 'published', 'unpublished', 'started', 'deleted')`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."event_activity_logs_action_enum" RENAME TO "event_activity_logs_action_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."event_activity_logs_action_enum" AS ENUM('created', 'updated', 'published', 'unpublished', 'started', 'deleted')`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_activity_logs" ALTER COLUMN "action" TYPE "public"."event_activity_logs_action_enum" USING "action"::"text"::"public"."event_activity_logs_action_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."event_activity_logs_action_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_activity_logs" DROP COLUMN "detail"`,
    );
  }
}
