import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetPlacesFilterDto } from './dto/get-places-filter.dto';
import { PlacesService } from './places.service';

@ApiTags('Places')
@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get()
  @ApiOperation({ summary: 'Find nearby generic places and official tourist sites' })
  @ApiResponse({ status: 200, description: 'Returns unified places and tourist sites.' })
  findNearby(@Query() filterDto: GetPlacesFilterDto) {
    return this.placesService.findNearby(filterDto);
  }
}
