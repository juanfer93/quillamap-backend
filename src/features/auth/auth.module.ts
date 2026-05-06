import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { SupabaseStrategy } from './strategies/supabase.strategy';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule, // <--- AÑADIDO: Dar acceso al ConfigService
    PassportModule.register({ defaultStrategy: 'supabase' }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SupabaseStrategy],
  exports: [AuthService, SupabaseStrategy],
})
export class AuthModule {}
