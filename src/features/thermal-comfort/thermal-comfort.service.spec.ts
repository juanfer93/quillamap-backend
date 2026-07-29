import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { GreenCoverageType } from './entities/green-coverage-type.enum';
import { GreenCoverage } from './entities/green-coverage.entity';
import { ThermalComfortService } from './thermal-comfort.service';

describe('ThermalComfortService', () => {
  let service: ThermalComfortService;
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };
  const greenCoverageRepository = {
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThermalComfortService,
        { provide: getRepositoryToken(GreenCoverage), useValue: greenCoverageRepository },
      ],
    }).compile();

    service = module.get<ThermalComfortService>(ThermalComfortService);
    jest.clearAllMocks();
    queryBuilder.where.mockReturnThis();
    queryBuilder.orderBy.mockReturnThis();
    queryBuilder.take.mockReturnThis();
    queryBuilder.andWhere.mockReturnThis();
    queryBuilder.getMany.mockResolvedValue([]);
    greenCoverageRepository.create.mockImplementation((value) => value);
    greenCoverageRepository.save.mockImplementation(async (value) => ({ id: 'coverage-1', ...value }));
  });

  it('creates green coverage features for Overpass imports', async () => {
    const result = await service.createGreenCoverage({
      type: GreenCoverageType.TREE,
      osmId: 'node/123',
      geometry: { type: 'Point', coordinates: [-74.79, 10.99] },
      tags: { natural: 'tree' },
    });

    expect(greenCoverageRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      type: GreenCoverageType.TREE,
      osmId: 'node/123',
    }));
    expect(result).toEqual(expect.objectContaining({ id: 'coverage-1' }));
  });

  it('queries nearby green coverage with ST_DWithin and type filter', async () => {
    await service.findNearby({
      lat: 10.987,
      lng: -74.789,
      radius: 1500,
      type: GreenCoverageType.PARK,
    });

    expect(queryBuilder.where).toHaveBeenCalledWith(
      expect.stringContaining('ST_DWithin'),
      { lat: 10.987, lng: -74.789, radius: 1500 },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('coverage.type = :type', {
      type: GreenCoverageType.PARK,
    });
  });

  it('rejects green coverage queries outside the AMB', async () => {
    await expect(service.findNearby({
      lat: 10.7,
      lng: -74.789,
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
