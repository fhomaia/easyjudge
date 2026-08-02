import { MigrationInterface, QueryRunner } from 'typeorm';

// `weight` nunca foi usado em nenhum cálculo de nota real (só copiado
// em ScoringTemplatesService.cloneCriteria e editável na UI) — pedido
// do usuário pra remover, depois de confirmar isso ao modelar o
// template Best Jumper (SPPB 2026), que citava "peso" mas não
// correspondia a nenhum multiplicador de fato aplicado.
export class DropWeightFromScoringCriteria1785600000000
  implements MigrationInterface
{
  name = 'DropWeightFromScoringCriteria1785600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scoring_criteria" DROP COLUMN "weight"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scoring_criteria" ADD "weight" double precision NOT NULL DEFAULT '1'`,
    );
  }
}
