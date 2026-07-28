import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedMonterreyOfficialTransit } from '@/database/seeds/transit.seed';

const MonterreyTransitSeedDataSource = new DataSource({
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

const runMonterreyTransitSeed = async () => {
  await MonterreyTransitSeedDataSource.initialize();
  console.log('MONTERREY transit seed data source initialized.');
  await seedMonterreyOfficialTransit(MonterreyTransitSeedDataSource);
  await MonterreyTransitSeedDataSource.destroy();
  console.log('MONTERREY transit seed data source destroyed.');
};

runMonterreyTransitSeed().catch((error) => {
  console.error('Error running MONTERREY transit seed:', error);
  process.exit(1);
});
