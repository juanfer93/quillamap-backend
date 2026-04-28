import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Polygon } from 'geojson';
import type { ZoneRulesMetadata } from '@/features/zones/interfaces/zone-rules.interface';
import { ApiProperty } from '@nestjs/swagger';

@Entity('zones')
export class Zone {
  @ApiProperty({ description: 'Unique identifier for the zone', example: 'a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Name of the zone', example: 'Centro Histórico' })
  @Column()
  name: string;

  @ApiProperty({ description: 'Geographical boundary of the zone as a Polygon' })
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Polygon',
    srid: 4326,
  })
  boundary: Polygon;

  @ApiProperty({ description: 'Rules and restrictions for the zone' })
  @Column({ type: 'jsonb' })
  rules: ZoneRulesMetadata;

  @ApiProperty({ description: 'Indicates if the zone is currently active', example: true })
  @Column({ default: true })
  active: boolean;

  @ApiProperty({ description: 'Timestamp of when the zone was created' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: 'Timestamp of when the zone was last updated' })
  @UpdateDateColumn()
  updatedAt: Date;
}