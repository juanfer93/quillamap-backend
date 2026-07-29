import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/features/auth/guards/jwt-auth.guard';
import { CreateGreenCoverageDto } from './dto/create-green-coverage.dto';
import { GetGreenCoverageFilterDto } from './dto/get-green-coverage-filter.dto';
import { GreenCoverage } from './entities/green-coverage.entity';
import { ThermalComfortService } from './thermal-comfort.service';

@ApiTags('Thermal Comfort')
@Controller('thermal-comfort')
export class ThermalComfortController {
  constructor(private readonly thermalComfortService: ThermalComfortService) {}

  @Get('green-coverage')
  @ApiOperation({ summary: 'Find nearby AMB trees, parks, and grass coverage' })
  @ApiResponse({ status: 200, description: 'Returns nearby green coverage features.', type: [GreenCoverage] })
  findGreenCoverage(@Query() filterDto: GetGreenCoverageFilterDto) {
    return this.thermalComfortService.findNearby(filterDto);
  }

  @Post('green-coverage')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create an AMB green coverage feature from Overpass or official data' })
  @ApiResponse({ status: 201, description: 'Creates a green coverage feature.', type: GreenCoverage })
  createGreenCoverage(@Body() createDto: CreateGreenCoverageDto) {
    return this.thermalComfortService.createGreenCoverage(createDto);
  }
}
