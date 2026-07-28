import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedEmbusaOfficialTransit } from '@/database/seeds/transit.seed';

const EmbusaTransitSeedDataSource = new DataSource({
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

const runEmbusaTransitSeed = async () => {
  await EmbusaTransitSeedDataSource.initialize();
  console.log('EMBUSA transit seed data source initialized.');
  await seedEmbusaOfficialTransit(EmbusaTransitSeedDataSource);
  await EmbusaTransitSeedDataSource.destroy();
  console.log('EMBUSA transit seed data source destroyed.');
};

runEmbusaTransitSeed().catch((error) => {
  console.error('Error running EMBUSA transit seed:', error);
  process.exit(1);
});
