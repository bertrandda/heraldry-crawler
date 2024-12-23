import { MigrationInterface, QueryRunner } from "typeorm"

export class ChangeNameImageConstraint1734948697006 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX unique_name_image');
        await queryRunner.query('CREATE UNIQUE INDEX unique_name_image ON emblem(armorial, name, imageUrl)');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX unique_name_image');
        await queryRunner.query('CREATE UNIQUE INDEX unique_name_image ON emblem(name, imageUrl)');
    }

}
