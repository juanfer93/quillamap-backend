import { Injectable, Logger } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { SupabaseClient, SupabaseClientOptions, User, Session, isAuthError } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from '@/features/auth/dto/login.dto';
import * as ws from 'ws';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_KEY must be provided.');
    }

    const options: SupabaseClientOptions<'public'> = {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      realtime: {
        transport: ws,
      },
    };
    this.supabase = new SupabaseClient(supabaseUrl, supabaseKey, options);
  }

  private handleAuthError(error: any, context: string) {
    if (isAuthError(error)) {
      this.logger.error(`[${context}] Auth error: ${error.message}`);
      throw new Error(error.message);
    } else {
      this.logger.error(`[${context}] Unknown error: ${JSON.stringify(error)}`);
      throw new Error(`An unknown error occurred in ${context}.`);
    }
  }

  async register(registerDto: RegisterDto): Promise<{ user: User | null; session: Session | null; }> {
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
        this.handleAuthError(error, 'register');
    }

    return data;
  }

  async login(loginDto: LoginDto): Promise<{ user: User | null; session: Session | null; }> {
    const { email, password } = loginDto;

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
        this.handleAuthError(error, 'login');
    }

    return data;
  }
}
