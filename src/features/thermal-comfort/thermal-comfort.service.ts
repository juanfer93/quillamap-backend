import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateGreenCoverageDto } from './dto/create-green-coverage.dto';
import { GetGreenCoverageFilterDto } from './dto/get-green-coverage-filter.dto';
import { GreenCoverage } from './entities/green-coverage.entity';

const AMB_BOUNDS = {
  minLatitude: 10.82,
  maxLatitude: 11.12,
  minLongitude: -75.1,
  maxLongitude: -74.68,
} as const;

@Injectable()
export class ThermalComfortService {
  constructor(
    @InjectRepository(GreenCoverage)
    private readonly greenCoverageRepository: Repository<GreenCoverage>,
  ) {}

  async createGreenCoverage(createDto: CreateGreenCoverageDto): Promise<GreenCoverage> {
    const entity = this.greenCoverageRepository.create({
      ...createDto,
      source: createDto.source ?? undefined,
    });

    return this.greenCoverageRepository.save(entity);
  }

  async findNearby(filter: GetGreenCoverageFilterDto): Promise<GreenCoverage[]> {
    const { lat, lng, radius = 2000, type } = filter;

    if (!this.isWithinAmbBounds({ latitude: lat, longitude: lng })) {
      throw new BadRequestException('La consulta de capa verde solo opera dentro del AMB.');
    }

    const query = this.greenCoverageRepository
      .createQueryBuilder('coverage')
      .where(
        'ST_DWithin(coverage.geometry, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)',
        { lat, lng, radius },
      )
      .orderBy(
        'ST_Distance(coverage.geometry, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)',
        'ASC',
      )
      .take(300);

    if (type) {
      query.andWhere('coverage.type = :type', { type });
    }

    return query.getMany();
  }

  private isWithinAmbBounds(coordinate: { latitude: number; longitude: number }): boolean {
    return coordinate.latitude >= AMB_BOUNDS.minLatitude &&
      coordinate.latitude <= AMB_BOUNDS.maxLatitude &&
      coordinate.longitude >= AMB_BOUNDS.minLongitude &&
      coordinate.longitude <= AMB_BOUNDS.maxLongitude;
  }
}
