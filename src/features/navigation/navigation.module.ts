import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from '@/features/reports/entities/report.entity';
import { Zone } from '@/features/zones/entities/zone.entity';
import { ZonesModule } from '@/features/zones/zones.module';
import { NavigationController } from '@/features/navigation/navigation.controller';
import { NavigationService } from '@/features/navigation/navigation.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Zone, Report]), ZonesModule],
  controllers: [NavigationController],
  providers: [NavigationService],
})
export class NavigationModule {}
