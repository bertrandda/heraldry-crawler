import { DataSource } from 'typeorm'

export const dataSource = new DataSource({
    type: 'sqlite',
    database: `data/${process.env.NODE_ENV}/db.sqlite`,
    entities: ['src/entity/**/*.ts'],
    migrations: ['src/migration/**/*.ts'],
    subscribers: ['src/subscriber/**/*.ts'],
    synchronize: false,
    migrationsRun: true,
    logging: false,
})
