import { MigrationInterface, QueryRunner } from 'typeorm';

// Notificação pra uma pessoa só (2026-10-05): `user_id` preenchido = só
// essa conta vê (além da regra de audiência). Primeiro uso: "ficha
// liberada para edição" pro programa.
export class AddNotificationRecipient1790230000000 implements MigrationInterface {
  name = 'AddNotificationRecipient1790230000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notifications" ADD "user_id" uuid`);
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'registration_reopened'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "user_id"`);
  }
}
