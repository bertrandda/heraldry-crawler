import { MigrationInterface, QueryRunner } from "typeorm"

export class AddEmblemPath1692113677542 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE emblem ADD COLUMN country VARCHAR');
        await queryRunner.query('ALTER TABLE emblem ADD COLUMN path VARCHAR');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE emblem DROP COLUMN country');
        await queryRunner.query('ALTER TABLE emblem DROP COLUMN path');
    }

}
