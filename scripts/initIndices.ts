import dotenv from 'dotenv'
import algoliasearch from 'algoliasearch'
import { Client } from '@elastic/elasticsearch'
import { Emblem } from '../src/entity/Emblem'

dotenv.config()

async function initAlgolia(): Promise<void> {
    if (!process.env.ALGOLIA_APPLICATION_ID) {
        console.log('To init Algolia, you need to set variable ALGOLIA_APPLICATION_ID')
        return
    }
    console.log('Init Algolia index')

    const indexName = process.env.ALGOLIA_INDEX || 'emblems'

    const client = algoliasearch(process.env.ALGOLIA_APPLICATION_ID, process.env.ALGOLIA_API_KEY)
    let algoliaIndex = await client.initIndex(indexName)

    if (algoliaIndex) {
        console.log('Delete existing index')
        await algoliaIndex.delete()
    }

    console.log(`Create index: ${indexName}`)
    algoliaIndex = await client.initIndex(indexName)

    await algoliaIndex.setSettings({
        searchableAttributes: [
            'name',
            'subtitle',
            'descriptionText'
        ],
        customRanking: [
            'asc(name)'
        ],
        indexLanguages: ['fr'],
        queryLanguages: ['fr'],
    })

    await algoliaIndex.saveSynonyms([
        {
            objectID: 'blue',
            type: 'synonym',
            synonyms: ['azur', 'bleue', 'bleu']
        },
        {
            objectID: 'red',
            type: 'synonym',
            synonyms: ['gueules', 'rouge']
        },
        {
            objectID: 'black',
            type: 'synonym',
            synonyms: ['sable', 'noire', 'noir']
        },
        {
            objectID: 'green',
            type: 'synonym',
            synonyms: ['sinople', 'verte', 'vert']
        },
        {
            objectID: 'purple',
            type: 'synonym',
            synonyms: ['pourpre', 'violet', 'rose']
        },
        {
            objectID: 'gold',
            type: 'synonym',
            synonyms: ['or', 'jaune']
        },
        {
            objectID: 'silver',
            type: 'synonym',
            synonyms: ['argent', 'blanche', 'blanc', 'gris']
        },
    ], {
        replaceExistingSynonyms: true
    })
}

async function initElastic(): Promise<void> {
    if (!process.env.ELASTIC_URL) {
        console.log('To init Elasticsearch, you need to set variable ELASTIC_URL')
        return
    }

    console.log('Init ES index')

    const client = new Client({ node: process.env.ELASTIC_URL })

    const index = Emblem.index
    const { body: indexExists } = await client.indices.exists({ index })

    if (indexExists) {
        console.log('Delete existing index')
        await client.indices.delete({ index })
    }

    console.log(`Create index: ${index}`)
    await client.indices.create({ index })

    console.log('Create mapping')
    try {
        await client.indices.putMapping({
            index,
            body: Emblem.elasticSearchMapping,
        })
    } catch (e) {
        console.log('An error occured while create mapping')
        console.log(e)
    }
}

initAlgolia()
initElastic()
