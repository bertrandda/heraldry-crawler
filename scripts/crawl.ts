import dotenv from 'dotenv'
import chunk from 'lodash.chunk'
import { createConnection, Raw } from 'typeorm'
import algoliasearch, { SearchIndex } from 'algoliasearch'
import { Client } from '@elastic/elasticsearch'
import { FamilyArmorial } from '../src/lib/FamilyArmorial'
import { MunicipalityArmorial } from '../src/lib/MunicipalityArmorial'
import { Emblem } from '../src/entity/Emblem'

async function main(): Promise<void> {
    dotenv.config()

    const ALGOLIA_INDEXING = process.env.ALGOLIA_INDEXING === 'true'
    if (ALGOLIA_INDEXING && !process.env.ALGOLIA_APPLICATION_ID) {
        console.log('To index emblem in Algolia, you need to set variable ALGOLIA_APPLICATION_ID')
        return
    }
    if (ALGOLIA_INDEXING && !process.env.ALGOLIA_API_KEY) {
        console.log('To index emblem in Algolia, you need to set variable ALGOLIA_API_KEY')
        return
    }

    const ELASTIC_INDEXING = process.env.ELASTIC_INDEXING === 'true'
    if (ELASTIC_INDEXING && !process.env.ELASTIC_URL) {
        console.log('To index emblem in Elasticsearch, you need to set variable ELASTIC_URL ')
        return
    }

    const connection = await createConnection()

    const emblemRepo = connection.getRepository(Emblem);

    await emblemRepo.createQueryBuilder()
        .update()
        .set({ check: false })
        .execute()

    await FamilyArmorial.crawlPage(emblemRepo)
    await MunicipalityArmorial.crawlPage(emblemRepo)

    let algoliaIndex: SearchIndex
    if (ALGOLIA_INDEXING) {
        const client = algoliasearch(process.env.ALGOLIA_APPLICATION_ID, process.env.ALGOLIA_API_KEY)
        algoliaIndex = client.initIndex(process.env.ALGOLIA_INDEX || 'emblems')

        algoliaIndex.setSettings({
            searchableAttributes: [
                'name',
                'descriptionText'
            ],
            customRanking: [
                'asc(name)'
            ]
        });
    }

    let elasticClient: Client
    if (ELASTIC_INDEXING) {
        elasticClient = new Client({ node: process.env.ELASTIC_URL })
    }

    // Delete emblem from indices when check === false
    const toBeDeleted = await emblemRepo.find({ check: false })
    if (toBeDeleted.length > 0) {
        if (ALGOLIA_INDEXING) {
            await algoliaIndex.deleteObjects(toBeDeleted.map((emblem: Emblem): string => emblem.id.toString()))
        }
        if (ELASTIC_INDEXING) {
            await elasticClient.deleteByQuery({
                index: Emblem.index,
                body: {
                    query: {
                        ids: {
                            values: toBeDeleted.map((emblem: Emblem): string => emblem.id.toString())
                        }
                    }
                }
            })
        }
        await Promise.all(chunk(toBeDeleted, 500).map(toBeDeletedChunk => {
            return emblemRepo.delete(toBeDeletedChunk.map((emblem: Emblem): number => emblem.id))
        }))
    }
    console.log(`${toBeDeleted.length} emblems deleted`)

    // Add new emblem to indices when indexedAt = 1970...
    const toBeAdded = await emblemRepo.find({
        indexedAt: new Date(0).toISOString().replace('T', ' ').replace('Z', '')
    })
    if (toBeAdded.length > 0) {
        if (ALGOLIA_INDEXING) {
            await algoliaIndex.saveObjects(toBeAdded.map((emblem): Record<string, string | string[] | number> => {
                return {
                    objectID: emblem.id,
                    name: emblem.name,
                    description: emblem.description,
                    descriptionText: emblem.descriptionText,
                    imageUrl: emblem.imageUrl,
                    _tags: [emblem.armorial]
                }
            }), { autoGenerateObjectIDIfNotExist: true })
        }
        if (ELASTIC_INDEXING) {
            await elasticClient.bulk({
                body: toBeAdded.map((emblem): Record<string, string | string[] | number> => {
                    return {
                        emblem_id: emblem.id,
                        name: emblem.name,
                        description: emblem.description,
                        description_text: emblem.descriptionText,
                        image_url: emblem.imageUrl,
                        tags: [emblem.armorial]
                    }
                }).flatMap(elasticEmblem => [{ index: { _index: Emblem.index, _id: elasticEmblem.emblem_id.toString() } }, elasticEmblem])
            })
        }
        await Promise.all(chunk(toBeAdded, 500).map(toBeAddedChunk => {
            return emblemRepo.update(toBeAddedChunk.map((emblem: Emblem): number => emblem.id), { indexedAt: new Date() })
        }))
    }
    console.log(`${toBeAdded.length} emblems added`)

    // Update indices when updatedAt > indexedAt
    const toBeUpdated = await emblemRepo.find({
        updatedAt: Raw((alias): string => `${alias} > indexedAt`)
    })
    if (toBeUpdated.length > 0) {
        if (ALGOLIA_INDEXING) {
            await algoliaIndex.saveObjects(toBeUpdated.map((emblem): Record<string, string | string[] | number> => {
                return {
                    objectID: emblem.id,
                    name: emblem.name,
                    description: emblem.description,
                    descriptionText: emblem.descriptionText,
                    imageUrl: emblem.imageUrl,
                    _tags: [emblem.armorial]
                }
            }))
        }
        if (ELASTIC_INDEXING) {
            await elasticClient.bulk({
                body: toBeAdded.map((emblem): Record<string, string | string[] | number> => {
                    return {
                        _id: emblem.id.toString(),
                        emblem_id: emblem.id,
                        name: emblem.name,
                        description: emblem.description,
                        description_text: emblem.descriptionText,
                        image_url: emblem.imageUrl,
                        tags: [emblem.armorial]
                    }
                }).flatMap(elasticEmblem => [{
                    index: {
                        _index: Emblem.index, _id: elasticEmblem.emblem_id.toString()
                    }
                }, elasticEmblem])
            })
        }
        await Promise.all(chunk(toBeUpdated, 500).map(toBeUpdatedChunk => {
            return emblemRepo.update(toBeUpdatedChunk.map((emblem: Emblem): number => emblem.id), { indexedAt: new Date() })
        }))
    }
    console.log(`${toBeUpdated.length} emblems updated`)
}

main()
