import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '@/features/auth/auth.controller';
import { AuthService } from '@/features/auth/auth.service';
import { RegisterDto } from '@/features/auth/dto/register.dto';
import { LoginDto } from '@/features/auth/dto/login.dto';
import { MobilityMode } from '@/features/profiles/entities/mobility_mode.enum';
import { VehicleType } from '@/features/profiles/entities/vehicle_type.enum';

// Create a type for the mocked service
type MockAuthService = {
  register: jest.Mock;
  login: jest.Mock;
};

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: MockAuthService;

  beforeEach(async () => {
    // Initialize the mock service object
    mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService, // Use the mocked service
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
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
        mobility_mode: MobilityMode.PEATON,
        vehicle_type: VehicleType.PARTICULAR,
        license_plate: '1234ABC',
      };

      const result = {
        user: { id: '1' },
        session: null,
      };

      // Now TypeScript knows that .mockResolvedValue exists
      mockAuthService.register.mockResolvedValue(result);

      expect(await controller.register(registerDto)).toEqual(result);
      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('login', () => {
    it('should login a user', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password',
      };

      const result = {
        user: { id: '1' },
        session: { access_token: 'token' },
      };

      // Now TypeScript knows that .mockResolvedValue exists
      mockAuthService.login.mockResolvedValue(result);

      expect(await controller.login(loginDto)).toEqual(result);
      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
    });
  });
});
