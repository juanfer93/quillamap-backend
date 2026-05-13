import { BadRequestException, Injectable, InternalServerErrorException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createClient, SupabaseClient, AuthApiError } from '@supabase/supabase-js';
import { LoginDto } from '@/features/auth/dto/login.dto';
import { RegisterDto } from '@/features/auth/dto/register.dto';
import { ProfilesService } from '@/features/profiles/profiles.service'; 

const ws = require('ws');

@Injectable()
export class AuthService implements OnModuleDestroy {
  private supabase: SupabaseClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly profilesService: ProfilesService, 
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
          license_plate
        }
      }
    });
  
    if (error) throw new BadRequestException(error.message);
  
    if (data.user) {
      const profile = await this.profilesService.getOrCreateProfile(
        data.user.id, 
        data.user.email!,
        full_name 
      );
  
      const payload = { sub: data.user.id, email: data.user.email };
      return {
        user: profile, 
        accessToken: this.jwtService.sign(payload),
      };
    }
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

    const profile = await this.profilesService.getOrCreateProfile(data.user.id, data.user.email!);

    const payload = { sub: data.user.id, email: data.user.email };
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