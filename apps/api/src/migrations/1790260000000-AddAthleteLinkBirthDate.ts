import { MigrationInterface, QueryRunner } from 'typeorm';

// Data de nascimento do atleta no elenco do programa (2026-10-06), pra
// conferir a idade nas categorias com regra de idade quando a conta não
// tem a data. Só acrescenta a coluna.
export class AddAthleteLinkBirthDate1790260000000 implements MigrationInterface {
  name = 'AddAthleteLinkBirthDate1790260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "athlete_links" ADD "birth_date" date`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "athlete_links" DROP COLUMN "birth_date"`,
    );
  }
}
