import {MigrationInterface, QueryRunner} from "typeorm";

export class Emblem1617462900284 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "emblem" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "slug" varchar NOT NULL, "name" varchar NOT NULL, "description" text NOT NULL, "descriptionText" text NOT NULL, "imageUrl" varchar NOT NULL, "sourceUrl" varchar NOT NULL, "armorial" varchar NOT NULL, "check" boolean NOT NULL, "updatedAt" datetime NOT NULL, "indexedAt" datetime NOT NULL)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "emblem"`);
    }

}
