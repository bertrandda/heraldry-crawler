import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import { Client } from '@elastic/elasticsearch'
import { Emblem } from './entity/Emblem'
import Utils from './lib/Utils'
import { integer } from '@elastic/elasticsearch/api/types'

dotenv.config()

const app = express()
app.use(cors({ ...(process.env.ORIGIN_URL && { origin: process.env.ORIGIN_URL }) }))
app.use(express.json())

const PORT = process.env.PORT || 3001

const client = new Client({ node: process.env.ELASTIC_URL })

app.post('/search', async ({ body: { requests } }, res) => {
    try {
        requests[0].params.hitsPerPage = requests[0].params.hitsPerPage < 21 ? requests[0].params.hitsPerPage : 20
        const { body } = await client.search({
            index: Emblem.index,
            body: {
                query: {
                    ...(!requests[0].params.query && {
                        match_all: {}
                    }),
                    ...(requests[0].params.query && {
                        query_string: {
                            query: requests[0].params.query.trim().split(' ').map((word: string, i: integer) => i > 0 ? ` AND *${word}*` : `*${word}*`).join(''),
                            fields: ['name', 'subtitle', 'description_text'],
                        }
                    })
                },
                size: requests[0].params.hitsPerPage,
                from: requests[0].params.page * requests[0].params.hitsPerPage,
                ...(!requests[0].params.query && {
                    sort: [
                        { 'name.raw': "asc" },
                        '_score',
                    ]
                }),
            }
        })

        res.json({
            results: [{
                hits: body.hits.hits.map(({ _source: source }: Record<string, Record<string, number | string | string[]>>) => {
                    const result: Record<string, number | string | string[]> = {}
                    Object.keys(source).forEach(key => {
                        result[Utils.snakeToCamel(key)] = source[key]
                    })

                    return result
                }),
                nbHits: body.hits.total.value,
                page: requests[0].params.page,
                nbPages: Math.ceil(body.hits.total.value / requests[0].params.hitsPerPage),
                hitsPerPage: requests[0].params.hitsPerPage,
                query: requests[0].params.query,
            }]
        })
    } catch (e) {
        res.send('Error while search')
        console.log(e)
    }
})

app.listen(PORT)
console.log(`Server listen on port ${PORT}`)
