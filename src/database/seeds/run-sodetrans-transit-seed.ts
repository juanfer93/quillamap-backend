import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedSodetransOfficialTransit } from '@/database/seeds/transit.seed';

const SodetransTransitSeedDataSource = new DataSource({
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

const runSodetransTransitSeed = async () => {
  await SodetransTransitSeedDataSource.initialize();
  console.log('SODETRANS transit seed data source initialized.');
  await seedSodetransOfficialTransit(SodetransTransitSeedDataSource);
  await SodetransTransitSeedDataSource.destroy();
  console.log('SODETRANS transit seed data source destroyed.');
};

runSodetransTransitSeed().catch((error) => {
  console.error('Error running SODETRANS transit seed:', error);
  process.exit(1);
});
