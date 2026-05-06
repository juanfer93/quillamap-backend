import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '@/features/auth/auth.controller';
import { AuthService } from '@/features/auth/auth.service';
import { RegisterDto } from '@/features/auth/dto/register.dto';
import { LoginDto } from '@/features/auth/dto/login.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        password: 'password',
        full_name: 'Test User',
        mobility_mode: 'walking',
        vehicle_type: null,
        license_plate: null,
      };

      const result = { user: { id: '1' }, session: null };
      mockAuthService.register.mockResolvedValue(result);

      expect(await controller.register(registerDto)).toEqual({
        success: true,
        message: 'Usuario registrado exitosamente',
        data: result,
      });
      expect(service.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('login', () => {
    it('should login a user', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password',
      };

      const result = { user: { id: '1' }, session: { access_token: 'token' } };
      mockAuthService.login.mockResolvedValue(result);

      expect(await controller.login(loginDto)).toEqual({
        success: true,
        message: 'Usuario logueado exitosamente',
        data: result,
      });
      expect(service.login).toHaveBeenCalledWith(loginDto);
    });
  });
});
