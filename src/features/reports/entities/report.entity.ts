import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReportType } from '@/features/reports/entities/report-type.enum';
import { ReportStatus } from '@/features/reports/entities/report-status.enum';
import { Profile } from '@/features/profiles/entities/profile.entity';
import type { Point } from 'geojson';
import { ReportValidation } from '@/features/reports/entities/report-validation.entity';
import { ApiProperty } from '@nestjs/swagger';
import type { ReportContract } from '@/contracts/report.contract';

@Entity()
export class Report implements ReportContract {
  @ApiProperty({
    description: 'Unique identifier for the report',
    example: 'a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'Type of the report',
    enum: ReportType,
    example: ReportType.ARROYO,
  }) // <-- CORREGIDO: Enum válido
  @Column({
    type: 'enum',
    enum: ReportType,
  })
  type: ReportType;

  @ApiProperty({
    description: 'Description of the report',
    example: 'Arroyo en la calle 84',
  })
  @Column('text')
  description: string;

  @ApiProperty({ description: 'GeoJSON Point for the report location' })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location: Point;

  @ApiProperty({
    description: 'Public URL of the multimedia evidence for the report',
    example: 'https://xyz.supabase.co/storage/v1/object/public/evidence/...',
    required: false,
    nullable: true,
  })
  @Column({ name: 'image_url', type: 'varchar', nullable: true })
  imageUrl: string | null;

  @ApiProperty({
    description: 'Status of the report',
    enum: ReportStatus,
    example: ReportStatus.ACTIVO,
  })
  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.ACTIVO,
  })
  status: ReportStatus;

  @ApiProperty({ description: 'Timestamp of when the report was created' })
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => Profile, (profile) => profile.reports)
  @JoinColumn({ name: 'profileId' })
  profile: Profile;

  @Column()
  profileId: string;

  @OneToMany(() => ReportValidation, (validation) => validation.report)
  validations: ReportValidation[];
}
