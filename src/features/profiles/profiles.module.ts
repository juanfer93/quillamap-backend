import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profile } from '@/features/profiles/entities/profile.entity';
import { ProfilesController } from '@/features/profiles/profiles.controller';
import { ProfilesService } from '@/features/profiles/profiles.service';
import { AuthModule } from '@/features/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Profile]),
    forwardRef(() => AuthModule),
  ],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
