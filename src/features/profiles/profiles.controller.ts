
import { Controller } from '@nestjs/common';
import { ProfilesService } from '@/features/profiles/profiles.service';

@Controller('profiles')
export class ProfilesController {
    constructor(private readonly profilesService: ProfilesService) {}
}
