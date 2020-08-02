import dotenv from 'dotenv'
import chunk from 'lodash.chunk'
import { createConnection, Raw } from 'typeorm'
import algoliasearch from 'algoliasearch'
import { FamilyArmorial } from './lib/FamilyArmorial'
import { MunicipalityArmorial } from './lib/MunicipalityArmorial'
import { Emblem } from './entity/Emblem'

async function main(): Promise<void> {
    dotenv.config()

    if (!process.env.ALGOLIA_APPLICATION_ID) {
        console.log('You need to set variable ALGOLIA_APPLICATION_ID')
        return
    }
    if (!process.env.ALGOLIA_API_KEY) {
        console.log('You need to set variable ALGOLIA_API_KEY')
        return
    }
    const ALGOLIA_APPLICATION_ID: string = process.env.ALGOLIA_APPLICATION_ID
    const ALGOLIA_API_KEY: string = process.env.ALGOLIA_API_KEY

    const connection = await createConnection()

    const emblemRepo = connection.getRepository(Emblem);

    await emblemRepo.createQueryBuilder()
        .update()
        .set({ check: false })
        .execute()

    await FamilyArmorial.crawlPage(emblemRepo)
    await MunicipalityArmorial.crawlPage(emblemRepo)

    const client = algoliasearch(ALGOLIA_APPLICATION_ID, ALGOLIA_API_KEY)
    const index = client.initIndex(process.env.ALGOLIA_INDEX || 'emblems')

    index.setSettings({
        searchableAttributes: [
            'name',
            'descriptionText'
        ],
        customRanking: [
            'asc(name)'
        ]
    });

    // Delete emblem from index when check === false
    const toBeDeleted = await emblemRepo.find({ check: false })
    if (toBeDeleted.length > 0) {
        await index.deleteObjects(toBeDeleted.map((emblem: Emblem): string => emblem.id.toString()))
        await Promise.all(chunk(toBeDeleted, 500).map(toBeDeletedChunk => {
            return emblemRepo.delete(toBeDeletedChunk.map((emblem: Emblem): number => emblem.id))
        }))
    }
    console.log(`${toBeDeleted.length} emblems deleted`)

    // Add new emblem to Algolia index when indexedAt = 1970...
    const toBeAdded = await emblemRepo.find({
        indexedAt: new Date(0).toISOString().replace('T', ' ').replace('Z', '')
    })
    if (toBeAdded.length > 0) {
        await index.saveObjects(toBeAdded.map((emblem): Record<string, unknown> => {
            return {
                objectID: emblem.id,
                name: emblem.name,
                description: emblem.description,
                descriptionText: emblem.descriptionText,
                imageUrl: emblem.imageUrl,
                _tags: [emblem.armorial]
            }
        }), { autoGenerateObjectIDIfNotExist: true })
        await Promise.all(chunk(toBeAdded, 500).map(toBeAddedChunk => {
            return emblemRepo.update(toBeAddedChunk.map((emblem: Emblem): number => emblem.id), { indexedAt: new Date() })
        }))
    }
    console.log(`${toBeAdded.length} emblems added`)

    // Update Algolia index when updatedAt > indexedAt
    const toBeUpdated = await emblemRepo.find({
        updatedAt: Raw((alias): string => `${alias} > indexedAt`)
    })
    if (toBeUpdated.length > 0) {
        await index.saveObjects(toBeUpdated.map((emblem): Record<string, unknown> => {
            return {
                objectID: emblem.id,
                name: emblem.name,
                description: emblem.description,
                descriptionText: emblem.descriptionText,
                imageUrl: emblem.imageUrl,
                _tags: [emblem.armorial]
            }
        }))
        await Promise.all(chunk(toBeUpdated, 500).map(toBeUpdatedChunk => {
            return emblemRepo.update(toBeUpdatedChunk.map((emblem: Emblem): number => emblem.id), { indexedAt: new Date() })
        }))
    }
    console.log(`${toBeUpdated.length} emblems updated`)
}

main()
