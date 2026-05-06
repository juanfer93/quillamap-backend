import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RegisterDto } from '@/features/auth/dto/register.dto';
import { AuthService } from '@/features/auth/auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    const user = await this.authService.register(registerDto);
    return {
      success: true,
      message: 'Usuario registrado exitosamente',
      data: user,
    };
  }
}
