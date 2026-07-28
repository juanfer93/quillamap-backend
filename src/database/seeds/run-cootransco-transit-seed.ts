import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedCootranscoOfficialTransit } from '@/database/seeds/transit.seed';

const CootranscoTransitSeedDataSource = new DataSource({
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

const runCootranscoTransitSeed = async () => {
  await CootranscoTransitSeedDataSource.initialize();
  console.log('COOTRANSCO transit seed data source initialized.');
  await seedCootranscoOfficialTransit(CootranscoTransitSeedDataSource);
  await CootranscoTransitSeedDataSource.destroy();
  console.log('COOTRANSCO transit seed data source destroyed.');
};

runCootranscoTransitSeed().catch((error) => {
  console.error('Error running COOTRANSCO transit seed:', error);
  process.exit(1);
});
