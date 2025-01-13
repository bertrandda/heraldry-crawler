import cheerio from 'cheerio'
import { Promise } from 'bluebird'
import axios from 'axios'
import { Emblem } from '../entity/Emblem'
import { Repository } from 'typeorm';
import Utils from './Utils';
import { Presets, SingleBar } from 'cli-progress';

export class MunicipalityArmorial {
    private static _armorialUrls = ['https://fr.wikipedia.org/wiki/Armorial_des_communes_de_France']

    private static armorialName = 'municipality'

    public static async crawlPage(repository: Repository<Emblem>): Promise<boolean> {
        let $: cheerio.Root
        await Promise.all(MunicipalityArmorial._armorialUrls.map(async (url): Promise<void> => {
            const response = await axios.get(url)
            $ = cheerio.load(response.data)

            const deptPages: Record<string, string>[] = [
                // splited pages not handled automatically
                { dept: '57 – Moselle', url: '/wiki/Armorial_des_communes_de_la_Moselle_(A_-_K)' },
                { dept: '57 – Moselle', url: '/wiki/Armorial_des_communes_de_la_Moselle_(L_-_Z)' },
                { dept: '59 – Nord', url: '/wiki/Armorial_des_communes_du_Nord_(A-C)' },
                { dept: '59 – Nord', url: '/wiki/Armorial_des_communes_du_Nord_(D-H)' },
                { dept: '59 – Nord', url: '/wiki/Armorial_des_communes_du_Nord_(I-P)' },
                { dept: '59 – Nord', url: '/wiki/Armorial_des_communes_du_Nord_(Q-Z)' },
                { dept: '60 – Oise', url: "/wiki/Armorial_des_communes_de_l'Oise_(A-C)" },
                { dept: '60 – Oise', url: "/wiki/Armorial_des_communes_de_l'Oise_(D-H)" },
                { dept: '60 – Oise', url: "/wiki/Armorial_des_communes_de_l'Oise_(I-P)" },
                { dept: '60 – Oise', url: "/wiki/Armorial_des_communes_de_l'Oise_(Q-Z)" },
                { dept: '62 – Pas-de-Calais', url: '/wiki/Armorial_des_communes_du_Pas-de-Calais_(A-C)' },
                { dept: '62 – Pas-de-Calais', url: '/wiki/Armorial_des_communes_du_Pas-de-Calais_(D-H)' },
                { dept: '62 – Pas-de-Calais', url: '/wiki/Armorial_des_communes_du_Pas-de-Calais_(I-P)' },
                { dept: '62 – Pas-de-Calais', url: '/wiki/Armorial_des_communes_du_Pas-de-Calais_(Q-Z)' },
                { dept: '67 – Bas-Rhin', url: '/wiki/Armorial_des_communes_du_Bas-Rhin_(A-H)' },
                { dept: '67 – Bas-Rhin', url: '/wiki/Armorial_des_communes_du_Bas-Rhin_(I-R)' },
                { dept: '67 – Bas-Rhin', url: '/wiki/Armorial_des_communes_du_Bas-Rhin_(S-Z)' },
            ]
            $('.wikitable').first().find('li a').each(async (i, elem): Promise<void> => {
                deptPages.push({ dept: $(elem).text(), url: (<cheerio.TagElement>elem).attribs.href })
            })

            const bar = new SingleBar({}, Presets.legacy)
            bar.start(deptPages.length, 0);
            await Promise.map(deptPages, async ({ dept, url }, i): Promise<void> => {
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
                    const slug = Utils.slugify(`${dept} ${emblemName}`)

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
                    emblem.path = `/ville/${emblem.country}/${Utils.slugify(dept.split('–')[1].trim())}/${Utils.slugify(emblemName)}`

                    let newImageUrl = Utils.optimizeImageUrl($1(elem).find('.mw-file-description .mw-file-element').attr('src') ?? $1(elem).find('.mw-file-description .mw-file-element').attr('data-src'))
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

                    return repository.save(emblem)
                }))
                bar.increment()
            }, { concurrency: 5 })
            bar.stop();
        }))

        return true
    }
}
