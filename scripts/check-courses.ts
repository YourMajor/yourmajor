import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
;(async () => {
  const courses = await prisma.course.findMany({ select: { id: true, name: true, par: true, _count: { select: { holes: true } } }, take: 5 })
  console.log(JSON.stringify(courses, null, 2))
  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true }, take: 5 })
  console.log('USERS:')
  console.log(JSON.stringify(users, null, 2))
  process.exit(0)
})()
