import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RouteRequestDto } from '@/features/navigation/dto/route-request.dto';
import { NavigationService } from '@/features/navigation/navigation.service';
import type { RouteResponse } from '@/features/navigation/interfaces/route-response.interface';

@ApiTags('navigation')
@Controller('navigation')
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @Post('route')
  @ApiOperation({ summary: 'Calculate a legal GPS route with OSRM or Valhalla' })
  @ApiResponse({ status: 201, description: 'Route calculated successfully.' })
  calculateRoute(@Body() routeRequest: RouteRequestDto): Promise<RouteResponse> {
    return this.navigationService.calculateRoute(routeRequest);
  }
}
