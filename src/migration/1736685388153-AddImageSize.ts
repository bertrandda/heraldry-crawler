import { MigrationInterface, QueryRunner } from "typeorm"

export class AddImageSize1736685388153 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE emblem ADD COLUMN size JSON');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE emblem DROP COLUMN size');
    }

}
