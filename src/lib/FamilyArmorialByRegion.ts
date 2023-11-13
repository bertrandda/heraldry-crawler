import cheerio from 'cheerio'
import { Promise } from 'bluebird'
import axios from 'axios'
import { Emblem } from '../entity/Emblem'
import { QueryFailedError, Repository } from 'typeorm';
import Utils from './Utils';

export class FamilyArmorialByRegion {
    private static _armorialUrls = ['https://fr.wikipedia.org/wiki/Armorial_des_familles_de_France']

    private static armorialName = 'family'

    private static extractName = ($: cheerio.Root, body: cheerio.Cheerio): string => {
        const names = ['b'].map((selector): string => $(body).find(selector).eq(0).text())

        return names.reduce((a, b): string => a.length < b.length ? a : b).replace(/ +(?= )/g, '').trim();
    }

    private static extractSubtitle = ($: cheerio.Root, body: cheerio.Cheerio, name: string): string => {
        const names = ['p', 'ul', 'dl'].map((selector): string => {
            const elems = $(body).find(selector)
            let i = 0;
            while (i < elems.length) {
                if (elems.eq(i).text().trim().length !== 0) {
                    return $(body).text().split(elems.eq(i).text())[0].trim()
                }
                i++
            }
            return $(body).text().trim()
        })

        return names.reduce((a, b): string => a.length < b.length ? a : b).replace(name, '').replace(/ +(?= )/g, '').replace(/^(,| )+/, '').trim();
    }

    private static extractDescriptions = ($: cheerio.Root, body: cheerio.Cheerio): { html: string; text: string } => {
        const descriptions = ['p', 'ul', 'dl'].map((selector): { html: string; text: string } => {
            const blazon = $(body)
            blazon.find('.bandeau-niveau-detail').remove()
            const separator = $(blazon).find(selector).eq(0)

            return {
                html: separator.html() !== null ? `<${selector}>${separator.html()}${($(blazon).html() || '').split(separator.html() || '')[1]}` : '',
                text: separator.html() !== null ? `${separator.text()}${($(blazon).text()).split(separator.text())[1]}`.trim().replace(/\s{2,}/g, ' ') : '',
            }
        })

        return descriptions.reduce((a, b): { html: string; text: string } => a.text.length > b.text.length ? a : b);
    }

    public static async crawlPage(repository: Repository<Emblem>): Promise<boolean> {
        let $: cheerio.Root
        await Promise.all(FamilyArmorialByRegion._armorialUrls.map(async (url): Promise<void> => {
            const response = await axios.get(url)
            $ = cheerio.load(response.data)

            const regionPages: Record<string, string>[] = []
            $('[width="33%"] li a').each(async (i, elem): Promise<void> => {
                regionPages.push({ region: $(elem).text(), url: `https://fr.wikipedia.org${(<cheerio.TagElement>elem).attribs.href}` })
            })

            await Promise.map(regionPages, async ({ region, url }, i): Promise<void> => {
                if (process.env.NODE_ENV !== 'prod' && i > 3) return

                const page = await axios.get(url)
                const $1: cheerio.Root = cheerio.load(page.data)

                $1('sup').remove()
                $1('.bandeau-niveau-information').remove()

                const promises = $1('.wikitable tbody tr').get().map(async (elem, i) => {
                    if (process.env.NODE_ENV !== 'prod' && i > 10) return false
                    if ($1(elem).find('th').first().text() === 'Figure') return false

                    const emblemName = FamilyArmorialByRegion.extractName($1, $1(elem).find('td').next())
                    if (!emblemName) return false

                    let emblem
                    let updated = false
                    const slug = Utils.slugify(`${region} ${emblemName}`)

                    try {
                        emblem = await repository.findOneByOrFail({ slug, armorial: this.armorialName })
                    } catch (e) {
                        emblem = new Emblem()
                        emblem.slug = slug
                        emblem.name = emblemName
                        emblem.armorial = this.armorialName
                        updated = true
                    }

                    emblem.country = 'france'
                    emblem.path = `/famille/${emblem.country}/${Utils.slugify(region)}/${Utils.slugify(emblemName)}`

                    let newImageUrl = Utils.optimizeImageUrl($1(elem).find('.mw-file-description img').attr('src'))
                    newImageUrl = newImageUrl ? 'https:' + newImageUrl : 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Blason_%C3%A0_dessiner.svg'
                    if (emblem.imageUrl !== newImageUrl) {
                        emblem.imageUrl = newImageUrl
                        emblem.credits = null
                        updated = true
                    }

                    if (emblem.sourceUrl !== url) {
                        emblem.sourceUrl = url
                        updated = true
                    }

                    const emblemSubtitle = FamilyArmorialByRegion.extractSubtitle($1, $1(elem).find('td').next(), emblemName)
                    if (emblem.subtitle !== emblemSubtitle) {
                        emblem.subtitle = emblemSubtitle
                        updated = true
                    }
                    const { html: newDescription, text: newDescriptionText } = FamilyArmorialByRegion.extractDescriptions($1, $1(elem).find('td').next())
                    if (emblem.description !== newDescription) {
                        emblem.description = newDescription
                        updated = true
                    }

                    if (emblem.descriptionText !== newDescriptionText) {
                        emblem.descriptionText = newDescriptionText
                        updated = true
                    }

                    emblem.updatedAt = updated ? new Date() : emblem.updatedAt
                    emblem.check = true

                    try {
                        await repository.save(emblem)
                    } catch (error) {
                        if (!(error instanceof QueryFailedError && error.driverError.code === 'SQLITE_CONSTRAINT')) {
                            console.log(error)
                        }
                    }
                    return
                })

                await Promise.all(promises)
            }, { concurrency: 1 })
        }))

        return true
    }
}
