import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedCootransporcarOfficialTransit } from '@/database/seeds/transit.seed';

const CootransporcarTransitSeedDataSource = new DataSource({
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

const runCootransporcarTransitSeed = async () => {
  await CootransporcarTransitSeedDataSource.initialize();
  console.log('COOTRANSPORCAR transit seed data source initialized.');
  await seedCootransporcarOfficialTransit(CootransporcarTransitSeedDataSource);
  await CootransporcarTransitSeedDataSource.destroy();
  console.log('COOTRANSPORCAR transit seed data source destroyed.');
};

runCootransporcarTransitSeed().catch((error) => {
  console.error('Error running COOTRANSPORCAR transit seed:', error);
  process.exit(1);
});
