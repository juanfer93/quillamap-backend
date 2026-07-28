import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedTransoledadOfficialTransit } from '@/database/seeds/transit.seed';

const TransoledadTransitSeedDataSource = new DataSource({
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

const runTransoledadTransitSeed = async () => {
  await TransoledadTransitSeedDataSource.initialize();
  console.log('TRANSOLEDAD transit seed data source initialized.');
  await seedTransoledadOfficialTransit(TransoledadTransitSeedDataSource);
  await TransoledadTransitSeedDataSource.destroy();
  console.log('TRANSOLEDAD transit seed data source destroyed.');
};

runTransoledadTransitSeed().catch((error) => {
  console.error('Error running TRANSOLEDAD transit seed:', error);
  process.exit(1);
});
