import { MigrationInterface, QueryRunner } from 'typeorm';

// Pedido de vínculo criado pelo produtor ao cadastrar um atleta num
// programa do evento (2026-10-05, ver AthletesService.requestLinkFromEvent):
// guarda o nome do evento pra o programa saber de onde veio o pedido. Só
// cria a coluna; vínculos existentes ficam com nulo.
export class AddAthleteLinkRequestedFromEvent1790190000000
  implements MigrationInterface
{
  name = 'AddAthleteLinkRequestedFromEvent1790190000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "athlete_links" ADD "requested_from_event" character varying(200)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "athlete_links" DROP COLUMN "requested_from_event"`,
    );
  }
}
