import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class Emblem {

    @PrimaryGeneratedColumn()
    id!: number

    @Column()
    slug: string = ''

    @Column()
    name: string = ''

    @Column('text')
    description: string = ''

    @Column('text')
    descriptionText: string = ''

    @Column()
    imageUrl: string = ''

    @Column()
    armorial: string = ''

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
            tags: {
                type: 'keyword',
            },
        },
    }
}
