import cheerio from 'cheerio'
import axios from 'axios'
import { Emblem } from '../entity/Emblem'
import { Repository } from 'typeorm';
import Utils from './Utils';

export class MunicipalityArmorial {
    private static _armorialUrls = ['https://fr.wikipedia.org/wiki/Armorial_des_communes_de_France']

    private static armorialName = 'municipality'

    public static async crawlPage(repository: Repository<Emblem>): Promise<boolean> {
        let $: CheerioStatic
        await Promise.all(MunicipalityArmorial._armorialUrls.map(async (url): Promise<void> => {
            const response = await axios.get(url)
            $ = cheerio.load(response.data)

            const urls: string[] = []
            $('.wikitable').first().find('li a').each(async (i, elem): Promise<void> => {
                urls.push(elem.attribs.href)
            })

            await Promise.all(urls.map(async (url, i): Promise<void> => {
                if (process.env.NODE_ENV !== 'prod' && i > 3) return

                const page = await axios.get('https://fr.wikipedia.org/' + url)
                const $1: CheerioStatic = cheerio.load(page.data)

                $1('sup').remove()

                $1('.wikitable').each(async (i, elem): Promise<boolean> => {
                    if (process.env.NODE_ENV !== 'prod' && i > 5) return false

                    const emblemName = $1(elem).find('caption a').text().trim()
                    let emblem
                    let updated = false

                    try {
                        emblem = await repository.findOneOrFail({ name: emblemName, armorial: this.armorialName })
                    } catch (e) {
                        emblem = new Emblem()
                        emblem.name = emblemName
                        emblem.armorial = this.armorialName
                        updated = true
                    }

                    let newImageUrl = Utils.optimizeImageUrl($1(elem).find('.image img').attr('src'))
                    newImageUrl = newImageUrl ? 'https:' + newImageUrl : 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Blason_%C3%A0_dessiner.svg'
                    if (emblem.imageUrl !== newImageUrl) {
                        emblem.imageUrl = newImageUrl
                        updated = true
                    }

                    const blazon = $1(elem).find('tbody td div')
                    const newDescription = (blazon.html() || '').trim()
                    if (emblem.description !== newDescription) {
                        emblem.description = newDescription
                        updated = true
                    }

                    const newDescriptionText = blazon.text().trim()
                    if (emblem.descriptionText !== newDescriptionText) {
                        emblem.descriptionText = newDescriptionText
                        updated = true
                    }

                    emblem.updatedAt = updated ? new Date() : emblem.updatedAt
                    emblem.check = true
                    await repository.save(emblem)

                    return true
                })
            }))
        }))

        return true
    }
}
