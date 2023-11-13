import { MigrationInterface, QueryRunner } from "typeorm"

export class AddEmblemSubtitle1699530429930 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE emblem ADD COLUMN subtitle VARCHAR');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE emblem DROP COLUMN subtitle');
    }

}
