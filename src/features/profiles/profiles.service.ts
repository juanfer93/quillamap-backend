import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from '@/features/profiles/entities/profile.entity';
import { VehicleType } from '@/features/profiles/entities/vehicle_type.enum';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
  ) {}

  async getOrCreateProfile(userId: string, email: string): Promise<Profile> {
    let profile = await this.profileRepository.findOne({ where: { id: userId } });

    if (!profile) {
      profile = this.profileRepository.create({
        id: userId,
        email,
        karma: 0,
        vehicle_type: VehicleType.CARRO_PARTICULAR,
      });
      await this.profileRepository.save(profile);
    }

    return profile;
  }

  async incrementKarma(profileId: string, points: number): Promise<void> {
    const profile = await this.profileRepository.findOne({ where: { id: profileId } });
    if (profile) {
      profile.karma += points;
      await this.profileRepository.save(profile);
    }
  }
}
