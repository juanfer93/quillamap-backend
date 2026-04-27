import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  full_name: string;

  @Column()
  vehicle_type: string;

  @Column({ nullable: true })
  plate_number?: string;

  @Column({ default: false })
  is_vehicle_owner: boolean;

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  last_location?: string;
}
