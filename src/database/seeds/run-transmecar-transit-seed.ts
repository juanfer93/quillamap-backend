import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedTransmecarOfficialTransit } from '@/database/seeds/transit.seed';

const TransmecarTransitSeedDataSource = new DataSource({
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

const runTransmecarTransitSeed = async () => {
  await TransmecarTransitSeedDataSource.initialize();
  console.log('TRANSMECAR transit seed data source initialized.');
  await seedTransmecarOfficialTransit(TransmecarTransitSeedDataSource);
  await TransmecarTransitSeedDataSource.destroy();
  console.log('TRANSMECAR transit seed data source destroyed.');
};

runTransmecarTransitSeed().catch((error) => {
  console.error('Error running TRANSMECAR transit seed:', error);
  process.exit(1);
});
