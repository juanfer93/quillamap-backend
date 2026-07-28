import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedTransurbarOfficialTransit } from '@/database/seeds/transit.seed';

const TransurbarTransitSeedDataSource = new DataSource({
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

const runTransurbarTransitSeed = async () => {
  await TransurbarTransitSeedDataSource.initialize();
  console.log('TRANSURBAR transit seed data source initialized.');
  await seedTransurbarOfficialTransit(TransurbarTransitSeedDataSource);
  await TransurbarTransitSeedDataSource.destroy();
  console.log('TRANSURBAR transit seed data source destroyed.');
};

runTransurbarTransitSeed().catch((error) => {
  console.error('Error running TRANSURBAR transit seed:', error);
  process.exit(1);
});
