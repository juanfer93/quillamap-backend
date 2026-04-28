import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ZonesService } from '@/features/zones/zones.service';
import { Zone } from '@/features/zones/entities/zone.entity';
import { SupabaseAuthGuard } from '@/features/auth/guards/supabase-auth.guard';
import { RadarQueryDto } from '@/features/zones/dto/radar-query.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Zones')
@ApiBearerAuth()
@Controller('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Post()
  @UseGuards(SupabaseAuthGuard)
  create(@Body() createZoneDto: Partial<Zone>) {
    return this.zonesService.create(createZoneDto);
  }

  @Get('/radar')
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Get nearby restrictions based on user location and vehicle' })
  @ApiResponse({ status: 200, description: 'Returns a list of zones with active restrictions.', type: [Zone] })
  getNearbyRestrictions(@Query() query: RadarQueryDto) {
    return this.zonesService.getNearbyRestrictions(query);
  }

  @Get()
  findAll() {
    return this.zonesService.findAllActive();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.zonesService.findOne(id);
  }
}
