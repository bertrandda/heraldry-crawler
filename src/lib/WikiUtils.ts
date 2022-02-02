import axios from 'axios'

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
}
