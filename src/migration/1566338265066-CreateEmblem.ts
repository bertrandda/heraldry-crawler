import {MigrationInterface, QueryRunner} from "typeorm";

export class CreateEmblem1566338265066 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "emblem" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "name" varchar NOT NULL, "description" text NOT NULL, "descriptionText" text NOT NULL, "imageUrl" varchar NOT NULL, "armorial" varchar NOT NULL, "check" boolean NOT NULL, "updatedAt" datetime NOT NULL, "indexedAt" datetime NOT NULL)`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP TABLE "emblem"`);
    }

}
