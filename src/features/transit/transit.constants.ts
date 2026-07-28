export const ACTIVE_STREAM_BUFFER_METERS = 35;
export const PHYSICAL_VALIDATION_RADIUS_METERS = 80;
export const TRANSIT_MAP_ROUTE_LIMIT = 500;
export const TRANSIT_MAP_STOP_LIMIT = 1_000;
export const TRANSIT_BUS_SUGGESTION_LIMIT = 4;
export const TRANSIT_BUS_SUGGESTION_CANDIDATE_LIMIT = 12;
export const TRANSIT_BUS_SUGGESTION_WALKING_RADIUS_METERS = 1_600;
export const TRANSMETRO_SUGGESTION_LIMIT = 4;
export const TRANSMETRO_SUGGESTION_CANDIDATE_LIMIT = 16;
export const TRANSMETRO_STOP_SEARCH_RADIUS_METERS = 1_600;
export const TRANSMETRO_SHAPE_STOP_RADIUS_METERS = 180;
export const TRANSIT_BUS_AVERAGE_METERS_PER_SECOND = 5;
export const TRANSMETRO_AVERAGE_METERS_PER_SECOND = 7;
export const TRANSIT_WALKING_AVERAGE_METERS_PER_SECOND = 1.35;
export const TRANSIT_DIRECT_ACCESS_THRESHOLD_METERS = 80;
export const COLOMBIA_TIME_ZONE = 'America/Bogota';
export const TRANSMETRO_EXPRESS_ROUTE_CODES = new Set(['R10', 'S10', 'S20', 'R40', 'S40']);
export const DEFAULT_TRANSMETRO_EXPRESS_PEAK_HOURS = {
  weekdaysOnly: true,
  windows: [
    { startsAt: '06:00', endsAt: '09:00' },
    { startsAt: '17:00', endsAt: '20:00' },
  ],
};
export const TRANSIT_MAP_COLORS = {
  transmetro: '#004574',
  colectivo: '#0077A3',
  secondary: '#D4AF37',
} as const;
