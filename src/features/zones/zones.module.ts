import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZonesService } from '@/features/zones/zones.service';
import { ZonesController } from '@/features/zones/zones.controller';
import { Zone } from '@/features/zones/entities/zone.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Zone])],
  providers: [ZonesService],
  controllers: [ZonesController],
  exports: [ZonesService],
})
export class ZonesModule {}