import { Controller, Get, UseGuards } from '@nestjs/common';
import { ProfilesService } from '@/features/profiles/profiles.service';
import { SupabaseAuthGuard } from '@/features/auth/guards/supabase-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@Controller('profiles')
@UseGuards(SupabaseAuthGuard)
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('me')
  getMe(@CurrentUser() user: any) {
    return this.profilesService.getOrCreateProfile(user.sub, user.email);
  }
}
