import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import type { Point, Polygon } from 'geojson';
import { PlaceCategory } from './place-category.enum';

export interface PlaceLocalizedText {
  es: string;
  en?: string;
}

export interface PlaceMetadata {
  history?: PlaceLocalizedText;
  openingHours?: PlaceLocalizedText;
  photos?: string[];
  websiteUrl?: string;
  address?: string;
  buildingHeightMeters?: number;
  extrusionBaseMeters?: number;
  polygon?: Polygon;
}

@Entity('places')
export class Place {
  @ApiProperty({ description: 'Unique identifier for the place' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Bilingual display name' })
  @Column({ type: 'jsonb' })
  name: PlaceLocalizedText;

  @ApiProperty({ description: 'Bilingual description', required: false })
  @Column({ type: 'jsonb', nullable: true })
  description?: PlaceLocalizedText | null;

  @ApiProperty({ description: 'Waze-compatible place category', enum: PlaceCategory })
  @Column({
    type: 'enum',
    enum: PlaceCategory,
    enumName: 'place_category_enum',
  })
  category: PlaceCategory;

  @ApiProperty({ description: 'GeoJSON Point for SRID 4326 location' })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location: Point;

  @ApiProperty({ description: 'Multimedia and 3D rendering metadata', required: false })
  @Column({ type: 'jsonb', nullable: true })
  metadata?: PlaceMetadata | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
