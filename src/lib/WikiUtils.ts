import axios from 'axios'

export default class WikiUtils {
    static async getImageCredits(imageTitle: string): Promise<string> {
        const { data: {query: response} } = await axios({
            method: 'GET',
            baseURL: 'https://fr.wikipedia.org/w/api.php',
            params: {
                action: 'query',
                prop: 'imageinfo',
                iiprop: 'extmetadata',
                titles: `File:${imageTitle}`,
                format: 'json'
            }
        })
        const metadata = response.pages['-1'].imageinfo[0].extmetadata
        const artist = metadata.Artist?.value || ''
        const license = metadata.LicenseShortName?.value ? `${metadata.LicenseUrl?.value ? `<a href=\"${metadata.LicenseUrl?.value}\" >`: ''}${metadata.LicenseShortName?.value}${metadata.LicenseUrl?.value ? `</a>`: ''}` : ''

        return `${artist}${(artist && license) ? ` / ` : ''}${license}`
    }
}
