import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedCootrabOfficialTransit } from '@/database/seeds/transit.seed';

const CootrabTransitSeedDataSource = new DataSource({
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

const runCootrabTransitSeed = async () => {
  await CootrabTransitSeedDataSource.initialize();
  console.log('COOTRAB transit seed data source initialized.');
  await seedCootrabOfficialTransit(CootrabTransitSeedDataSource);
  await CootrabTransitSeedDataSource.destroy();
  console.log('COOTRAB transit seed data source destroyed.');
};

runCootrabTransitSeed().catch((error) => {
  console.error('Error running COOTRAB transit seed:', error);
  process.exit(1);
});
