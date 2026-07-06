import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import type { Point } from 'geojson';
import type {
  PlaceMetadata,
  PlaceLocalizedText,
} from '@/features/places/entities/place.entity';
import { PlaceCategory } from './place-category.enum';

@Entity('tourist_sites')
export class TouristSite {
  @ApiProperty({ description: 'Unique identifier for the tourist site' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'OpenStreetMap element id for idempotent imports', required: false })
  @Column({ type: 'varchar', nullable: true, unique: true })
  osmId?: string | null;

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
