import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReportType } from '@/features/reports/entities/report-type.enum';
import { ReportStatus } from '@/features/reports/entities/report-status.enum';
import { Profile } from '@/features/profiles/entities/profile.entity';
import type { Point } from 'geojson';

@Entity()
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ReportType,
  })
  type: ReportType;

  @Column('text')
  description: string;

  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4321,
  })
  location: Point;

  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.ACTIVO,
  })
  status: ReportStatus;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => Profile, (profile) => profile.reports)
  @JoinColumn({ name: 'profileId' })
  profile: Profile;

  @Column()
  profileId: string;
}
