import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Geometry } from 'geojson';
import { GreenCoverageSource } from './green-coverage-source.enum';
import { GreenCoverageType } from './green-coverage-type.enum';

@Entity('amb_green_coverage')
export class GreenCoverage {
  @ApiProperty({ description: 'Unique identifier for the AMB green coverage feature' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiPropertyOptional({ description: 'OpenStreetMap element id for idempotent Overpass imports' })
  @Index({ unique: true, where: '"osmId" is not null' })
  @Column({ type: 'varchar', nullable: true })
  osmId?: string | null;

  @ApiProperty({ enum: GreenCoverageType })
  @Column({
    type: 'enum',
    enum: GreenCoverageType,
    enumName: 'green_coverage_type_enum',
  })
  type: GreenCoverageType;

  @ApiProperty({ enum: GreenCoverageSource })
  @Column({
    type: 'enum',
    enum: GreenCoverageSource,
    enumName: 'green_coverage_source_enum',
    default: GreenCoverageSource.OVERPASS,
  })
  source: GreenCoverageSource;

  @ApiPropertyOptional({ example: 'Parque Sagrado Corazon' })
  @Column({ type: 'varchar', nullable: true })
  name?: string | null;

  @ApiPropertyOptional({ description: 'Raw OSM tags or official metadata' })
  @Column({ type: 'jsonb', nullable: true })
  tags?: Record<string, unknown> | null;

  @ApiProperty({ description: 'Point or Polygon geometry in SRID 4326' })
  @Index({ spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Geometry',
    srid: 4326,
  })
  geometry: Geometry;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
