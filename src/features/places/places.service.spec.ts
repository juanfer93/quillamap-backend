import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Place } from './entities/place.entity';
import { PlaceCategory } from './entities/place-category.enum';
import { PlacesService } from './places.service';

describe('PlacesService', () => {
  let service: PlacesService;
  let placeRepository: Repository<Place>;

  const mockPlaceRepository = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlacesService,
        {
          provide: getRepositoryToken(Place),
          useValue: mockPlaceRepository,
        },
      ],
    }).compile();

    service = module.get<PlacesService>(PlacesService);
    placeRepository = module.get<Repository<Place>>(getRepositoryToken(Place));
    mockPlaceRepository.query.mockReset();
  });

  it('unifies places and tourist sites when the official table exists', async () => {
    mockPlaceRepository.query
      .mockResolvedValueOnce([{ table_name: 'tourist_sites' }])
      .mockResolvedValueOnce([
        {
          id: 'place-1',
          name: { es: 'Ventana al Mundo' },
          category: PlaceCategory.SERVICIOS,
          source: 'tourist_site',
          location: { type: 'Point', coordinates: [-74.82134, 11.01902] },
          latitude: '11.01902',
          longitude: '-74.82134',
          metadata: { buildingHeightMeters: 47 },
        },
      ]);

    const result = await service.findNearby({
      lat: 11.01902,
      lng: -74.82134,
      radius: 5000,
    });

    expect(placeRepository.query).toHaveBeenLastCalledWith(
      expect.stringContaining('union all'),
      [-74.82134, 11.01902, 5000],
    );
    expect(result[0]).toMatchObject({
      source: 'tourist_site',
      coordinate: {
        latitude: 11.01902,
        longitude: -74.82134,
      },
    });
  });

  it('applies category filters to the unified query', async () => {
    mockPlaceRepository.query
      .mockResolvedValueOnce([{ table_name: null }])
      .mockResolvedValueOnce([]);

    await service.findNearby({
      lat: 10.987,
      lng: -74.789,
      radius: 3000,
      category: PlaceCategory.TRANSPORTE,
    });

    expect(placeRepository.query).toHaveBeenLastCalledWith(
      expect.stringContaining('and category = $4'),
      [-74.789, 10.987, 3000, PlaceCategory.TRANSPORTE],
    );
  });
});
