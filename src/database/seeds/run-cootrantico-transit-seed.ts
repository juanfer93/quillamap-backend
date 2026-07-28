import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedCootranticoOfficialTransit } from '@/database/seeds/transit.seed';

const CootranticoTransitSeedDataSource = new DataSource({
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

const runCootranticoTransitSeed = async () => {
  await CootranticoTransitSeedDataSource.initialize();
  console.log('COOTRANTICO transit seed data source initialized.');
  await seedCootranticoOfficialTransit(CootranticoTransitSeedDataSource);
  await CootranticoTransitSeedDataSource.destroy();
  console.log('COOTRANTICO transit seed data source destroyed.');
};

runCootranticoTransitSeed().catch((error) => {
  console.error('Error running COOTRANTICO transit seed:', error);
  process.exit(1);
});
