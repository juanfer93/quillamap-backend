import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Point } from 'geojson';

export type SecurityInfrastructureType = 'traffic_camera' | 'cultural_landmark';

export interface TrafficCameraMetadata {
  owner: string;
  source: string;
  infrastructureType: SecurityInfrastructureType;
  primaryColor: '#004574';
  touristSafetyMilestoneColor?: '#D4AF37';
}

@Entity('traffic_cameras')
export class TrafficCamera {
  @ApiProperty({ description: 'Unique identifier for the camera' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Stable official or internal camera id' })
  @Column({ name: 'external_id', type: 'varchar', unique: true })
  externalId: string;

  @ApiProperty({ description: 'Camera display name' })
  @Column({ type: 'varchar' })
  name: string;

  @ApiProperty({
    description: 'Kind of verified security infrastructure',
    enum: ['traffic_camera', 'cultural_landmark'],
  })
  @Column({
    name: 'infrastructure_type',
    type: 'varchar',
    default: 'traffic_camera',
  })
  infrastructureType: SecurityInfrastructureType;

  @ApiProperty({ description: 'Verified fixed infrastructure point' })
  @Index({ spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location: Point;

  @ApiProperty({ description: 'Whether the camera is official infrastructure' })
  @Column({ default: true })
  verified: boolean;

  @ApiProperty({ description: 'Trust score for fixed infrastructure' })
  @Column({ name: 'verification_score', type: 'double precision', default: 1 })
  verificationScore: number;

  @ApiPropertyOptional({ description: 'Official source metadata' })
  @Column({ type: 'jsonb', nullable: true })
  metadata?: TrafficCameraMetadata | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
