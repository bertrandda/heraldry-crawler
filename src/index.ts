import { createConnection } from "typeorm"
import { FamilyArmorial } from './lib/FamilyArmorial'
import { MunicipalityArmorial } from './lib/MunicipalityArmorial'
import { Emblem } from './entity/Emblem'

async function main(): Promise<void> {
    const connection = await createConnection()

    const emblemRepo = connection.getRepository(Emblem);

    await emblemRepo.createQueryBuilder()
        .update()
        .set({ check: false })
        .execute()

    await FamilyArmorial.crawlPage(emblemRepo)
    await MunicipalityArmorial.crawlPage(emblemRepo)

    /* TODO update Algolia
        update updatedAt > indexedAt
        delete check === false
    */

    // TODO remove old armoiries (not checked)
}

main()