import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedTransit } from '@/database/seeds/transit.seed';

const TransitSeedDataSource = new DataSource({
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

const runTransitSeed = async () => {
  await TransitSeedDataSource.initialize();
  console.log('Transit seed data source initialized.');
  await seedTransit(TransitSeedDataSource);
  await TransitSeedDataSource.destroy();
  console.log('Transit seed data source destroyed.');
};

runTransitSeed().catch((error) => {
  console.error('Error running transit seed:', error);
  process.exit(1);
});
