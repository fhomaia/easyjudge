import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1783872641143 implements MigrationInterface {
    name = 'InitialSchema1783872641143'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('judge', 'athlete', 'organization')`);
        await queryRunner.query(`CREATE TYPE "public"."users_document_type_enum" AS ENUM('cpf', 'cnpj')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "role" "public"."users_role_enum" NOT NULL, "first_name" character varying NOT NULL, "last_name" character varying NOT NULL, "document_type" "public"."users_document_type_enum" NOT NULL, "document_number" character varying NOT NULL, "email" character varying NOT NULL, "team_or_institution_name" character varying, "password_hash" character varying, "email_verified_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5f6c1b67ac12a1e7eb454a48e5" ON "users"  ("document_number") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users"  ("email") `);
        await queryRunner.query(`CREATE TABLE "email_verifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "code" character varying(6) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c1ea2921e767f83cd44c0af203f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c4f1838323ae1dff5aa0014891" ON "email_verifications"  ("user_id") `);
        await queryRunner.query(`ALTER TABLE "email_verifications" ADD CONSTRAINT "FK_c4f1838323ae1dff5aa00148915" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "email_verifications" DROP CONSTRAINT "FK_c4f1838323ae1dff5aa00148915"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c4f1838323ae1dff5aa0014891"`);
        await queryRunner.query(`DROP TABLE "email_verifications"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5f6c1b67ac12a1e7eb454a48e5"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_document_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }

}
