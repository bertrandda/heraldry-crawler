import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGeoData1734639885017 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE emblem ADD COLUMN lat DOUBLE');
        await queryRunner.query('ALTER TABLE emblem ADD COLUMN lon DOUBLE');
        await queryRunner.query('ALTER TABLE emblem ADD COLUMN geohash VARCHAR');
        await queryRunner.query('ALTER TABLE emblem ADD COLUMN relatedPage VARCHAR');
        await queryRunner.query('ALTER TABLE emblem ADD COLUMN population INTEGER');
        await queryRunner.query('CREATE UNIQUE INDEX unique_geohash ON emblem(geohash)');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE emblem DROP COLUMN lat');
        await queryRunner.query('ALTER TABLE emblem DROP COLUMN lon');
        await queryRunner.query('ALTER TABLE emblem DROP COLUMN geohash');
        await queryRunner.query('ALTER TABLE emblem DROP COLUMN relatedPage');
        await queryRunner.query('ALTER TABLE emblem DROP COLUMN population');
        await queryRunner.query('DROP INDEX unique_geohash');
    }

}
