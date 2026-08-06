import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetSecurityHeatmapDto } from '@/features/reports/dto/get-security-heatmap.dto';
import { SecurityHeatmapService } from '@/features/security/security-heatmap.service';
import type { SecurityHeatmapResponse } from '@/types/contracts/security.contract';

@ApiTags('Security Intelligence')
@Controller('reports/heatmap/security')
export class SecurityController {
  constructor(private readonly heatmapService: SecurityHeatmapService) {}

  @Get()
  @ApiOperation({ summary: 'Return security heatmap clusters' })
  @ApiResponse({
    status: 200,
    description: 'Returns weighted DBSCAN points for security incidents.',
  })
  findSecurityHeatmap(
    @Query() filterDto: GetSecurityHeatmapDto,
  ): Promise<SecurityHeatmapResponse> {
    return this.heatmapService.findHeatmap(filterDto);
  }
}
