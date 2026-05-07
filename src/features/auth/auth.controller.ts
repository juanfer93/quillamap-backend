import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RegisterDto } from '@/features/auth/dto/register.dto';
import { AuthService } from '@/features/auth/auth.service';
import { LoginDto } from '@/features/auth/dto/login.dto';
import { ApiTags, ApiResponse } from '@nestjs/swagger';

@ApiTags('Auth') // <-- Añadido
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiResponse({ status: 201, description: 'Usuario registrado exitosamente.' }) // <-- Añadido
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: 'Login exitoso, devuelve el usuario y el token de acceso.' }) // <-- Añadido
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto); // <-- Corregido
  }
}
