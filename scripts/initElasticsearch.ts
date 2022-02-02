import dotenv from 'dotenv'
import { Client } from '@elastic/elasticsearch'
import { Emblem } from '../src/entity/Emblem'

async function initElastic(): Promise<void> {
    dotenv.config()

    if (!process.env.ELASTIC_URL) {
        console.log('To init Elasticsearch, you need to set variable ELASTIC_URL ')
        return
    }

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

initElastic()
