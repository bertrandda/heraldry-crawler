import dotenv from 'dotenv'
import { Promise } from 'bluebird'
import chunk from 'lodash.chunk'
import {SingleBar, Presets} from 'cli-progress'
import { createConnection, IsNull } from 'typeorm'
import algoliasearch from 'algoliasearch'
import { Client } from '@elastic/elasticsearch'
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

    console.log(`Credits will be indexed to:`)
    ALGOLIA_INDEXING && console.log('- Algolia')
    ELASTIC_INDEXING && console.log('- Elasticsearch')

    const connection = await createConnection()

    const emblemRepo = connection.getRepository(Emblem)

    const emblemToCredits = await emblemRepo.find({ credits: IsNull() })

    if (emblemToCredits.length > 0) {
        const bar = new SingleBar({}, Presets.legacy)
        bar.start(emblemToCredits.length, 0);
        const emblemCredited = await Promise.map(emblemToCredits, async emblem => {
            emblem.credits = await WikiUtils.getImageCredits(decodeURIComponent(emblem.imageUrl.split('/').pop().replace(/^\d{1,3}px-/, '')))
            bar.increment()
            return emblem
        }, { concurrency: 15 }).filter(emblem => emblem.credits !== null)
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
                _tags: [emblem.armorial],
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
                            tags: [emblem.armorial],
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
        await Promise.all(chunk(emblemCredited, 500).map(emblemCreditedChunk =>
            emblemRepo.save(emblemCreditedChunk)
        ))

        console.log(`${emblemCredited.length} credits saved`)
    }
}

crawlCredits()


