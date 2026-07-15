import { MigrationInterface, QueryRunner } from 'typeorm';

// Renomeia o domínio Team (nome/email/cidade/estado, vinculado a um
// evento) -> Program, mantendo os dados existentes (RENAME, não
// DROP+CREATE — migration:generate não sabe fazer rename de tabela).
// Um domínio Team novo (equipe dentro de um programa) é criado numa
// migration separada, gerada normalmente depois que os entities novos
// existirem.
export class RenameTeamsToPrograms1784067496956 implements MigrationInterface {
  name = 'RenameTeamsToPrograms1784067496956';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "teams" RENAME TO "programs"`);
    // Postgres não renomeia o nome da constraint/índice da PK junto com
    // a tabela — sem isso, o nome antigo ("PK_..." calculado a partir
    // do nome da tabela "teams") colide com o da PK do domínio Team
    // novo (criado do zero com o mesmo nome "teams" na migration
    // seguinte, CreateNewTeamsAndCategoryLinks).
    await queryRunner.query(
      `ALTER TABLE "programs" RENAME CONSTRAINT "PK_7e5523774a38b08a6236d322403" TO "PK_programs_id"`,
    );
    await queryRunner.query(`ALTER TABLE "programs" ADD "user_id" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_programs_user_id" ON "programs" ("user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "programs" ADD CONSTRAINT "FK_programs_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "programs" DROP CONSTRAINT "FK_programs_user_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_programs_user_id"`);
    await queryRunner.query(`ALTER TABLE "programs" DROP COLUMN "user_id"`);
    await queryRunner.query(
      `ALTER TABLE "programs" RENAME CONSTRAINT "PK_programs_id" TO "PK_7e5523774a38b08a6236d322403"`,
    );
    await queryRunner.query(`ALTER TABLE "programs" RENAME TO "teams"`);
  }
}
