import { eq } from 'drizzle-orm'
import { brokerAccounts, brokerConnections } from '../../../db/schema'
import { useDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = useDb()

  const rows = await db
    .select({
      id: brokerAccounts.id,
      connectionId: brokerAccounts.connectionId,
      accountRef: brokerAccounts.accountRef,
      currency: brokerAccounts.currency,
      equity: brokerAccounts.equity,
      cash: brokerAccounts.cash,
      buyingPower: brokerAccounts.buyingPower,
      snapshotAt: brokerAccounts.snapshotAt,
      broker: brokerConnections.broker,
      label: brokerConnections.label,
      connectionStatus: brokerConnections.status,
    })
    .from(brokerAccounts)
    .innerJoin(brokerConnections, eq(brokerAccounts.connectionId, brokerConnections.id))
    .where(eq(brokerAccounts.userId, user.id))

  return {
    accounts: rows.map((row) => ({
      id: row.id,
      connectionId: row.connectionId,
      broker: row.broker,
      label: row.label,
      accountRef: row.accountRef,
      currency: row.currency,
      equity: row.equity,
      cash: row.cash,
      buyingPower: row.buyingPower,
      snapshotAt: row.snapshotAt?.toISOString() ?? null,
      connectionStatus: row.connectionStatus,
    })),
  }
})
