import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddColorToScheduleResources1784241775961 implements MigrationInterface {
  name = 'AddColorToScheduleResources1784241775961';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule_resources" ADD "color" character varying(20)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule_resources" DROP COLUMN "color"`,
    );
  }
}
