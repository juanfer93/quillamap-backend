import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedCoolitoralOfficialTransit } from '@/database/seeds/transit.seed';

const CoolitoralTransitSeedDataSource = new DataSource({
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

const runCoolitoralTransitSeed = async () => {
  await CoolitoralTransitSeedDataSource.initialize();
  console.log('COOLITORAL transit seed data source initialized.');
  await seedCoolitoralOfficialTransit(CoolitoralTransitSeedDataSource);
  await CoolitoralTransitSeedDataSource.destroy();
  console.log('COOLITORAL transit seed data source destroyed.');
};

runCoolitoralTransitSeed().catch((error) => {
  console.error('Error running COOLITORAL transit seed:', error);
  process.exit(1);
});
