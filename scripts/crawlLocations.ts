import dotenv from 'dotenv'
import { Promise } from 'bluebird'
import chunk from 'lodash.chunk'
import { SingleBar, Presets } from 'cli-progress'
import { IsNull, Not, QueryFailedError } from 'typeorm'
import algoliasearch from 'algoliasearch'
import { Client } from '@elastic/elasticsearch'
import { encode } from 'ngeohash'
import { uploadFile } from '../src/lib/S3Client'
import { dataSource } from '../src/lib/OrmDataSource'
import { Emblem } from '../src/entity/Emblem'
import WikiUtils from '../src/lib/WikiUtils'

async function crawlLocations() {
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

    console.log(`Geoloaction will be indexed to:`)
    ALGOLIA_INDEXING && console.log('- Algolia')
    ELASTIC_INDEXING && console.log('- Elasticsearch')
    S3_INDEXING && console.log('- S3')

    const connection = await dataSource.initialize()

    const emblemRepo = connection.getRepository(Emblem)

    const emblemToLocate = await emblemRepo.findBy({ armorial: 'municipality', geohash: IsNull(), relatedPage: Not(IsNull()) })

    if (emblemToLocate.length > 0) {
        console.log('Crawl location data')
        const bar = new SingleBar({}, Presets.legacy)
        bar.start(emblemToLocate.length, 0);
        const emblemLocated = await Promise.map(emblemToLocate, async emblem => {
            try {
                const metadata = await WikiUtils.getCityMetadata(emblem.relatedPage)
                emblem = {
                    ...emblem,
                    ...metadata,
                    ...((metadata.lat && metadata.lon) && { geohash: encode(metadata.lat, metadata.lon) })
                }
            } catch (error) {
                console.log(`Can't get metadata for ${emblem.relatedPage}`)
                console.log(error)
            }
            bar.increment()
            return emblem
        }, { concurrency: 200 }).filter(emblem => emblem.geohash !== null)
        bar.stop();

        if (ALGOLIA_INDEXING) {
            const client = algoliasearch(process.env.ALGOLIA_APPLICATION_ID, process.env.ALGOLIA_API_KEY)
            const algoliaIndex = client.initIndex(process.env.ALGOLIA_INDEX || 'emblems')

            await algoliaIndex.saveObjects(emblemLocated.map(Emblem.algoliaRelationship))
        }
        if (ELASTIC_INDEXING) {
            try {
                const elasticClient = new Client({ node: process.env.ELASTIC_URL })
                await Promise.map(chunk(emblemLocated, 5000), async locatedChunk => {
                    await elasticClient.bulk({
                        body: locatedChunk.map(Emblem.esRelationship).flatMap(elasticEmblem => [{
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
            bar.start(emblemLocated.length, 0);
            await Promise.map(emblemLocated, async emblem => {
                await uploadFile(`${emblem.path}.json`, JSON.stringify(emblem))
                bar.increment()
                return
            }, { concurrency: 50 })
            bar.stop();
        }

        await Promise.all(emblemLocated.map(async ({id, relatedPage, lon, lat, geohash, population}) => {
            try {
                await emblemRepo.update({ id }, {
                    ...(lon && { lon }),
                    ...(lat && { lat }),
                    ...((lat && lon) && { geohash }),
                    ...(population && { population }),
                })
            } catch (error) {
                console.log(`Can't update ${relatedPage} location`)
                if (!(error instanceof QueryFailedError && error.driverError.code === 'SQLITE_CONSTRAINT')) {
                    console.log(error)
                }
            }

            return true
        }))

        console.log(`${emblemLocated.length} locations saved`)
    }
}

crawlLocations()


