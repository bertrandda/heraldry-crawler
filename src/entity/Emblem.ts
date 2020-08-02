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
}
