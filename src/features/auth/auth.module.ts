
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SupabaseStrategy } from '@/features/auth/supabase.strategy';
import { AuthController } from '@/features/auth/auth.controller';
import { AuthService } from './auth.service';
import { SupabaseAuthGuard } from '@/features/auth/guards/supabase-auth.guard';

@Module({
  imports: [PassportModule],
  providers: [SupabaseStrategy, AuthService, SupabaseAuthGuard],
  exports: [PassportModule, SupabaseAuthGuard],
  controllers: [AuthController],
})
export class AuthModule {}
