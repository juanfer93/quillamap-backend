import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedSecurityReports } from '@/database/seeds/security-reports.seed';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: true,
  ssl: { rejectUnauthorized: false },
} as DataSourceOptions);

const runSeed = async (): Promise<void> => {
  await AppDataSource.initialize();
  const summary = await seedSecurityReports(AppDataSource);
  await AppDataSource.destroy();
  console.log(`Security reports seed completed: ${JSON.stringify(summary)}`);
};

runSeed().catch((error) => {
  console.error('Error running security reports seed:', error);
  process.exit(1);
});
