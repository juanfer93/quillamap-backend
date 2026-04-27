import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class SupabaseAuthGuard extends AuthGuard('supabase') {
  handleRequest<TUser = any>(err: Error | null, user: TUser, info: unknown): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired token.');
    }
    return user;
  }
}
