import { BadRequestException, Injectable, InternalServerErrorException, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LoginDto } from '@/features/auth/dto/login.dto';
import { RegisterDto } from '@/features/auth/dto/register.dto';
import { ProfilesService } from '@/features/profiles/profiles.service'; 
import { EmailService } from '@/features/email/email.service';

const ws = require('ws');

@Injectable()
export class AuthService implements OnModuleDestroy {
  private readonly logger = new Logger(AuthService.name);
  private supabase: SupabaseClient;
  private readonly emailAlreadyExistsMessage = 'El correo ya existe. Inicia sesion o usa otro correo.';

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly profilesService: ProfilesService, 
    private readonly emailService: EmailService,
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
    const normalizedEmail = email.trim().toLowerCase();

    const existingProfile = await this.profilesService.findByEmail(normalizedEmail);

    if (existingProfile) {
      throw new BadRequestException(this.emailAlreadyExistsMessage);
    }
  
    const { data, error } = await this.supabase.auth.signUp({
      email: normalizedEmail,
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
  
    if (error) {
      if (this.isEmailAlreadyRegisteredError(error)) {
        throw new BadRequestException(this.emailAlreadyExistsMessage);
      }

      throw new BadRequestException(error.message);
    }
  
    if (data.user) {
      const profile = await this.profilesService.getOrCreateProfile(
        data.user.id, 
        data.user.email || normalizedEmail,
        full_name,
        {
          mobility_mode,
          vehicle_type,
          license_plate,
        },
      );

      try {
        await this.emailService.sendWelcomeEmail({
          to: profile.email,
          fullName: profile.full_name,
        });
      } catch (emailError) {
        this.logger.warn(`No se pudo enviar el correo de bienvenida: ${this.getErrorMessage(emailError)}`);
      }
  
      const payload = { sub: data.user.id, email: data.user.email || normalizedEmail };
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

  private isEmailAlreadyRegisteredError(error: unknown): boolean {
    const authError = error as { code?: string; message?: string };
    const message = authError.message?.toLowerCase() || '';

    return authError.code === 'user_already_registered'
      || message.includes('already registered')
      || message.includes('already been registered')
      || message.includes('correo ya existe');
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
