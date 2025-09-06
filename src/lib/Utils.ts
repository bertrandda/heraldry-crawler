export const optimizeImageUrl = (thumbUrl: string): string => {
    if (!thumbUrl) {
        return null
    }

    if (thumbUrl.includes('.svg/')) {
        thumbUrl = thumbUrl.replace(/.svg\/\S*/g, '.svg');
        thumbUrl = thumbUrl.replace(/\/thumb\//g, '/');
    }

    thumbUrl = thumbUrl.replace(/g\/\d*px/g, 'g/80px');
    return thumbUrl;
}

export const slugify = (input: string): string => {
    return input.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/'+/g, '-')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '')
}

export const snakeToCamel = (input: string): string => {
    return input.replace(/([-_][a-z])/g, (group) =>
        group
            .toUpperCase()
            .replace('-', '')
            .replace('_', '')
    )
}

export const translateCountry = (country: string): string => {
    return {
        'france': 'France',
        'belgium': 'Belgique',
    }[country] || country
}
