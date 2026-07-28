import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedTrasaliancoOfficialTransit } from '@/database/seeds/transit.seed';

const TrasaliancoTransitSeedDataSource = new DataSource({
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

const runTrasaliancoTransitSeed = async () => {
  await TrasaliancoTransitSeedDataSource.initialize();
  console.log('TRASALIANCO transit seed data source initialized.');
  await seedTrasaliancoOfficialTransit(TrasaliancoTransitSeedDataSource);
  await TrasaliancoTransitSeedDataSource.destroy();
  console.log('TRASALIANCO transit seed data source destroyed.');
};

runTrasaliancoTransitSeed().catch((error) => {
  console.error('Error running TRASALIANCO transit seed:', error);
  process.exit(1);
});
