import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { SupabaseJwtPayload } from '@/features/auth/interfaces/supabase-payload.interface';

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy, 'supabase') {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Corregido: Usar la clave secreta de JWT, no la clave de servicio.
      secretOrKey: configService.get<string>('SUPABASE_JWT_SECRET'),
    });
  }

  async validate(payload: SupabaseJwtPayload) {
    return payload;
  }
}
