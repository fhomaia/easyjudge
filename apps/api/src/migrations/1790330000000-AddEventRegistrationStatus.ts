import { MigrationInterface, QueryRunner } from 'typeorm';

// Liberação das inscrições pelo produtor (2026-10-11): 'not_started'
// (padrão de evento novo), 'open' ou 'paused'. Os eventos que já existiam
// ficam 'open', pra nada mudar pra quem já está se inscrevendo.
export class AddEventRegistrationStatus1790330000000 implements MigrationInterface {
  name = 'AddEventRegistrationStatus1790330000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD "registration_status" varchar(20) NOT NULL DEFAULT 'open'`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ALTER COLUMN "registration_status" SET DEFAULT 'not_started'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "registration_status"`,
    );
  }
}
