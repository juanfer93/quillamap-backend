import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from '@/features/reports/entities/report.entity';
import { TrafficCamera } from '@/features/security/entities/traffic-camera.entity';
import { SecurityController } from '@/features/security/security.controller';
import { SecurityHeatmapService } from '@/features/security/security-heatmap.service';

@Module({
  imports: [TypeOrmModule.forFeature([Report, TrafficCamera])],
  controllers: [SecurityController],
  providers: [SecurityHeatmapService],
  exports: [SecurityHeatmapService],
})
export class SecurityModule {}
