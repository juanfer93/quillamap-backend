import { Controller, Get, UseGuards } from '@nestjs/common';
import { ProfilesService } from '@/features/profiles/profiles.service';
import { JwtAuthGuard } from '@/features/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

// El objeto `user` ahora es inyectado por nuestra JwtStrategy
type UserPayload = { userId: string; email: string };

@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('me')
  getMe(@CurrentUser() user: UserPayload) {
    return this.profilesService.getOrCreateProfile(user.userId, user.email);
  }
}
