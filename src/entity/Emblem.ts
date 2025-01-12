import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class Emblem {

    @PrimaryGeneratedColumn()
    id!: number

    @Column()
    slug: string = ''

    @Column()
    name: string = ''

    @Column()
    subtitle: string = ''

    @Column('text')
    description: string = ''

    @Column('text')
    descriptionText: string = ''

    @Column()
    imageUrl: string = ''

    @Column()
    sourceUrl: string = ''

    @Column()
    country: string = ''

    @Column()
    armorial: string = ''

    @Column({ unique: true })
    path: string = ''

    @Column()
    credits: string = ''

    @Column({ type: 'json' })
    size: number[]

    @Column()
    relatedPage: string

    @Column()
    population: number

    @Column()
    lat: number

    @Column()
    lon: number

    @Column({ unique: true })
    geohash: string

    @Column()
    check: boolean = true

    @Column()
    updatedAt: Date = new Date()

    @Column()
    indexedAt: Date = new Date(0)

    static index: string = 'emblem'

    static elasticSearchMapping: Record<string, unknown> = {
        properties: {
            emblem_id: {
                type: 'integer',
            },
            name: {
                type: 'text',
                fields: {
                    raw: {
                        type: "keyword",
                    },
                },
            },
            subtitle: {
                type: 'text',
                fields: {
                    raw: {
                        type: "keyword",
                    },
                },
            },
            description_text: {
                type: 'text',
            },
            description: {
                type: 'keyword',
            },
            image_url: {
                type: 'keyword',
            },
            source_url: {
                type: 'keyword',
            },
            path: {
                type: 'keyword',
            },
            tags: {
                type: 'keyword',
            },
            credits: {
                type: 'keyword',
            },
            size: {
                type: 'integer',
            },
            related_page: {
                type: 'keyword',
            },
            population: {
                type: 'integer',
            },
            location: {
                type: 'geo_point',
            },
            geohash: {
                type: 'keyword',
            },
        },
    }

    static algoliaRelationship = (emblem: Emblem) => ({
        objectID: emblem.id,
        name: emblem.name,
        subtitle: emblem.subtitle,
        description: emblem.description,
        descriptionText: emblem.descriptionText,
        imageUrl: emblem.imageUrl,
        sourceUrl: emblem.sourceUrl,
        path: emblem.path,
        ...(emblem.population && { population: emblem.population }),
        ...(emblem.geohash && { geohash: emblem.geohash }),
        ...((emblem.lat && emblem.lon) && {
            _geoloc: {
                lat: emblem.lat,
                lng: emblem.lon
            }
        }),
        _tags: [emblem.armorial, emblem.country],
        ...(emblem.credits && { credits: emblem.credits }),
        ...(emblem.size && { size: emblem.size }),
    })

    static esRelationship = (emblem: Emblem) => ({
        emblem_id: emblem.id,
        name: emblem.name,
        subtitle: emblem.subtitle,
        description: emblem.description,
        description_text: emblem.descriptionText,
        image_url: emblem.imageUrl,
        source_url: emblem.sourceUrl,
        path: emblem.path,
        ...(emblem.population && { population: emblem.population }),
        ...(emblem.geohash && { geohash: emblem.geohash }),
        ...((emblem.lat && emblem.lon) && {
            location: {
                lat: emblem.lat,
                lon: emblem.lon
            }
        }),
        tags: [emblem.armorial, emblem.country],
        ...(emblem.credits && { credits: emblem.credits }),
        ...(emblem.size && { size: emblem.size }),
    })
}
