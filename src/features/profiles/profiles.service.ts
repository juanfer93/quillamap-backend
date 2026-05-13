import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from '@/features/profiles/entities/profile.entity';
import { CreateProfileDto } from '@/features/profiles/dto/create-profile.dto';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
  ) {}

  async getOrCreateProfile(userId: string, email: string, full_name?: string): Promise<Profile> {
    let profile = await this.profileRepository.findOne({ where: { id: userId } });

    if (!profile) {
      profile = this.profileRepository.create({
        id: userId,
        email,
        full_name, 
        karma: 0,
      });
      await this.profileRepository.save(profile);
    }

    return profile;
  }

  async updateProfile(
    userId: string,
    createProfileDto: CreateProfileDto,
  ): Promise<Profile> {
    const profile = await this.getOrCreateProfile(userId, 'test@test.com');

    profile.mobility_mode = createProfileDto.mobility_mode;
    profile.vehicle_type = createProfileDto.vehicle_type ?? null;
    profile.license_plate = createProfileDto.license_plate;

    return this.profileRepository.save(profile);
  }

  async incrementKarma(profileId: string, points: number): Promise<void> {
    const profile = await this.profileRepository.findOne({ where: { id: profileId } });
    if (profile) {
      profile.karma += points;
      await this.profileRepository.save(profile);
    }
  }
}
