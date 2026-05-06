import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '@/features/auth/auth.service';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, isAuthError } from '@supabase/supabase-js';
import { RegisterDto } from '@/features/auth/dto/register.dto';
import { LoginDto } from '@/features/auth/dto/login.dto';

const mockSupabaseClient = {
  auth: {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
  },
};

jest.mock('@supabase/supabase-js', () => ({
  SupabaseClient: jest.fn(() => mockSupabaseClient),
  isAuthError: jest.fn().mockReturnValue(true), // Mock isAuthError to handle test cases
}));

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    (SupabaseClient as jest.Mock).mockClear();
    (isAuthError as jest.Mock).mockClear(); // Also clear this mock
    mockSupabaseClient.auth.signUp.mockClear();
    mockSupabaseClient.auth.signInWithPassword.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'SUPABASE_URL') return 'http://localhost:54321';
              if (key === 'SUPABASE_KEY') return 'test-key';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a user successfully', async () => {
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        password: 'password',
        full_name: 'Test User',
        mobility_mode: 'peaton', // Corrected Enum value
        vehicle_type: null,
        license_plate: null,
      };

      const signUpResult = { data: { user: { id: '1' }, session: null }, error: null };
      mockSupabaseClient.auth.signUp.mockResolvedValue(signUpResult);

      const result = await service.register(registerDto);

      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
        email: registerDto.email,
        password: registerDto.password,
        options: {
          data: {
            full_name: registerDto.full_name,
            mobility_mode: registerDto.mobility_mode,
            vehicle_type: registerDto.vehicle_type,
            license_plate: registerDto.license_plate,
          },
        },
      });
      expect(result).toEqual(signUpResult.data);
    });

    it('should throw an error if registration fails', async () => {
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        password: 'password',
        full_name: 'Test User',
        mobility_mode: 'peaton', // Corrected Enum value
        vehicle_type: null,
        license_plate: null,
      };

      const error = { message: 'User already registered' };
      mockSupabaseClient.auth.signUp.mockResolvedValue({ data: { user: null, session: null }, error });

      await expect(service.register(registerDto)).rejects.toThrow(error.message);
    });
  });

  describe('login', () => {
    it('should login a user successfully', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password',
      };

      const signInResult = { data: { user: { id: '1' }, session: { access_token: 'token' } }, error: null };
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue(signInResult);

      const result = await service.login(loginDto);

      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: loginDto.email,
        password: loginDto.password,
      });
      expect(result).toEqual(signInResult.data);
    });

    it('should throw an error if login fails', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'wrong-password',
      };

      const error = { message: 'Invalid login credentials' };
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error });

      await expect(service.login(loginDto)).rejects.toThrow(error.message);
    });
  });
});
