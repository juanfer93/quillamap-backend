import { BadRequestException, Injectable, InternalServerErrorException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createClient, SupabaseClient, AuthApiError } from '@supabase/supabase-js';
import { LoginDto } from '@/features/auth/dto/login.dto';
import { RegisterDto } from '@/features/auth/dto/register.dto';

// Usamos require para garantizar la compatibilidad con el módulo CommonJS 'ws'
// en el entorno de build estricto de NestJS, que fallaba con la sintaxis 'import'.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ws = require('ws');

@Injectable()
export class AuthService implements OnModuleDestroy {
  private supabase: SupabaseClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new InternalServerErrorException('SUPABASE_URL and SUPABASE_KEY must be defined in .env file');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      realtime: { transport: ws },
    });
  }

  async onModuleDestroy() {
    await this.supabase.realtime.disconnect();
  }

  async register(registerDto: RegisterDto) {
    const { email, password, full_name, mobility_mode, vehicle_type, license_plate } = registerDto;

    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          mobility_mode,
          vehicle_type,
          license_plate,
        },
      },
    });

    if (error) {
      if (error instanceof AuthApiError && error.status >= 400 && error.status < 500) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    let accessToken: string | null = null;
    
    // Si el usuario se creó correctamente (y no requiere confirmación obligatoria)
    if (data.user) {
      const payload = { sub: data.user.id, email: data.user.email };
      accessToken = this.jwtService.sign(payload);
    }

    return {
      user: data.user,
      accessToken,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new BadRequestException('Credenciales inválidas');
    }

    const { data: profile, error: profileError } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      throw new InternalServerErrorException('Perfil de usuario no encontrado en la base de datos');
    }

    const payload = { sub: profile.id, email: profile.email };
    
    return {
      user: profile, 
      accessToken: this.jwtService.sign(payload),
    };
  }

  async logout() {
    await this.supabase.auth.signOut();
    return { message: 'Sesión cerrada correctamente' };
  }
}
