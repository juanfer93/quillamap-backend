import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedLolayaOfficialTransit } from '@/database/seeds/transit.seed';

const LolayaTransitSeedDataSource = new DataSource({
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

const runLolayaTransitSeed = async () => {
  await LolayaTransitSeedDataSource.initialize();
  console.log('LOLAYA transit seed data source initialized.');
  await seedLolayaOfficialTransit(LolayaTransitSeedDataSource);
  await LolayaTransitSeedDataSource.destroy();
  console.log('LOLAYA transit seed data source destroyed.');
};

runLolayaTransitSeed().catch((error) => {
  console.error('Error running LOLAYA transit seed:', error);
  process.exit(1);
});
