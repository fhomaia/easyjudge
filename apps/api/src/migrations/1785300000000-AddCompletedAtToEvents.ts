import { MigrationInterface, QueryRunner } from 'typeorm';

// Suporte à transição started -> completed (EventsService.completeEvent)
// — mesmo padrão de started_at (EventsService.startEvent), nullable e
// nunca reescrito.
export class AddCompletedAtToEvents1785300000000
  implements MigrationInterface
{
  name = 'AddCompletedAtToEvents1785300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD "completed_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "completed_at"`);
  }
}
