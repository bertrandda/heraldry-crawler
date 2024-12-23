import axios from 'axios'
import cheerio from 'cheerio'

export default class WikiUtils {
    static async getImageCredits(imageTitle: string): Promise<string> {
        const { data: { query: response } } = await axios({
            method: 'GET',
            url: 'https://fr.wikipedia.org/w/api.php',
            params: {
                action: 'query',
                prop: 'imageinfo',
                iiprop: 'extmetadata',
                titles: `File:${imageTitle}`,
                format: 'json'
            }
        })

        const metadata = Object.values<any>(response.pages)[0].imageinfo?.[0].extmetadata
        if (!metadata) {
            return null
        }

        const artist = metadata.Artist?.value || ''
        const license = metadata.LicenseShortName?.value ? `${metadata.LicenseUrl?.value ? `<a href=\"${metadata.LicenseUrl?.value}\" >` : ''}${metadata.LicenseShortName?.value}${metadata.LicenseUrl?.value ? `</a>` : ''}` : ''
        if (!artist && !license) {
            return null
        }

        return `${artist}${(artist && license) ? ` / ` : ''}${license}`
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

        const lon = $(geoLocElem).find('td a').attr('data-lon') ? Number($(geoLocElem).find('td a').attr('data-lon')) : null
        const lat = $(geoLocElem).find('td a').attr('data-lat') ? Number($(geoLocElem).find('td a').attr('data-lat')) : null
        const population = $(popElem).find('td').text().match(/^([0-9]|\s)+/)?.[0].replace(/\s/g, '') ? Number($(popElem).find('td').text().match(/^([0-9]|\s)+/)?.[0].replace(/\s/g, '')) : null

        return {
            ...(lon && { lon }),
            ...(lat && { lat }),
            ...(population && { population }),
        }
    }
}
