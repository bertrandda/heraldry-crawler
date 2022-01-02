import cheerio from 'cheerio'
import axios from 'axios'
import { Emblem } from '../entity/Emblem'
import { Repository } from 'typeorm'
import Utils from './Utils'
import WikiUtils from './WikiUtils'

export class FamilyArmorial {
    private static armorialUrls = ['https://fr.wikipedia.org/wiki/Armorial_des_familles_de_France']

    private static armorialName = 'family'

    private static extractName = ($: cheerio.Root, body: cheerio.Cheerio): string => {
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

        return names.reduce((a, b): string => a.length < b.length ? a : b).replace(/ +(?= )/g, '');
    }

    private static extractDescriptions = ($: cheerio.Root, body: cheerio.Cheerio): { html: string; text: string } => {
        const descriptions = ['p', 'ul', 'dl'].map((selector): { html: string; text: string } => {
            const blazon = $(body)
            blazon.find('.bandeau-niveau-detail').remove()
            const separator = $(blazon).find(selector).eq(0)

            return {
                html: `<${selector}>${separator.html()}${($(blazon).html() || '').split(separator.html() || '')[1]}`,
                text: `${separator.text()}${($(blazon).text()).split(separator.text())[1]}`.trim().replace(/\s{2,}/g, ' '),
            }
        })

        return descriptions.reduce((a, b): { html: string; text: string } => a.text.length > b.text.length ? a : b);
    }

    public static async crawlPage(repository: Repository<Emblem>): Promise<boolean> {
        let $: cheerio.Root
        await Promise.all(FamilyArmorial.armorialUrls.map(async (url): Promise<void> => {
            const response = await axios.get(url)
            $ = cheerio.load(response.data, { xmlMode: true })

            $('sup').remove()

            const promises = $('.wikitable tbody tr').get().map(async (elem, i) => {
                if (process.env.NODE_ENV !== 'prod' && i > 10) return false
                if ($(elem).find('th').first().text() === 'Figure') return false

                const emblemName = FamilyArmorial.extractName($, $(elem).find('td').next())
                if (!emblemName) return false

                let emblem
                let updated = false
                const slug = Utils.slugify(`${emblemName}`)

                try {
                    emblem = await repository.findOneOrFail({ slug, armorial: this.armorialName })
                } catch (e) {
                    emblem = new Emblem()
                    emblem.slug = slug
                    emblem.name = emblemName
                    emblem.armorial = this.armorialName
                    updated = true
                }

                let newImageUrl = Utils.optimizeImageUrl($(elem).find('.image img').attr('src'))
                if (newImageUrl) {
                    const newcredits = await WikiUtils.getImageCredits(decodeURI(newImageUrl.split('/').pop()))
                    if (emblem.credits !== newcredits) {
                        emblem.credits = newcredits
                        updated = true
                    }
                }
                newImageUrl = newImageUrl ? 'https:' + newImageUrl : 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Blason_%C3%A0_dessiner.svg'
                if (emblem.imageUrl !== newImageUrl) {
                    emblem.imageUrl = newImageUrl
                    updated = true
                }

                if (emblem.sourceUrl !== url) {
                    emblem.sourceUrl = url
                    updated = true
                }

                const { html: newDescription, text: newDescriptionText } = FamilyArmorial.extractDescriptions($, $(elem).find('td').next())
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

                return repository.save(emblem)
            })

            await Promise.all(promises)
        }))

        return true
    }
}
