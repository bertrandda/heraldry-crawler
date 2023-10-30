import dotenv from 'dotenv'
import { Promise } from 'bluebird'
import chunk from 'lodash.chunk'
import { SingleBar, Presets } from 'cli-progress'
import { IsNull } from 'typeorm'
import algoliasearch from 'algoliasearch'
import { Client } from '@elastic/elasticsearch'
import { uploadFile } from '../src/lib/S3Client'
import { dataSource } from '../src/lib/OrmDataSource'
import { Emblem } from '../src/entity/Emblem'
import WikiUtils from '../src/lib/WikiUtils'

async function crawlCredits() {
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

    console.log(`Credits will be indexed to:`)
    ALGOLIA_INDEXING && console.log('- Algolia')
    ELASTIC_INDEXING && console.log('- Elasticsearch')
    S3_INDEXING && console.log('- S3')

    const connection = await dataSource.initialize()

    const emblemRepo = connection.getRepository(Emblem)

    const emblemToCredits = await emblemRepo.findBy({ credits: IsNull() })

    if (emblemToCredits.length > 0) {
        console.log('Crawl data')
        const bar = new SingleBar({}, Presets.legacy)
        bar.start(emblemToCredits.length, 0);
        const emblemCredited = await Promise.map(emblemToCredits, async emblem => {
            emblem.credits = await WikiUtils.getImageCredits(decodeURIComponent(emblem.imageUrl.split('/').pop().replace(/^\d{1,3}px-/, '')))
            bar.increment()
            return emblem
        }, { concurrency: 20 }).filter(emblem => emblem.credits !== null)
        bar.stop();

        if (ALGOLIA_INDEXING) {
            const client = algoliasearch(process.env.ALGOLIA_APPLICATION_ID, process.env.ALGOLIA_API_KEY)
            const algoliaIndex = client.initIndex(process.env.ALGOLIA_INDEX || 'emblems')

            await algoliaIndex.saveObjects(emblemCredited.map((emblem): Record<string, string | string[] | number> => ({
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
                const elasticClient = new Client({ node: process.env.ELASTIC_URL })
                await Promise.map(chunk(emblemCredited, 5000), async creditedChunk => {
                    await elasticClient.bulk({
                        body: creditedChunk.map((emblem): Record<string, string | string[] | number> => ({
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
                        }, elasticEmblem]),
                    })
                }, { concurrency: 1 })
            } catch (e) {
                console.log('Elasticsearch update indexing failed')
                console.log(e);
            }
        }
        if (S3_INDEXING) {
            console.log('Upload to S3')
            const bar = new SingleBar({}, Presets.legacy)
            bar.start(emblemCredited.length, 0);
            await Promise.map(emblemCredited, async emblem => {
                await uploadFile(`${emblem.path}.json`, JSON.stringify(emblem))
                bar.increment()
                return
            }, { concurrency: 50 })
            bar.stop();
        }

        await Promise.all(chunk(emblemCredited, 500).map(emblemCreditedChunk =>
            emblemRepo.save(emblemCreditedChunk)
        ))

        console.log(`${emblemCredited.length} credits saved`)
    }
}

crawlCredits()


