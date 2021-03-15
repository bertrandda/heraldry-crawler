# heraldry-crawler
Script to fill French armorial database, linked with [heraldry-search-front](https://github.com/bertrandda/heraldry-search-front) project.

## Features
- Scrap data from Wikipedia armorials
- Save data in SQLite database
- Index data in Algolia indices

## Get started
Create `.env` file from `.env.sample` and complete it with the Algolia app settings in your [console](https://www.algolia.com/users/sign_inhttps://www.algolia.com/users/sign_in).
If you prefer, an Elasticsearch cluster can be used.

To run this project locally, install the dependencies and run the script:

```sh
npm install
npm run init-elastic # optional - init Elastic for emblems
npm run crawl # crawl Wikipedia emblems and index data
```

Alternatively, you may use [Yarn](https://http://yarnpkg.com/):

```sh
yarn
yarn init-elastic # optional - init Elastic for emblems
yarn crawl # crawl wikipedia emblems and index data
```
