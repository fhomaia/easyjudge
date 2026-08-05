import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResets1785930882424 implements MigrationInterface {
  name = 'AddPasswordResets1785930882424';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "password_resets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid, "code" character varying(6), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "verified_at" TIMESTAMP WITH TIME ZONE, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4816377aa98211c1de34469e742" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f7a4c3bc48f24df007936d217b" ON "password_resets" ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "password_resets" ADD CONSTRAINT "FK_f7a4c3bc48f24df007936d217be" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "password_resets" DROP CONSTRAINT "FK_f7a4c3bc48f24df007936d217be"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f7a4c3bc48f24df007936d217b"`,
    );
    await queryRunner.query(`DROP TABLE "password_resets"`);
  }
}
