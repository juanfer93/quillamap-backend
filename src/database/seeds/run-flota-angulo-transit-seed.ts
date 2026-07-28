import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedFlotaAnguloOfficialTransit } from '@/database/seeds/transit.seed';

const FlotaAnguloTransitSeedDataSource = new DataSource({
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

const runFlotaAnguloTransitSeed = async () => {
  await FlotaAnguloTransitSeedDataSource.initialize();
  console.log('FLOTA-ANGULO transit seed data source initialized.');
  await seedFlotaAnguloOfficialTransit(FlotaAnguloTransitSeedDataSource);
  await FlotaAnguloTransitSeedDataSource.destroy();
  console.log('FLOTA-ANGULO transit seed data source destroyed.');
};

runFlotaAnguloTransitSeed().catch((error) => {
  console.error('Error running FLOTA-ANGULO transit seed:', error);
  process.exit(1);
});
