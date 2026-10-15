import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const username = process.env.ADMIN_USERNAME || 'admin'
const password = process.env.ADMIN_PASSWORD || 'admin12345'

await prisma.user.upsert({
  where: { username },
  update: {},
  create: { username, passwordHash: await bcrypt.hash(password, 10), role: 'admin', mustChangePassword: false },
})
console.log(`Admin siap: ${username} / ${password}`)
await prisma.$disconnect()
