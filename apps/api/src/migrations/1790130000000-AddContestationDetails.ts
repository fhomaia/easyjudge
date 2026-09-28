import { MigrationInterface, QueryRunner } from 'typeorm';

// Descrição e imagens enviadas pela equipe ao solicitar contestação
// (2026-09-28). Só cria colunas; contestações antigas ficam sem nada.
export class AddContestationDetails1790130000000 implements MigrationInterface {
  name = 'AddContestationDetails1790130000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" ADD "contestation_description" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" ADD "contestation_attachments" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" DROP COLUMN "contestation_attachments"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" DROP COLUMN "contestation_description"`,
    );
  }
}
