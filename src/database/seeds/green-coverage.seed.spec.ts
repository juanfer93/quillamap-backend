import { toSeedableGreenCoverage } from './green-coverage.seed';
import { GreenCoverageType } from '@/features/thermal-comfort/entities/green-coverage-type.enum';

describe('green coverage seed parser', () => {
  it('parses AMB trees and reconstructs park polygons from Overpass skeleton nodes', () => {
    const result = toSeedableGreenCoverage({
      elements: [
        {
          type: 'node',
          id: 1,
          lat: 10.99,
          lon: -74.79,
          tags: { natural: 'tree', name: 'Ceiba' },
        },
        { type: 'node', id: 10, lat: 10.99, lon: -74.79 },
        { type: 'node', id: 11, lat: 10.99, lon: -74.78 },
        { type: 'node', id: 12, lat: 11.0, lon: -74.78 },
        {
          type: 'way',
          id: 20,
          nodes: [10, 11, 12],
          tags: { leisure: 'park', name: 'Parque de prueba' },
        },
        {
          type: 'node',
          id: 30,
          lat: 10.7,
          lon: -74.79,
          tags: { natural: 'tree' },
        },
      ],
    });

    expect(result.skipped).toBe(1);
    expect(result.features).toHaveLength(2);
    expect(result.features[0]).toMatchObject({
      osmId: 'node/1',
      type: GreenCoverageType.TREE,
      name: 'Ceiba',
      geometry: {
        type: 'Point',
        coordinates: [-74.79, 10.99],
      },
    });
    expect(result.features[1]).toMatchObject({
      osmId: 'way/20',
      type: GreenCoverageType.PARK,
      name: 'Parque de prueba',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-74.79, 10.99],
          [-74.78, 10.99],
          [-74.78, 11],
          [-74.79, 10.99],
        ]],
      },
    });
  });
});
