import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedAlianzaSodisOfficialTransit } from '@/database/seeds/transit.seed';

const AlianzaSodisTransitSeedDataSource = new DataSource({
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

const runAlianzaSodisTransitSeed = async () => {
  await AlianzaSodisTransitSeedDataSource.initialize();
  console.log('ALIANZA SODIS transit seed data source initialized.');
  await seedAlianzaSodisOfficialTransit(AlianzaSodisTransitSeedDataSource);
  await AlianzaSodisTransitSeedDataSource.destroy();
  console.log('ALIANZA SODIS transit seed data source destroyed.');
};

runAlianzaSodisTransitSeed().catch((error) => {
  console.error('Error running ALIANZA SODIS transit seed:', error);
  process.exit(1);
});
