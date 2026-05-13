// 1. Añade forwardRef en la importación de @nestjs/common
import { Module, forwardRef } from '@nestjs/common'; 
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SupabaseStrategy } from './supabase.strategy';
import { ProfilesModule } from '@/features/profiles/profiles.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    
    forwardRef(() => ProfilesModule), 
    
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('NEST_JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, SupabaseStrategy],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}