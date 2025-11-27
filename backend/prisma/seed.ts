import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  console.log('Seeding database...');

  // Create default admin user if not exists
  const adminEmail = 'admin@school.com';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin', 12);

    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        fullName: 'System Administrator',
        role: 'admin',
      },
    });

    await prisma.admin.create({
      data: {
        userId: adminUser.id,
      },
    });

    console.log('Default admin user created:');
    console.log('Email: admin@school.com');
    console.log('Password: admin');
  } else {
    console.log('Admin user already exists');
  }

  // Create some sample data for other entities
  // Add more sample data as needed...

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
