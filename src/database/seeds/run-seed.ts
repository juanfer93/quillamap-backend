
import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { seedZones } from '@/database/seeds/zone.seed';
import { seedOsmPlaces } from '@/database/seeds/osm-places.seed';
import { seedTransit } from '@/database/seeds/transit.seed';
import { seedSecurityInfrastructure } from '@/database/seeds/security-infrastructure.seed';
import { Zone } from '@/features/zones/entities/zone.entity';
import { Place } from '@/features/places/entities/place.entity';
import { TouristSite } from '@/features/places/entities/tourist-site.entity';
import { TrafficCamera } from '@/features/security/entities/traffic-camera.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Zone, Place, TouristSite, TrafficCamera],
  synchronize: false, // Set to false for production
  logging: true,
} as DataSourceOptions);

const runSeed = async () => {
  await AppDataSource.initialize();
  console.log('Data Source has been initialized!');

  await seedZones(AppDataSource);
  await seedTransit(AppDataSource);
  await seedOsmPlaces(AppDataSource);
  await seedSecurityInfrastructure(AppDataSource);

  await AppDataSource.destroy();
  console.log('Data Source has been destroyed!');
};

runSeed().catch((error) => {
  console.error('Error running seed:', error);
});
