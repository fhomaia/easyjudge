import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVenueAndStartedAtToEvents1784686166480
  implements MigrationInterface
{
  name = 'AddVenueAndStartedAtToEvents1784686166480';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" ADD "venue" character varying`);
    await queryRunner.query(
      `ALTER TABLE "events" ADD "started_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "started_at"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "venue"`);
  }
}
