import { MigrationInterface, QueryRunner } from 'typeorm';

// Critérios de divisão configuráveis por evento (2026-10-06).
// - `category_criteria_settings`: uma linha por evento (aliasId) com os
//   critérios ligados, a ordem e as opções. Sem linha = padrão (Vínculo,
//   Gênero e Nível ligados, como antes), então nenhum evento muda.
// - `categories.modality`/`division` viram varchar (opção criada pelo
//   produtor não cabe no enum) e aceitam null (critério desligado). Os
//   valores atuais continuam válidos: são os ids das opções padrão.
// - Colunas novas `regime`, `age_group`, `size`; `level` aceita null.
// Só acrescenta/afrouxa: a versão anterior da API continua funcionando
// com o banco migrado durante o deploy.
export class CreateCategoryCriteria1790240000000 implements MigrationInterface {
  name = 'CreateCategoryCriteria1790240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "category_criteria_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "alias_id" uuid NOT NULL, "criteria" jsonb NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_category_criteria_settings" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_category_criteria_settings_alias_id" ON "category_criteria_settings" ("alias_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "modality" TYPE varchar USING "modality"::text`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "modality" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "division" TYPE varchar USING "division"::text`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "division" DROP NOT NULL`,
    );
    await queryRunner.query(`DROP TYPE "categories_modality_enum"`);
    await queryRunner.query(`DROP TYPE "categories_division_enum"`);

    await queryRunner.query(`ALTER TABLE "categories" ADD "regime" varchar`);
    await queryRunner.query(`ALTER TABLE "categories" ADD "age_group" varchar`);
    await queryRunner.query(`ALTER TABLE "categories" ADD "size" varchar`);
    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "level" DROP NOT NULL`,
    );
  }

  // Só volta se nenhuma categoria usar opção criada pelo produtor nem
  // estiver sem vínculo/gênero/nível (o enum antigo não aceitaria).
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "level" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "size"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "age_group"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "regime"`);

    await queryRunner.query(
      `CREATE TYPE "categories_division_enum" AS ENUM('coed', 'all_girl', 'all_boy')`,
    );
    await queryRunner.query(
      `CREATE TYPE "categories_modality_enum" AS ENUM('all_star', 'university', 'school')`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "division" TYPE "categories_division_enum" USING "division"::"categories_division_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "division" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "modality" TYPE "categories_modality_enum" USING "modality"::"categories_modality_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "modality" SET NOT NULL`,
    );

    await queryRunner.query(
      `DROP INDEX "IDX_category_criteria_settings_alias_id"`,
    );
    await queryRunner.query(`DROP TABLE "category_criteria_settings"`);
  }
}
