import { MigrationInterface, QueryRunner } from 'typeorm';

// Aviso de item obrigatório novo na ficha de inscrição depois de liberar
// as inscrições (2026-11-10). Só acrescenta um valor ao enum.
export class AddRegistrationRequirementAddedNotification1790350000000 implements MigrationInterface {
  name = 'AddRegistrationRequirementAddedNotification1790350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'registration_requirement_added'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres não remove valor de enum; fica sem uso.
  }
}
