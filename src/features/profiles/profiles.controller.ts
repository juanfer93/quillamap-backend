import { Controller, Get, UseGuards } from '@nestjs/common';
import { ProfilesService } from '@/features/profiles/profiles.service';
import { JwtAuthGuard } from '@/features/auth/guards/jwt-auth.guard';


@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}
}
