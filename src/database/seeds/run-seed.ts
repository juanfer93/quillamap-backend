
import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedZones } from '@/database/seeds/zone.seed';
import { Zone } from '@/features/zones/entities/zone.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Zone],
  synchronize: false, // Set to false for production
  logging: true,
} as DataSourceOptions);

const runSeed = async () => {
  await AppDataSource.initialize();
  console.log('Data Source has been initialized!');

  await seedZones(AppDataSource);

  await AppDataSource.destroy();
  console.log('Data Source has been destroyed!');
};

runSeed().catch((error) => {
  console.error('Error running seed:', error);
});
