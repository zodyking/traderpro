import { customType } from 'drizzle-orm/pg-core'

export const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'citext'
  },
})

export const inet = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'inet'
  },
})

export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea'
  },
})
