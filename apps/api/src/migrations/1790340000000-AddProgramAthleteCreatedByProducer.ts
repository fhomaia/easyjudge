import { MigrationInterface, QueryRunner } from 'typeorm';

// O produtor só vê atletas inscritos, com ficha enviada ou cadastrados por
// ele (2026-10-11). Os que já existiam e não vieram de um pedido do atleta
// ficam marcados como do produtor, pra nada sumir da tela dele.
export class AddProgramAthleteCreatedByProducer1790340000000 implements MigrationInterface {
  name = 'AddProgramAthleteCreatedByProducer1790340000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "program_athletes" ADD "created_by_producer" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `UPDATE "program_athletes" pa SET "created_by_producer" = true
       WHERE NOT EXISTS (
         SELECT 1 FROM "athlete_registration_requests" r
         WHERE r."program_athlete_id" = pa."id"
       )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "program_athletes" DROP COLUMN "created_by_producer"`,
    );
  }
}
