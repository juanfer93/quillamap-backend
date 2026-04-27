import { Controller, Get, UseGuards } from '@nestjs/common';
import { ProfilesService } from '@/features/profiles/profiles.service';
import { SupabaseAuthGuard } from '@/features/auth/guards/supabase-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { SupabaseJwtPayload } from '@/features/auth/interfaces/supabase-payload.interface';

@Controller('profiles')
@UseGuards(SupabaseAuthGuard)
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('me')
  getMe(@CurrentUser() user: SupabaseJwtPayload) {
    return this.profilesService.getOrCreateProfile(user.sub, user.email);
  }
}
