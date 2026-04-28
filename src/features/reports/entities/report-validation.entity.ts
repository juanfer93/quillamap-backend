import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
} from 'typeorm';
import { Report } from '@/features/reports/entities/report.entity';
import { Profile } from '@/features/profiles/entities/profile.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('report_validations')
export class ReportValidation {
  @ApiProperty({ description: 'Unique identifier for the report validation', example: 'a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Indicates if the report was confirmed by the user', example: true })
  @Column()
  isConfirmed: boolean;

  @ManyToOne(() => Report, (report) => report.validations)
  report: Report;

  @ManyToOne(() => Profile, (profile) => profile.id)
  profile: Profile;

  @ApiProperty({ description: 'Timestamp of when the validation was created' })
  @CreateDateColumn()
  createdAt: Date;
}
