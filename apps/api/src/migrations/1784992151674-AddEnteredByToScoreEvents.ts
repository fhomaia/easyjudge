import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEnteredByToScoreEvents1784992151674 implements MigrationInterface {
  name = 'AddEnteredByToScoreEvents1784992151674';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "score_events" ADD "entered_by_judge_participation_id" uuid`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "score_events" DROP COLUMN "entered_by_judge_participation_id"`,
    );
  }
}
