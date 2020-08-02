# heraldry-crawler
Script to fill French armorial database, linked with [heraldry-search-front](https://github.com/bertrandda/heraldry-search-front) project.

## Features
- Scrap data from Wikipedia armorials
- Save data in SQLite database
- Index data in Algolia indices

## Get started
Create `.env` file from `.env.sample` and complete it with the Algolia app settings in your [console](https://www.algolia.com/users/sign_inhttps://www.algolia.com/users/sign_in).

To run this project locally, install the dependencies and run the script:

```sh
npm install
npm start
```

Alternatively, you may use [Yarn](https://http://yarnpkg.com/):

```sh
yarn
yarn start
```
