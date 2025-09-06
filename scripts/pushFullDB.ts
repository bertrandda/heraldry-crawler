import dotenv from 'dotenv'
import { Promise } from 'bluebird'
import chunk from 'lodash.chunk'
import algoliasearch, { SearchIndex } from 'algoliasearch'
import { Client } from '@elastic/elasticsearch'
import { SingleBar, Presets } from 'cli-progress'
import { uploadFile } from '../src/lib/S3Client'
import { dataSource } from '../src/lib/OrmDataSource'
import { Emblem } from '../src/entity/Emblem'

async function main(): Promise<void> {
    dotenv.config({ path: `.env.${process.env.NODE_ENV}` })

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

    const toBeUploaded = await emblemRepo.find()
    if (toBeUploaded.length > 0) {
        if (ALGOLIA_INDEXING) {
            await algoliaIndex.saveObjects(toBeUploaded.map(Emblem.algoliaRelationship), { autoGenerateObjectIDIfNotExist: true })
        }
        if (ELASTIC_INDEXING) {
            try {
                await Promise.map(chunk(toBeUploaded, 5000), async toBeUploadedChunk => {
                    await elasticClient.bulk({
                        body: toBeUploadedChunk.map(Emblem.esRelationship).flatMap(elasticEmblem => [{ index: { _index: Emblem.index, _id: elasticEmblem.emblem_id.toString() } }, elasticEmblem])
                    })
                }, { concurrency: 1 })
            } catch (e) {
                console.log('Elasticsearch indexing failed')
                console.log(e);
            }
        }
        if (S3_INDEXING) {
            console.log('Upload to S3')
            const bar = new SingleBar({}, Presets.legacy)
            bar.start(toBeUploaded.length, 0);
            await Promise.map(toBeUploaded, async emblem => {
                await uploadFile(`${emblem.path}.json`, JSON.stringify(emblem))
                bar.increment()
                return
            }, { concurrency: 100 })
            bar.stop();
        }

        await Promise.all(chunk(toBeUploaded, 500).map(toBeUploadedChunk =>
            emblemRepo.update(toBeUploadedChunk.map((emblem: Emblem): number => emblem.id), { indexedAt: new Date() })
        ))
    }
    console.log(`${toBeUploaded.length} emblems added`)
}

main()
