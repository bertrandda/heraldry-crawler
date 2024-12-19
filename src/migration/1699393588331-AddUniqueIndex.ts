import { MigrationInterface, QueryRunner } from "typeorm"

export class AddUniqueIndex1699393588331 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('CREATE UNIQUE INDEX unique_path ON emblem(path)');
        await queryRunner.query('CREATE UNIQUE INDEX unique_name_image ON emblem(name, imageUrl)');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX unique_path');
        await queryRunner.query('DROP INDEX unique_name_image');
    }

}
