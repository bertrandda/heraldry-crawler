import dotenv from 'dotenv'
import fs from 'fs/promises'
import { uploadFile } from '../src/lib/S3Client'
import { dataSource } from '../src/lib/OrmDataSource'
import { Emblem } from '../src/entity/Emblem'

async function main(): Promise<void> {
    dotenv.config()

    if (!process.env.S3_ACCESS_KEY_ID) {
        console.log('To index emblem in S3, you need to set S3 variables')
        return
    }

    const connection = await dataSource.initialize()

    const emblemRepo = connection.getRepository(Emblem)

    // Add emblems to sitemap...
    const emblems = await emblemRepo.find()
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
       <url>
          <loc>https://armorialdefrance.org/</loc>
          <lastmod>${(new Date()).toISOString().split('T')[0]}</lastmod>
          <changefreq>monthly</changefreq>
          <priority>0.8</priority>
       </url>
       ${emblems.map(emblem => {
        return `<url>
          <loc>https://armorialdefrance.org${emblem.path}</loc>
          <lastmod>${(new Date(emblem.updatedAt)).toISOString().split('T')[0]}</lastmod>
          <changefreq>monthly</changefreq>
          <priority>0.5</priority>
        </url>`
       }).join('')}
    </urlset>`

    await fs.writeFile('data/sitemap.xml', sitemap)
    await uploadFile('sitemap.xml', sitemap)
    console.log(`${emblems.length} emblems added in sitemap`)
}

main()
