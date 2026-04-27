import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SupabaseJwtPayload } from '@/features/auth/interfaces/supabase-payload.interface';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): SupabaseJwtPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: SupabaseJwtPayload }>();
    return request.user;
  },
);
