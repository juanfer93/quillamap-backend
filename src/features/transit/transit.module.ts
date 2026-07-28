import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from '@/features/reports/entities/report.entity';
import { TransitStop } from '@/features/transit/entities/transit-stop.entity';
import { TransitController } from '@/features/transit/transit.controller';
import { TransitService } from '@/features/transit/transit.service';

@Module({
  imports: [TypeOrmModule.forFeature([Report, TransitStop])],
  controllers: [TransitController],
  providers: [TransitService],
  exports: [TransitService],
})
export class TransitModule {}
