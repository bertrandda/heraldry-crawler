import cheerio from 'cheerio'
import axios from 'axios'
import { Emblem } from '../entity/Emblem'
import { Repository } from 'typeorm'
import Utils from './Utils'

export class FamilyArmorial {
    private static armorialUrls = ['https://fr.wikipedia.org/wiki/Armorial_des_familles_de_France']

    private static armorialName = 'family'

    public static async crawlPage(repository: Repository<Emblem>): Promise<boolean> {
        let $: CheerioStatic
        await Promise.all(FamilyArmorial.armorialUrls.map(async (url): Promise<void> => {
            const response = await axios.get(url)
            $ = cheerio.load(response.data, { xmlMode: true })

            $('sup').remove()

            $('.wikitable tbody tr').each(async (i: number, elem: CheerioElement): Promise<boolean> => {
                if (i > 10) return false
                if ($(elem).find('b').first().text() === 'Figure') return false

                const emblemName = $(elem).find('b').first().text()
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

                let newImageUrl = Utils.optimizeImageUrl($(elem).find('.image img').attr('src'))
                newImageUrl = newImageUrl ? 'https:' + newImageUrl : 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Blason_%C3%A0_dessiner.svg'
                if (emblem.imageUrl !== newImageUrl) {
                    emblem.imageUrl = newImageUrl
                    updated = true
                }

                const blazon = $(elem).find('td').first().next()
                blazon.find('b').first().remove()
                blazon.find('.floatleft').remove()
                blazon.find('.floatright').remove()
                blazon.find('img').remove()
                blazon.find('.bandeau-niveau-detail').remove()

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

            return
        }))

        return true
    }
}
