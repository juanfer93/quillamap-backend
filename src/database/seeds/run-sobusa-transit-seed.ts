import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedSobusaOfficialTransit } from '@/database/seeds/transit.seed';

const SobusaTransitSeedDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: false,
  ssl: true,
  extra: {
    ssl: {
      rejectUnauthorized: false,
    },
  },
} as DataSourceOptions);

const runSobusaTransitSeed = async () => {
  await SobusaTransitSeedDataSource.initialize();
  console.log('SOBUSA transit seed data source initialized.');
  await seedSobusaOfficialTransit(SobusaTransitSeedDataSource);
  await SobusaTransitSeedDataSource.destroy();
  console.log('SOBUSA transit seed data source destroyed.');
};

runSobusaTransitSeed().catch((error) => {
  console.error('Error running SOBUSA transit seed:', error);
  process.exit(1);
});
