import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedTransdiazOfficialTransit } from '@/database/seeds/transit.seed';

const TransdiazTransitSeedDataSource = new DataSource({
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

const runTransdiazTransitSeed = async () => {
  await TransdiazTransitSeedDataSource.initialize();
  console.log('TRANSDIAZ transit seed data source initialized.');
  await seedTransdiazOfficialTransit(TransdiazTransitSeedDataSource);
  await TransdiazTransitSeedDataSource.destroy();
  console.log('TRANSDIAZ transit seed data source destroyed.');
};

runTransdiazTransitSeed().catch((error) => {
  console.error('Error running TRANSDIAZ transit seed:', error);
  process.exit(1);
});
