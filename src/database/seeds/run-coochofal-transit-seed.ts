import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedCoochofalOfficialTransit } from '@/database/seeds/transit.seed';

const CoochofalTransitSeedDataSource = new DataSource({
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

const runCoochofalTransitSeed = async () => {
  await CoochofalTransitSeedDataSource.initialize();
  console.log('COOCHOFAL transit seed data source initialized.');
  await seedCoochofalOfficialTransit(CoochofalTransitSeedDataSource);
  await CoochofalTransitSeedDataSource.destroy();
  console.log('COOCHOFAL transit seed data source destroyed.');
};

runCoochofalTransitSeed().catch((error) => {
  console.error('Error running COOCHOFAL transit seed:', error);
  process.exit(1);
});
