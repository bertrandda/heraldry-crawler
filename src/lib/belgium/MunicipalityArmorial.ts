import cheerio from 'cheerio'
import { Promise } from 'bluebird'
import axios from 'axios'
import { Emblem } from '../../entity/Emblem'
import { QueryFailedError, Repository } from 'typeorm';
import { slugify, translateCountry, optimizeImageUrl } from '../Utils';
import { Presets, SingleBar } from 'cli-progress';

export class MunicipalityArmorial {
    private static _armorialUrls = ['https://fr.wikipedia.org/wiki/Armorial_des_communes_de_Belgique']

    private static armorialName = 'municipality'

    public static async crawlPage(repository: Repository<Emblem>): Promise<boolean> {
        let $: cheerio.Root
        await Promise.all(MunicipalityArmorial._armorialUrls.map(async (url): Promise<void> => {
            const response = await axios.get(url)
            $ = cheerio.load(response.data)

            const provincePages: Record<string, string>[] = []
            $('.wikitable li a').each(async (i, elem): Promise<void> => {
                provincePages.push({ province: $(elem).text(), url: (<cheerio.TagElement>elem).attribs.href })
            })

            const bar = new SingleBar({}, Presets.legacy)
            bar.start(provincePages.length, 0);
            await Promise.map(provincePages, async ({ province, url }, i): Promise<void> => {
                if (process.env.NODE_ENV !== 'prod' && i > 10) return

                const page = await axios.get(`https://fr.wikipedia.org/api/rest_v1/page/mobile-html/${url.split('/').pop()}`)
                const $1: cheerio.Root = cheerio.load(page.data)

                $1('sup').remove()

                await Promise.all($1('.wikitable').get().map(async (elem, i) => {
                    if (process.env.NODE_ENV !== 'prod' && i > 5) return false
                    if ($1(elem).prop('class') !== 'wikitable pcs-collapse-table') return false

                    const emblemName = $1(elem).prop('id') ? $1(elem).prop('id').replace(/_/g, ' ').trim() : undefined
                    if (!emblemName) return false

                    let emblem
                    let updated = false
                    const slug = slugify(`${province} ${emblemName}`)

                    try {
                        emblem = await repository.findOneByOrFail({ slug, armorial: this.armorialName })
                    } catch (e) {
                        emblem = new Emblem()
                        emblem.slug = slug
                        emblem.name = emblemName
                        emblem.armorial = this.armorialName
                        updated = true
                    }

                    emblem.country = 'belgium'
                    emblem.path = `/ville/${slugify(translateCountry(emblem.country))}/${slugify(province)}/${slugify(emblemName)}`

                    let newImageUrl = optimizeImageUrl($1(elem).find('.mw-file-description .mw-file-element').attr('src') ?? $1(elem).find('.mw-file-description .mw-file-element').attr('data-src'))
                    newImageUrl = newImageUrl ? 'https:' + newImageUrl : 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Blason_%C3%A0_dessiner.svg'
                    if (emblem.imageUrl !== newImageUrl) {
                        emblem.imageUrl = newImageUrl
                        emblem.credits = null
                        emblem.size = null
                        updated = true
                    }

                    if (emblem.sourceUrl !== `https://fr.wikipedia.org${url}#${$1(elem).prop('id')}`) {
                        emblem.sourceUrl = `https://fr.wikipedia.org${url}#${$1(elem).prop('id')}`
                        updated = true
                    }

                    const blazon = cheerio.load($1(elem).find('tbody tr td')[1]).root()

                    const newDescription = blazon.html()
                    if (emblem.description !== newDescription) {
                        emblem.description = newDescription
                        updated = true
                    }

                    const newDescriptionText = blazon.text()
                    if (emblem.descriptionText !== newDescriptionText) {
                        emblem.descriptionText = newDescriptionText
                        updated = true
                    }

                    const relatedPage = $1(elem).find('caption a').attr('href').split('/').pop()
                    if (emblem.relatedPage !== relatedPage) {
                        emblem.relatedPage = relatedPage
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
                }))
                bar.increment()
            }, { concurrency: 5 })
            bar.stop();
        }))

        return true
    }
}
