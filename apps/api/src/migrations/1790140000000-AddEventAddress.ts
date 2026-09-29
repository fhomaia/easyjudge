import { MigrationInterface, QueryRunner } from 'typeorm';

// Endereço completo do evento (rua, número), opcional (2026-09-29).
// Só cria a coluna; eventos antigos ficam sem endereço.
export class AddEventAddress1790140000000 implements MigrationInterface {
  name = 'AddEventAddress1790140000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD "address" character varying(300)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "address"`);
  }
}
