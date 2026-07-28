import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedTrasalfaOfficialTransit } from '@/database/seeds/transit.seed';

const TrasalfaTransitSeedDataSource = new DataSource({
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

const runTrasalfaTransitSeed = async () => {
  await TrasalfaTransitSeedDataSource.initialize();
  console.log('TRASALFA transit seed data source initialized.');
  await seedTrasalfaOfficialTransit(TrasalfaTransitSeedDataSource);
  await TrasalfaTransitSeedDataSource.destroy();
  console.log('TRASALFA transit seed data source destroyed.');
};

runTrasalfaTransitSeed().catch((error) => {
  console.error('Error running TRASALFA transit seed:', error);
  process.exit(1);
});
