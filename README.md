# heraldry-crawler
Script to fill French armorial database, linked with [heraldry-search-front](https://github.com/bertrandda/heraldry-search-front) project.

## Features
- Scrap data from Wikipedia armorials
- Save data in SQLite database
- Index data in Algolia
- Index data in Elasticsearch

## Get started
Create `.env` file from `.env.sample` and complete it with the Algolia app settings in your [console](https://www.algolia.com/users/sign_inhttps://www.algolia.com/users/sign_in).
If you prefer, an Elasticsearch cluster can be used.

```sh
NODE_ENV=
ALGOLIA_INDEXING=true    # should index data in Algolia
ALGOLIA_APPLICATION_ID=  # Aloglia app ID
ALGOLIA_API_KEY=         # Algolia API Key
ALGOLIA_INDEX=           # Algolia index name
ELASTIC_INDEXING=false   # should index data in Elasticsearch
ELASTIC_URL=             # ES instance URL
ORIGIN_URL=              # heraldry-search-front origin url
```

To run this project locally, install the dependencies and run the script:

```sh
npm install
npm run init-dbs  # optional only before first crawl - (re)set database & elastic for emblems
npm run crawl     # crawl Wikipedia emblems and index data
npm start         # start server to search through ES
```

Alternatively, you may use [Yarn](https://http://yarnpkg.com/):

```sh
yarn
yarn init-dbs  # optional only before first crawl - (re)set database & elastic for emblems
yarn crawl     # crawl wikipedia emblems and index data
yarn start     # start server to search through ES
```
