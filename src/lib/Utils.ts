export default class Utils {
    static optimizeImageUrl(thumbUrl: string): string {
        if (thumbUrl.includes('.svg/')) {
            thumbUrl = thumbUrl.replace(/.svg\/\S*/g, '.svg');
            thumbUrl = thumbUrl.replace(/\/thumb\//g, '/');
        }

        thumbUrl = thumbUrl.replace(/g\/\d*px/g, 'g/80px');
        return thumbUrl;
    }
}
