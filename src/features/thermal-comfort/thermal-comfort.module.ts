import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GreenCoverage } from './entities/green-coverage.entity';
import { ThermalComfortController } from './thermal-comfort.controller';
import { ThermalComfortService } from './thermal-comfort.service';

@Module({
  imports: [TypeOrmModule.forFeature([GreenCoverage])],
  controllers: [ThermalComfortController],
  providers: [ThermalComfortService],
  exports: [ThermalComfortService, TypeOrmModule],
})
export class ThermalComfortModule {}
