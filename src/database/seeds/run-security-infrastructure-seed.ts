import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedSecurityInfrastructure } from '@/database/seeds/security-infrastructure.seed';
import { TrafficCamera } from '@/features/security/entities/traffic-camera.entity';
import { Zone } from '@/features/zones/entities/zone.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Zone, TrafficCamera],
  synchronize: false,
  logging: true,
  ssl: { rejectUnauthorized: false },
} as DataSourceOptions);

const runSeed = async (): Promise<void> => {
  await AppDataSource.initialize();
  const summary = await seedSecurityInfrastructure(AppDataSource);
  await AppDataSource.destroy();
  console.log(`Security seed completed: ${JSON.stringify(summary)}`);
};

runSeed().catch((error) => {
  console.error('Error running security infrastructure seed:', error);
  process.exit(1);
});
