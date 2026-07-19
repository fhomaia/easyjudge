import { MigrationInterface, QueryRunner } from 'typeorm';

// Renomeia o valor 'participant' do enum event_members_role_enum pra
// 'assessor' — nomenclatura correta é "Assessor" (ajuda a configurar o
// evento, mas não mexe em acessos/pessoas), não "Participante" (nenhum
// EventMember tinha esse role em uso, confirmado antes de rodar).
export class RenameEventMemberParticipantToAssessor1784500000000 implements MigrationInterface {
  name = 'RenameEventMemberParticipantToAssessor1784500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."event_members_role_enum" RENAME VALUE 'participant' TO 'assessor'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."event_members_role_enum" RENAME VALUE 'assessor' TO 'participant'`,
    );
  }
}
