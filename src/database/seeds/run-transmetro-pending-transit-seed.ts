import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedTransmetroPendingTransit } from '@/database/seeds/transit.seed';

const TransmetroPendingTransitSeedDataSource = new DataSource({
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

const runTransmetroPendingTransitSeed = async () => {
  await TransmetroPendingTransitSeedDataSource.initialize();
  console.log('TRANSMETRO pending transit seed data source initialized.');
  await seedTransmetroPendingTransit(TransmetroPendingTransitSeedDataSource);
  await TransmetroPendingTransitSeedDataSource.destroy();
  console.log('TRANSMETRO pending transit seed data source destroyed.');
};

runTransmetroPendingTransitSeed().catch((error) => {
  console.error('Error running TRANSMETRO pending transit seed:', error);
  process.exit(1);
});
