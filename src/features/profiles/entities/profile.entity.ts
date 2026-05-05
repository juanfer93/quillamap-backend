import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { Report } from '@/features/reports/entities/report.entity';
import { ReportValidation } from '@/features/reports/entities/report-validation.entity';
import { VehicleType } from '@/features/profiles/entities/vehicle_type.enum';
import { MobilityMode } from '@/features/profiles/entities/mobility_mode.enum';

@Entity()
export class Profile {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ nullable: true })
  full_name: string;

  @Column()
  email: string;

  @Column({ default: 0 })
  karma: number;

  @Column({
    type: 'enum',
    enum: MobilityMode,
    nullable: true,
  })
  mobility_mode: MobilityMode | null;

  @Column({
    type: 'enum',
    enum: VehicleType,
    nullable: true,
  })
  vehicle_type: VehicleType | null;

  @Column({ nullable: true })
  license_plate?: string;

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  last_location?: string;

  @OneToMany(() => Report, (report) => report.profile)
  reports: Report[];

  @OneToMany(() => ReportValidation, (validation) => validation.profile)
  validations: ReportValidation[];
}
