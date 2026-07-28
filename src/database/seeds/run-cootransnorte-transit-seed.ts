import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedCootransnorteOfficialTransit } from '@/database/seeds/transit.seed';

const CootransnorteTransitSeedDataSource = new DataSource({
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

const runCootransnorteTransitSeed = async () => {
  await CootransnorteTransitSeedDataSource.initialize();
  console.log('COOTRANSNORTE transit seed data source initialized.');
  await seedCootransnorteOfficialTransit(CootransnorteTransitSeedDataSource);
  await CootransnorteTransitSeedDataSource.destroy();
  console.log('COOTRANSNORTE transit seed data source destroyed.');
};

runCootransnorteTransitSeed().catch((error) => {
  console.error('Error running COOTRANSNORTE transit seed:', error);
  process.exit(1);
});
