
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesModule } from '@/features/profiles/profiles.module';
import { AuthModule } from '@/features/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes ConfigService available throughout the app
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: true, // TODO: Disable in production
      ssl: {
        rejectUnauthorized: false,
      },
      extra: {
        extensions: ['postgis'],
      },
    }),
    ProfilesModule,
    AuthModule,
  ],
})
export class AppModule {}
