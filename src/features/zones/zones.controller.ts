import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ZonesService } from './zones.service';
import { Zone } from './entities/zone.entity';
import { SupabaseAuthGuard } from '@/features/auth/guards/supabase-auth.guard';

@Controller('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Post()
  @UseGuards(SupabaseAuthGuard)
  create(@Body() createZoneDto: Partial<Zone>) {
    return this.zonesService.create(createZoneDto);
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