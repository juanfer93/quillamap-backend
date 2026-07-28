import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedCooasoatlanOfficialTransit } from '@/database/seeds/transit.seed';

const CooasoatlanTransitSeedDataSource = new DataSource({
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

const runCooasoatlanTransitSeed = async () => {
  await CooasoatlanTransitSeedDataSource.initialize();
  console.log('COOASOATLAN transit seed data source initialized.');
  await seedCooasoatlanOfficialTransit(CooasoatlanTransitSeedDataSource);
  await CooasoatlanTransitSeedDataSource.destroy();
  console.log('COOASOATLAN transit seed data source destroyed.');
};

runCooasoatlanTransitSeed().catch((error) => {
  console.error('Error running COOASOATLAN transit seed:', error);
  process.exit(1);
});
