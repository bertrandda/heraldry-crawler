import { Promise } from 'bluebird'
import fs from 'fs/promises'
import path from 'path'
import { Emblem } from '../entity/Emblem'
import { Repository } from 'typeorm'
import { Presets, SingleBar } from 'cli-progress'

export class LocalDataArmorial {
    private static async readJsonFilesFromDir(dirPath: string, jsonFiles: string[] = []) {
        const files = await fs.readdir(dirPath, { withFileTypes: true });

        await Promise.all(
            files.map(async (file) => {
                const fullPath = path.join(dirPath, file.name);

                if (file.isDirectory()) {
                    await LocalDataArmorial.readJsonFilesFromDir(fullPath, jsonFiles);
                } else if (path.extname(file.name) === '.json') {
                    jsonFiles.push(fullPath);
                }

                return
            })
        )

        return jsonFiles;
    }

    public static async crawlPage(repository: Repository<Emblem>, countries: string[]): Promise<boolean> {
        const jsonFiles = await LocalDataArmorial.readJsonFilesFromDir('./data/raw');
        const bar = new SingleBar({}, Presets.legacy)
        bar.start(jsonFiles.length, 0);
        await Promise.map(jsonFiles, async (path, i): Promise<Emblem> => {
            if (process.env.NODE_ENV !== 'prod' && i > 5) return

            const content = await fs.readFile(path, 'utf-8');
            const contentParsed = JSON.parse(content);
            if (!countries.includes(contentParsed.country)) return

            let emblem
            let updated = false

            try {
                emblem = await repository.findOneByOrFail({ slug: contentParsed.slug, armorial: contentParsed.armorial })
            } catch (e) {
                emblem = new Emblem()
                emblem.slug = contentParsed.slug
                emblem.name = contentParsed.name
                emblem.armorial = contentParsed.armorial
                updated = true
            }

            emblem.country = 'france'
            emblem.path = contentParsed.path

            if (emblem.imageUrl !== contentParsed.imageUrl) {
                emblem.imageUrl = contentParsed.imageUrl
                emblem.credits = null
                emblem.size = null
                updated = true
            }

            if (emblem.sourceUrl !== contentParsed.sourceUrl) {
                emblem.sourceUrl = contentParsed.sourceUrl
                updated = true
            }

            if (emblem.description !== contentParsed.description) {
                emblem.description = contentParsed.description
                updated = true
            }

            if (emblem.descriptionText !== contentParsed.descriptionText) {
                emblem.descriptionText = contentParsed.descriptionText
                updated = true
            }

            if (emblem.relatedPage !== contentParsed.relatedPage) {
                emblem.relatedPage = contentParsed.relatedPage
                updated = true
            }

            emblem.updatedAt = updated ? new Date() : emblem.updatedAt
            emblem.check = true

            bar.increment()

            return repository.save(emblem)
        }, { concurrency: 15 })
        bar.stop();

        return true
    }
}
