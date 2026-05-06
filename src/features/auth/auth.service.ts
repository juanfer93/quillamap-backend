import { Injectable } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { SupabaseClient, SupabaseClientOptions, User, Session } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
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
    };
    this.supabase = new SupabaseClient(supabaseUrl, supabaseKey, options);
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
      throw new Error(error.message);
    }

    return data;
  }
}
