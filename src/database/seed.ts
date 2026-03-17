import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../modules/user/entities/user.entity';
import { Wallet } from '../modules/wallet/entities/wallet.entity';
import { config } from 'dotenv';

config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'fx_trading',
  entities: [User, Wallet],
  synchronize: false,
});

async function seed() {
  await dataSource.initialize();
  console.log('Database connected for seeding');

  const userRepo = dataSource.getRepository(User);
  const walletRepo = dataSource.getRepository(Wallet);

  const adminEmail = 'admin@fxtrading.com';
  const existing = await userRepo.findOne({ where: { email: adminEmail } });

  if (existing) {
    console.log('Admin user already exists, skipping seed');
    await dataSource.destroy();
    return;
  }

  const hashedPassword = await bcrypt.hash('Admin@123', 12);

  const admin = userRepo.create({
    firstName: 'System',
    lastName: 'Admin',
    email: adminEmail,
    password: hashedPassword,
    role: 'ADMIN' as any,
    isEmailVerified: true,
  });

  await userRepo.save(admin);

  const ngnWallet = walletRepo.create({
    userId: admin.id,
    currency: 'NGN' as any,
    balance: 0,
    lockedBalance: 0,
  });

  await walletRepo.save(ngnWallet);

  console.log(`Admin user seeded: ${adminEmail} / Admin@123`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
