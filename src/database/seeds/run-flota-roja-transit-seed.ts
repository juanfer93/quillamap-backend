import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedFlotaRojaOfficialTransit } from '@/database/seeds/transit.seed';

const FlotaRojaTransitSeedDataSource = new DataSource({
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

const runFlotaRojaTransitSeed = async () => {
  await FlotaRojaTransitSeedDataSource.initialize();
  console.log('FLOTA-ROJA transit seed data source initialized.');
  await seedFlotaRojaOfficialTransit(FlotaRojaTransitSeedDataSource);
  await FlotaRojaTransitSeedDataSource.destroy();
  console.log('FLOTA-ROJA transit seed data source destroyed.');
};

runFlotaRojaTransitSeed().catch((error) => {
  console.error('Error running FLOTA-ROJA transit seed:', error);
  process.exit(1);
});
