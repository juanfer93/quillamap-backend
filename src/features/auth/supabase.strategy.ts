import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy, 'supabase') {
  constructor(private readonly configService: ConfigService) {
    const jwtSecret = configService.get<string>('SUPABASE_JWT_SECRET');

    // Validación para satisfacer a TypeScript y evitar fallos en runtime
    if (!jwtSecret) {
      throw new Error('SUPABASE_JWT_SECRET no encontrada en las variables de entorno');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: any) {
    // El payload contiene la información del usuario de Supabase Auth (sub, email, etc.)
    return payload;
  }
}