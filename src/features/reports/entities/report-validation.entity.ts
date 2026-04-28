import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
} from 'typeorm';
import { Report } from '@/features/reports/entities/report.entity';
import { Profile } from '@/features/profiles/entities/profile.entity';

@Entity('report_validations')
export class ReportValidation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  isConfirmed: boolean;

  @ManyToOne(() => Report, (report) => report.validations)
  report: Report;

  @ManyToOne(() => Profile, (profile) => profile.id)
  profile: Profile;

  @CreateDateColumn()
  createdAt: Date;
}
