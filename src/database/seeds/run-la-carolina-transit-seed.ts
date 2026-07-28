import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedLaCarolinaOfficialTransit } from '@/database/seeds/transit.seed';

const LaCarolinaTransitSeedDataSource = new DataSource({
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

const runLaCarolinaTransitSeed = async () => {
  await LaCarolinaTransitSeedDataSource.initialize();
  console.log('LA-CAROLINA transit seed data source initialized.');
  await seedLaCarolinaOfficialTransit(LaCarolinaTransitSeedDataSource);
  await LaCarolinaTransitSeedDataSource.destroy();
  console.log('LA-CAROLINA transit seed data source destroyed.');
};

runLaCarolinaTransitSeed().catch((error) => {
  console.error('Error running LA-CAROLINA transit seed:', error);
  process.exit(1);
});
