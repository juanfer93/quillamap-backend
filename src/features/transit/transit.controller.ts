import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TransitCommunityValidationDto } from '@/features/transit/dto/transit-community-validation.dto';
import { TransitRouteRequestDto } from '@/features/transit/dto/transit-route-request.dto';
import type { TransitCommunityValidationResult } from '@/features/transit/dto/transit-community-validation.dto';
import type {
  TransitMapResponse,
  TransitBusSuggestionsResponse,
  TransitTransmetroSuggestionsResponse,
  TransitRouteResponse,
  TransitRouteStreetsResponse,
} from '@/features/transit/interfaces/transit-response.interface';
import { TransitService } from '@/features/transit/transit.service';

@ApiTags('transit')
@Controller('transit')
export class TransitController {
  constructor(private readonly transitService: TransitService) {}

  @Get('routes/map')
  @ApiOperation({ summary: 'Return public transit routes and stops as MapLibre-ready GeoJSON' })
  @ApiResponse({ status: 200, description: 'Transit map features returned successfully.' })
  getTransitMap(): Promise<TransitMapResponse> {
    return this.transitService.getTransitMap();
  }

  @Get('routes/:routeKey/streets')
  @ApiOperation({ summary: 'Return the street/carrera sequence currently stored for a transit route' })
  @ApiResponse({ status: 200, description: 'Transit route street sequence returned successfully.' })
  getTransitRouteStreets(
    @Param('routeKey') routeKey: string,
  ): Promise<TransitRouteStreetsResponse> {
    return this.transitService.getTransitRouteStreets(routeKey);
  }

  @Post('routes/suggestions')
  @ApiOperation({ summary: 'Suggest the best direct bus options between two coordinates using injected route shapes' })
  @ApiResponse({ status: 201, description: 'Transit bus suggestions returned successfully.' })
  getTransitBusSuggestions(
    @Body() routeRequest: TransitRouteRequestDto,
  ): Promise<TransitBusSuggestionsResponse> {
    return this.transitService.getTransitBusSuggestions(routeRequest);
  }

  @Post('transmetro/suggestions')
  @ApiOperation({ summary: 'Suggest the best Transmetro options between two coordinates using injected services and stops' })
  @ApiResponse({ status: 201, description: 'Transmetro suggestions returned successfully.' })
  getTransmetroSuggestions(
    @Body() routeRequest: TransitRouteRequestDto,
  ): Promise<TransitTransmetroSuggestionsResponse> {
    return this.transitService.getTransmetroSuggestions(routeRequest);
  }

  @Post('itineraries')
  @ApiOperation({ summary: 'Calculate pedestrian or tourist transit itineraries using self-hosted OTP' })
  @ApiResponse({ status: 201, description: 'Transit itineraries calculated successfully.' })
  calculateItineraries(
    @Body() routeRequest: TransitRouteRequestDto,
  ): Promise<TransitRouteResponse> {
    return this.transitService.calculateItineraries(routeRequest);
  }

  @Post('community-validations')
  @ApiOperation({ summary: 'Validate route status with server-side physical presence checks' })
  @ApiResponse({ status: 201, description: 'Community validation accepted or rejected.' })
  validateRoutePresence(
    @Body() validationRequest: TransitCommunityValidationDto,
  ): Promise<TransitCommunityValidationResult> {
    return this.transitService.validateRoutePresence(validationRequest);
  }
}
