import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { Report } from '@/features/reports/entities/report.entity';
import { ReportValidation } from '@/features/reports/entities/report-validation.entity';
import { VehicleType } from './vehicle_type.enum';

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
    enum: VehicleType,
    default: VehicleType.CARRO_PARTICULAR,
  })
  vehicle_type: VehicleType;

  @Column({ nullable: true })
  plate_number?: string;

  @Column({ default: false })
  is_vehicle_owner: boolean;

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  last_location?: string;

  @OneToMany(() => Report, (report) => report.profile)
  reports: Report[];

  @OneToMany(() => ReportValidation, (validation) => validation.profile)
  validations: ReportValidation[];
}
