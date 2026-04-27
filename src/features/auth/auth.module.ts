
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SupabaseStrategy } from '@/features/auth/supabase.strategy';
import { AuthController } from '@/features/auth/auth.controller';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [SupabaseStrategy],
  exports: [PassportModule],
  controllers: [AuthController],
})
export class AuthModule {}
