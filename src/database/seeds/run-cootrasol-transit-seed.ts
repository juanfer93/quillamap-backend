import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedCootrasolOfficialTransit } from '@/database/seeds/transit.seed';

const CootrasolTransitSeedDataSource = new DataSource({
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

const runCootrasolTransitSeed = async () => {
  await CootrasolTransitSeedDataSource.initialize();
  console.log('COOTRASOL transit seed data source initialized.');
  await seedCootrasolOfficialTransit(CootrasolTransitSeedDataSource);
  await CootrasolTransitSeedDataSource.destroy();
  console.log('COOTRASOL transit seed data source destroyed.');
};

runCootrasolTransitSeed().catch((error) => {
  console.error('Error running COOTRASOL transit seed:', error);
  process.exit(1);
});
