import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { Point } from 'geojson';

@Entity('transit_stops')
export class TransitStop {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'route_id' })
  @Index()
  routeId: string;

  @Column()
  name: string;

  @Column({ name: 'agency_kind', default: 'colectivo' })
  agencyKind: 'transmetro' | 'colectivo';

  @Column({ name: 'source_snapshot_id', default: 'manual-bootstrap' })
  sourceSnapshotId: string;

  @Column({ name: 'is_accessible', default: false })
  isAccessible: boolean;

  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  @Index({ spatial: true })
  geom: Point;
}
