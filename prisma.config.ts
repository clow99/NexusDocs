import path from 'node:path'
import { defineConfig } from 'prisma/config'
import { config } from 'dotenv'

// Load .env for DATABASE_URL
config({ path: '.env' })

export default defineConfig({
  earlyAccess: true,
  schema: path.join('prisma', 'schema.prisma'),
  
  datasource: {
    url: process.env.DATABASE_URL
  }
})
