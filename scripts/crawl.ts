import dotenv from 'dotenv'
import { Promise } from 'bluebird'
import chunk from 'lodash.chunk'
import { Raw } from 'typeorm'
import algoliasearch, { SearchIndex } from 'algoliasearch'
import { Client } from '@elastic/elasticsearch'
import { uploadFile } from '../src/lib/S3Client'
import { FamilyArmorial } from '../src/lib/FamilyArmorial'
import { MunicipalityArmorial } from '../src/lib/MunicipalityArmorial'
import { dataSource } from '../src/lib/OrmDataSource'
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

    const S3_INDEXING = process.env.S3_INDEXING === 'true'
    if (S3_INDEXING && !process.env.S3_ACCESS_KEY_ID) {
        console.log('To index emblem in S3, you need to set S3 variables')
        return
    }

    console.log(`Data will be indexed to:`)
    ALGOLIA_INDEXING && console.log('- Algolia')
    ELASTIC_INDEXING && console.log('- Elasticsearch')
    S3_INDEXING && console.log('- S3')

    const connection = await dataSource.initialize()

    const emblemRepo = connection.getRepository(Emblem)

    await emblemRepo.createQueryBuilder()
        .update()
        .set({ check: false })
        .execute()

    console.log('Start family armorial crawling')
    await FamilyArmorial.crawlPage(emblemRepo)
    console.log('Start municipality armorial crawling')
    await MunicipalityArmorial.crawlPage(emblemRepo)

    if (ALGOLIA_INDEXING || ELASTIC_INDEXING) {
        console.log('Start indexing')
    }

    let algoliaIndex: SearchIndex
    if (ALGOLIA_INDEXING) {
        const client = algoliasearch(process.env.ALGOLIA_APPLICATION_ID, process.env.ALGOLIA_API_KEY)
        algoliaIndex = client.initIndex(process.env.ALGOLIA_INDEX || 'emblems')
    }

    let elasticClient: Client
    if (ELASTIC_INDEXING) {
        elasticClient = new Client({ node: process.env.ELASTIC_URL })
    }

    // Delete emblem from indices when check === false
    const toBeDeleted = await emblemRepo.findBy({ check: false })
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
        await Promise.all(chunk(toBeDeleted, 500).map(toBeDeletedChunk =>
            emblemRepo.delete(toBeDeletedChunk.map((emblem: Emblem): number => emblem.id))
        ))
    }
    console.log(`${toBeDeleted.length} emblems deleted`)

    // Add new emblem to indices when indexedAt = 1970...
    const toBeAdded = await emblemRepo.findBy({
        indexedAt: new Date(0)
    })
    if (toBeAdded.length > 0) {
        if (ALGOLIA_INDEXING) {
            await algoliaIndex.saveObjects(toBeAdded.map((emblem): Record<string, string | string[] | number> => ({
                objectID: emblem.id,
                name: emblem.name,
                description: emblem.description,
                descriptionText: emblem.descriptionText,
                imageUrl: emblem.imageUrl,
                sourceUrl: emblem.sourceUrl,
                path: emblem.path,
                _tags: [emblem.armorial, emblem.country],
                credits: emblem.credits,
            })), { autoGenerateObjectIDIfNotExist: true })
        }
        if (ELASTIC_INDEXING) {
            try {
                await Promise.map(chunk(toBeAdded, 5000), async toBeAddedChunk => {
                    await elasticClient.bulk({
                        body: toBeAddedChunk.map((emblem): Record<string, string | string[] | number> => ({
                            emblem_id: emblem.id,
                            name: emblem.name,
                            description: emblem.description,
                            description_text: emblem.descriptionText,
                            image_url: emblem.imageUrl,
                            source_url: emblem.sourceUrl,
                            path: emblem.path,
                            tags: [emblem.armorial, emblem.country],
                            credits: emblem.credits,
                        })).flatMap(elasticEmblem => [{ index: { _index: Emblem.index, _id: elasticEmblem.emblem_id.toString() } }, elasticEmblem])
                    })
                }, { concurrency: 1 })
            } catch (e) {
                console.log('Elasticsearch indexing failed')
                console.log(e);
            }
        }
        if (S3_INDEXING) {
            await Promise.all(toBeAdded.map(emblem => uploadFile(`${emblem.path}.json`, JSON.stringify(emblem))))
        }
        await Promise.all(chunk(toBeAdded, 500).map(toBeAddedChunk =>
            emblemRepo.update(toBeAddedChunk.map((emblem: Emblem): number => emblem.id), { indexedAt: new Date() })
        ))
    }
    console.log(`${toBeAdded.length} emblems added`)

    // Update indices when updatedAt > indexedAt
    const toBeUpdated = await emblemRepo.findBy({
        updatedAt: Raw((alias): string => `${alias} > indexedAt`)
    })
    if (toBeUpdated.length > 0) {
        if (ALGOLIA_INDEXING) {
            await algoliaIndex.saveObjects(toBeUpdated.map((emblem): Record<string, string | string[] | number> => ({
                objectID: emblem.id,
                name: emblem.name,
                description: emblem.description,
                descriptionText: emblem.descriptionText,
                imageUrl: emblem.imageUrl,
                sourceUrl: emblem.sourceUrl,
                path: emblem.path,
                _tags: [emblem.armorial, emblem.country],
                credits: emblem.credits,
            })))
        }
        if (ELASTIC_INDEXING) {
            try {
                await Promise.map(chunk(toBeUpdated, 5000), async toBeUpdatedChunk => {
                    await elasticClient.bulk({
                        body: toBeUpdatedChunk.map((emblem): Record<string, string | string[] | number> => ({
                            emblem_id: emblem.id,
                            name: emblem.name,
                            description: emblem.description,
                            description_text: emblem.descriptionText,
                            image_url: emblem.imageUrl,
                            source_url: emblem.sourceUrl,
                            path: emblem.path,
                            tags: [emblem.armorial, emblem.country],
                            credits: emblem.credits,
                        })).flatMap(elasticEmblem => [{
                            index: {
                                _index: Emblem.index, _id: elasticEmblem.emblem_id.toString()
                            }
                        }, elasticEmblem])
                    })
                }, { concurrency: 1 })
            } catch (e) {
                console.log('Elasticsearch update indexing failed')
                console.log(e);
            }
        }
        if (S3_INDEXING) {
            await Promise.all(toBeUpdated.map(emblem => uploadFile(`${emblem.path}.json`, JSON.stringify(emblem))))
        }
        await Promise.all(chunk(toBeUpdated, 500).map(toBeUpdatedChunk =>
            emblemRepo.update(toBeUpdatedChunk.map((emblem: Emblem): number => emblem.id), { indexedAt: new Date() })
        ))
    }
    console.log(`${toBeUpdated.length} emblems updated`)
}

main()
