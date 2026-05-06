
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesModule } from '@/features/profiles/profiles.module';
import { AuthModule } from '@/features/auth/auth.module';
import { ReportsModule } from '@/features/reports/reports.module';
import { ZonesModule } from '@/features/zones/zones.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes ConfigService available throughout the app
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: true, // TODO: Disable in production
        ssl: true,
        extra: {
          ssl: {
            rejectUnauthorized: false,
          },
          extensions: ['postgis'],
        },
      }),
    }),
    ProfilesModule,
    AuthModule,
    ReportsModule,
    ZonesModule
  ],
})
export class AppModule {}
