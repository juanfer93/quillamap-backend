
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profile } from '@/features/profiles/entities/profile.entity';
import { ProfilesController } from '@/features/profiles/profiles.controller';
import { ProfilesService } from '@/features/profiles/profiles.service';

@Module({
  imports: [TypeOrmModule.forFeature([Profile])],
  controllers: [ProfilesController],
  providers: [ProfilesService],
})
export class ProfilesModule {}
