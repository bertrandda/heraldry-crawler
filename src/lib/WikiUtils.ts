import axios from 'axios'
import cheerio from 'cheerio'

export default class WikiUtils {
    static async getImageMeta(imageTitle: string): Promise<{ credits?: string, size?: [number, number] }> {
        const meta: { credits?: string, size?: [number, number] } = {}
        const { data: { query: response } } = await axios({
            method: 'GET',
            url: 'https://fr.wikipedia.org/w/api.php',
            params: {
                action: 'query',
                prop: 'imageinfo',
                iiprop: 'extmetadata|size',
                titles: `File:${imageTitle}`,
                format: 'json'
            }
        })

        const { extmetadata, width, height } = Object.values<any>(response.pages)[0].imageinfo?.[0] || {}

        if (extmetadata) {
            const artist = extmetadata.Artist?.value || ''
            const license = extmetadata.LicenseShortName?.value ? `${extmetadata.LicenseUrl?.value ? `<a href=\"${extmetadata.LicenseUrl?.value}\" >` : ''}${extmetadata.LicenseShortName?.value}${extmetadata.LicenseUrl?.value ? `</a>` : ''}` : ''
            if (!artist && !license) {
                meta.credits = null
            }

            meta.credits = `${artist}${(artist && license) ? ` / ` : ''}${license}`
        }

        if (width && height) {
            meta.size = [width, height]
        }

        return meta
    }

    static async getCityMetadata(pageTitle: string): Promise<{
        lon: number
        lat: number
        population: number
    }> {
        const response = await axios.get(`https://fr.wikipedia.org/api/rest_v1/page/mobile-html/${pageTitle}`)
        const $ = cheerio.load(response.data)

        const geoLocElem = $('tr:contains("Coordonnées")')
        const popElem = $('tr:contains("Population")')

        let lon = $(geoLocElem).find('td a').attr('data-lon') ? Number($(geoLocElem).find('td a').attr('data-lon')) : null
        let lat = $(geoLocElem).find('td a').attr('data-lat') ? Number($(geoLocElem).find('td a').attr('data-lat')) : null
        const population = $(popElem).find('td').text().match(/^([0-9]|\s)+/)?.[0].replace(/\s/g, '') ? Number($(popElem).find('td').text().match(/^([0-9]|\s)+/)?.[0].replace(/\s/g, '')) : null

        if (lon === null || lat === null) {
            const coordinates = $.html().match(/coordinates\\\\\\&quot;:\[(\d+\.?\d*),(\d+\.?\d*)\]/)
            lon = Number(coordinates[1])
            lat = Number(coordinates[2])
        }

        return {
            ...(lon && { lon }),
            ...(lat && { lat }),
            ...(population && { population }),
        }
    }
}
