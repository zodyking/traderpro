import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function readAppVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      version?: string
    }
    return pkg.version ?? '0.0.0'
  }
  catch {
    return '0.0.0'
  }
}

export default defineEventHandler(() => {
  return {
    status: 'ok',
    version: readAppVersion(),
  }
})
