import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import {
  resolveGreenCoverageInputPath,
  seedGreenCoverageFromOverpassJson,
} from '@/database/seeds/green-coverage.seed';

const GreenCoverageSeedDataSource = new DataSource({
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

const runGreenCoverageSeed = async () => {
  const inputPath = resolveGreenCoverageInputPath(process.argv[2]);

  await GreenCoverageSeedDataSource.initialize();
  console.log('Green coverage seed data source initialized.');

  const summary = await seedGreenCoverageFromOverpassJson(
    GreenCoverageSeedDataSource,
    inputPath,
  );

  await GreenCoverageSeedDataSource.destroy();
  console.log('Green coverage seed data source destroyed.');
  console.log(
    `AMB green coverage seeded from ${summary.inputPath}: ` +
      `${summary.insertedOrUpdated} inserted/updated, ${summary.skipped} skipped. ` +
      `tree=${summary.byType.tree}, park=${summary.byType.park}, grass=${summary.byType.grass}`,
  );
};

runGreenCoverageSeed().catch((error) => {
  console.error('Error running green coverage seed:', error);
  process.exit(1);
});
