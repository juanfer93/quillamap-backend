import { DataSource } from 'typeorm';

const SEED_TAG = '[security-heatmap-seed]';
const EVIDENCE_BASE_URL =
  'https://quillamap.supabase.co/storage/v1/object/public/evidence/security-seed';

interface SecuritySeedProfile {
  id: string;
  fullName: string;
  email: string;
  karma: number;
}

interface SecurityReportCluster {
  key: string;
  label: string;
  center: [number, number];
  reports: number;
}

interface SecuritySeedReport {
  id: string;
  cluster: SecurityReportCluster;
  offset: [number, number];
  dangerLevel: number;
  profile: SecuritySeedProfile;
  minutesAgo: number;
  withEvidence: boolean;
}

const PROFILES: SecuritySeedProfile[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    fullName: 'Seed Seguridad Alta Karma',
    email: 'security-high-karma@quillamap.test',
    karma: 72,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    fullName: 'Seed Seguridad Novato Uno',
    email: 'security-novice-one@quillamap.test',
    karma: 0,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    fullName: 'Seed Seguridad Alta Karma Dos',
    email: 'security-high-karma-two@quillamap.test',
    karma: 58,
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    fullName: 'Seed Seguridad Novato Dos',
    email: 'security-novice-two@quillamap.test',
    karma: 1,
  },
];

const CLUSTERS: SecurityReportCluster[] = [
  { key: 'bq-centro', label: 'Barranquilla Centro', center: [-74.781, 10.982], reports: 4 },
  { key: 'bq-norte', label: 'Barranquilla Norte', center: [-74.8189, 11.0045], reports: 4 },
  { key: 'soledad-centro', label: 'Soledad Centro', center: [-74.7647, 10.9183], reports: 3 },
  { key: 'malambo', label: 'Malambo', center: [-74.773, 10.86], reports: 3 },
  { key: 'galapa', label: 'Galapa', center: [-74.886, 10.897], reports: 3 },
  { key: 'puerto-colombia', label: 'Puerto Colombia', center: [-74.954, 11.008], reports: 3 },
];

const OFFSETS: Array<[number, number]> = [
  [0, 0],
  [0.0012, -0.0008],
  [-0.0011, 0.001],
  [0.0017, 0.0013],
];

const DANGER_LEVELS = [5, 4, 3, 5, 4];

const toReportId = (index: number): string =>
  `90000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;

const buildReports = (): SecuritySeedReport[] => {
  let index = 0;

  return CLUSTERS.flatMap((cluster) =>
    Array.from({ length: cluster.reports }, (_, clusterIndex) => {
      const report: SecuritySeedReport = {
        id: toReportId(index),
        cluster,
        offset: OFFSETS[clusterIndex],
        dangerLevel: DANGER_LEVELS[index % DANGER_LEVELS.length],
        profile: PROFILES[index % PROFILES.length],
        minutesAgo: 4 + index,
        withEvidence: index % 2 === 0,
      };

      index += 1;
      return report;
    }),
  );
};

const seedProfile = async (
  dataSource: DataSource,
  profile: SecuritySeedProfile,
): Promise<void> => {
  await dataSource.query(
    `
    insert into profile (id, full_name, email, karma)
    values ($1, $2, $3, $4)
    on conflict (id)
    do update set
      full_name = excluded.full_name,
      email = excluded.email,
      karma = excluded.karma
    `,
    [profile.id, profile.fullName, profile.email, profile.karma],
  );
};

const seedReport = async (
  dataSource: DataSource,
  report: SecuritySeedReport,
): Promise<void> => {
  const [longitude, latitude] = report.cluster.center;
  const [offsetLng, offsetLat] = report.offset;
  const imageUrl = report.withEvidence
    ? `${EVIDENCE_BASE_URL}/${report.id}.jpg`
    : null;

  await dataSource.query(
    `
    insert into report (
      id,
      type,
      description,
      location,
      image_url,
      danger_level,
      status,
      "createdAt",
      expires_at,
      "profileId"
    )
    values (
      $1,
      'inseguridad'::report_type_enum,
      $2,
      ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
      $5,
      $6,
      'activo'::report_status_enum,
      now() - ($7::int * interval '1 minute'),
      now() + interval '100 years',
      $8
    )
    on conflict (id)
    do update set
      type = excluded.type,
      description = excluded.description,
      location = excluded.location,
      image_url = excluded.image_url,
      danger_level = excluded.danger_level,
      status = excluded.status,
      "createdAt" = excluded."createdAt",
      expires_at = excluded.expires_at,
      "profileId" = excluded."profileId"
    `,
    [
      report.id,
      `${SEED_TAG} ${report.cluster.label} incident ${report.id.slice(-2)}`,
      longitude + offsetLng,
      latitude + offsetLat,
      imageUrl,
      report.dangerLevel,
      report.minutesAgo,
      report.profile.id,
    ],
  );
};

export const seedSecurityReports = async (
  dataSource: DataSource,
): Promise<{ reports: number; profiles: number; clusters: number }> => {
  const reports = buildReports();

  for (const profile of PROFILES) {
    await seedProfile(dataSource, profile);
  }

  for (const report of reports) {
    await seedReport(dataSource, report);
  }

  return {
    reports: reports.length,
    profiles: PROFILES.length,
    clusters: CLUSTERS.length,
  };
};
