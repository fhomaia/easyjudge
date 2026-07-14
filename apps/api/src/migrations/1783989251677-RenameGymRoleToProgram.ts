import { MigrationInterface, QueryRunner } from 'typeorm';

// Renomeia o valor 'gym' do enum users_role_enum pra 'program' —
// nomenclatura correta é "Programa", não "Ginásio" (nenhum usuário
// tinha esse role em uso ainda, então é seguro renomear em vez de
// versionar/migrar dados).
export class RenameGymRoleToProgram1783989251677
  implements MigrationInterface
{
  name = 'RenameGymRoleToProgram1783989251677';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."users_role_enum" RENAME VALUE 'gym' TO 'program'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."users_role_enum" RENAME VALUE 'program' TO 'gym'`,
    );
  }
}
