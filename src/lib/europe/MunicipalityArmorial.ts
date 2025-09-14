import cheerio from 'cheerio'
import { Promise } from 'bluebird'
import axios from 'axios'
import { Emblem } from '../../entity/Emblem'
import { QueryFailedError, Repository } from 'typeorm';
import { slugify, translateCountry, optimizeImageUrl } from '../Utils';
import { Presets, SingleBar } from 'cli-progress';

export class MunicipalityArmorial {
    private static _armorialUrls = ['https://fr.wikipedia.org/wiki/Armorial_des_villes_europ%C3%A9ennes']

    private static armorialName = 'municipality'

    public static relatedCountry = [
        'austria',
        'czech-republic',
        'denmark',
        'finland',
        'germany',
        'irlande',
        'italy',
        'romania',
        'spain',
        'sweden',
        'united-kingdom'
    ]

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
        const descriptions = ['i', 'p', 'ul', 'dl'].map((selector): { html: string; text: string } => {
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
        await Promise.all(MunicipalityArmorial._armorialUrls.map(async (url): Promise<void> => {
            const page = await axios.get(url)
            $ = cheerio.load(page.data)

            $('sup').remove()
            $('.bandeau-niveau-information').remove()

            const municipalityElem = $('.mw-heading2').get()
            const bar = new SingleBar({}, Presets.legacy)
            bar.start(municipalityElem.length, 0);
            await Promise.all($('.mw-heading2').get().map(async (hElem, i) => {
                if (process.env.NODE_ENV !== 'prod' && i > 10) return false
                const country = $(hElem).find('h2').text().trim()
                const siblings = $(hElem).nextUntil('.mw-heading2')

                const splitSiblings: cheerio.Element[][] = []
                siblings.each((i, e) => {
                    if ($(e).hasClass('mw-heading3')) {
                        return splitSiblings.push([e])
                    }

                    if (splitSiblings.length > 0) {
                        return splitSiblings[splitSiblings.length - 1].push(e)
                    }

                    return splitSiblings.push([e])
                })

                await Promise.all(splitSiblings.map(async (group) => {
                    let region = ''
                    if ($(group[0]).hasClass('mw-heading3')) {
                        region = $(group[0]).find('h3').text().trim()
                        group.shift()
                    }
                    await Promise.all(group.map(async (s) => {
                        await Promise.all($(s).find('tr').map(async (i, elem) => {
                            const emblemName = MunicipalityArmorial.extractName($, $(elem).find('td').next())
                            if (!emblemName) return false

                            let emblem
                            let updated = false
                            const slug = slugify(`${region} ${emblemName}`)

                            try {
                                emblem = await repository.findOneByOrFail({ slug, armorial: this.armorialName })
                            } catch (e) {
                                emblem = new Emblem()
                                emblem.slug = slug
                                emblem.name = emblemName
                                emblem.armorial = this.armorialName
                                updated = true
                            }

                            emblem.country = translateCountry(country, true)
                            emblem.path = `/ville/${slugify(translateCountry(emblem.country))}${region.length > 0 ? `/${slugify(region)}` : ''}/${slugify(emblemName)}`

                            let newImageUrl = optimizeImageUrl($(elem).find('.mw-file-description img').attr('src'))
                            newImageUrl = newImageUrl ? 'https:' + newImageUrl : 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Blason_%C3%A0_dessiner.svg'
                            if (emblem.imageUrl !== newImageUrl) {
                                emblem.imageUrl = newImageUrl
                                emblem.credits = null
                                emblem.size = null
                                updated = true
                            }

                            if (emblem.sourceUrl !== url) {
                                emblem.sourceUrl = url
                                updated = true
                            }

                            const emblemSubtitle = MunicipalityArmorial.extractSubtitle($, $(elem).find('td').next(), emblemName)
                            if (emblem.subtitle !== emblemSubtitle) {
                                emblem.subtitle = emblemSubtitle
                                updated = true
                            }
                            const { html: newDescription, text: newDescriptionText } = MunicipalityArmorial.extractDescriptions($, $(elem).find('td').next())
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
                                if (emblem.id) {
                                    const { id, ...partEmblem } = emblem
                                    await repository.update({ id }, partEmblem)
                                } else {
                                    await repository.insert(emblem)
                                }
                            } catch (error) {
                                if (!(error instanceof QueryFailedError && error.driverError.code === 'SQLITE_CONSTRAINT')) {
                                    console.log(error)
                                }
                            }
                        }))
                    }))
                }))
                return
            }))
            bar.increment()
            bar.stop();
        }))

        return true
    }
}
