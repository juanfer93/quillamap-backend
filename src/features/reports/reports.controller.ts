import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReportsService } from '@/features/reports/reports.service';
import { GetReportsFilterDto } from '@/features/reports/dto/get-reports-filter.dto';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Report } from '@/features/reports/entities/report.entity';
import { CreateReportDto } from '@/features/reports/dto/create-report.dto';
import { JwtAuthGuard } from '@/features/auth/guards/jwt-auth.guard';
import { MAX_EVIDENCE_IMAGE_SIZE_BYTES } from '@/features/evidence/evidence.constants';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOperation({ summary: 'Find nearby reports' })
  @ApiResponse({
    status: 200,
    description: 'Returns a list of nearby reports.',
    type: [Report],
  })
  findNearby(@Query() filterDto: GetReportsFilterDto) {
    return this.reportsService.findNearby(filterDto);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a report at a PostGIS geography point' })
  @ApiResponse({ status: 201, description: 'Creates a report.', type: Report })
  createReport(
    @Body() createReportDto: CreateReportDto,
    @Req() request: { user: { userId: string } },
  ) {
    return this.reportsService.createReport(
      createReportDto,
      request.user.userId,
    );
  }

  @Patch(':id/evidence')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_EVIDENCE_IMAGE_SIZE_BYTES },
    }),
  )
  @ApiOperation({ summary: 'Upload multimedia evidence (image) for a report' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Updates the report with the evidence image URL.',
    type: Report,
  })
  @ApiResponse({ status: 400, description: 'Invalid image file.' })
  @ApiResponse({
    status: 403,
    description: 'Report does not belong to the authenticated user.',
  })
  @ApiResponse({ status: 404, description: 'Report not found.' })
  uploadEvidence(
    @Param('id') reportId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() request: { user: { userId: string } },
  ) {
    return this.reportsService.uploadEvidence(
      reportId,
      request.user.userId,
      file,
    );
  }
}
