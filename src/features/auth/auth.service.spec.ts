import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '@/features/auth/auth.service';
import { ConfigService } from '@nestjs/config';
import { createClient, AuthApiError } from '@supabase/supabase-js';
import { RegisterDto } from '@/features/auth/dto/register.dto';
import { LoginDto } from '@/features/auth/dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { MobilityMode } from '@/features/profiles/entities/mobility_mode.enum';
import { ProfilesService } from '@/features/profiles/profiles.service';
import { EmailService } from '@/features/email/email.service';

// Mock the createClient function from '@supabase/supabase-js'
jest.mock('@supabase/supabase-js', () => ({
  ...jest.requireActual('@supabase/supabase-js'),
  createClient: jest.fn(),
}));

// Cast the mocked function to jest.Mock for type safety
const mockCreateClient = createClient as jest.Mock;

describe('AuthService', () => {
  let service: AuthService;
  let mockSignUp: jest.Mock;
  let mockSignInWithPassword: jest.Mock;
  let mockFindByEmail: jest.Mock;
  let mockSendWelcomeEmail: jest.Mock;

  beforeEach(async () => {
    // Create new mock functions for each test to ensure isolation
    mockSignUp = jest.fn();
    mockSignInWithPassword = jest.fn();
    mockFindByEmail = jest.fn().mockResolvedValue(null);
    mockSendWelcomeEmail = jest.fn().mockResolvedValue(undefined);

    // Configure the createClient mock to return our test-specific mocks
    mockCreateClient.mockReturnValue({
      auth: {
        signUp: mockSignUp,
        signInWithPassword: mockSignInWithPassword,
      },
    });

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
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('test-token'),
          },
        },
        {
          provide: ProfilesService,
          useValue: {
            findByEmail: mockFindByEmail,
            getOrCreateProfile: jest.fn().mockResolvedValue({ id: '1', email: 'test@example.com' }),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendWelcomeEmail: mockSendWelcomeEmail,
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    // Clear the master mock
    mockCreateClient.mockClear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    // The AuthService constructor calls createClient once
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });

  describe('register', () => {
    it('should register a user successfully', async () => {
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        password: 'password',
        full_name: 'Test User',
        mobility_mode: MobilityMode.PEATON,
        vehicle_type: undefined,
        license_plate: undefined,
      };

      const signUpResult = { data: { user: { id: '1' }, session: null }, error: null };
      mockSignUp.mockResolvedValue(signUpResult);

      const result = await service.register(registerDto);

      expect(mockFindByEmail).toHaveBeenCalledWith(registerDto.email.toLowerCase());
      expect(mockSignUp).toHaveBeenCalledWith({
        email: registerDto.email.toLowerCase(),
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
      expect(result).toEqual({
        user: { id: '1', email: 'test@example.com' },
        accessToken: 'test-token',
      });
      expect(mockSendWelcomeEmail).toHaveBeenCalledWith({
        to: 'test@example.com',
        fullName: undefined,
      });
    });

    it('should throw a clear BadRequestException if the profile email already exists', async () => {
      const registerDto: RegisterDto = {
        email: 'TEST@example.com',
        password: 'password',
        full_name: 'Test User',
        mobility_mode: MobilityMode.PEATON,
        vehicle_type: undefined,
        license_plate: undefined,
      };

      mockFindByEmail.mockResolvedValue({ id: '1', email: 'test@example.com' });

      await expect(service.register(registerDto)).rejects.toThrow('El correo ya existe. Inicia sesion o usa otro correo.');
      expect(mockSignUp).not.toHaveBeenCalled();
    });

    it('should throw a clear BadRequestException if Supabase reports an existing email', async () => {
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        password: 'password',
        full_name: 'Test User',
        mobility_mode: MobilityMode.PEATON,
        vehicle_type: undefined,
        license_plate: undefined,
      };

      const error = new AuthApiError('User already registered', 400, 'user_already_registered');
      mockSignUp.mockResolvedValue({ data: { user: null, session: null }, error });

      await expect(service.register(registerDto)).rejects.toThrow('El correo ya existe. Inicia sesion o usa otro correo.');
    });
  });

  describe('login', () => {
    it('should login a user successfully', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password',
      };

      const signInResult = { data: { user: { id: '1' }, session: { access_token: 'token' } }, error: null };
      mockSignInWithPassword.mockResolvedValue(signInResult);

      const result = await service.login(loginDto);

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: loginDto.email,
        password: loginDto.password,
      });
      expect(result).toEqual({
        user: { id: '1', email: 'test@example.com' },
        accessToken: 'test-token',
      });
    });

    it('should throw a BadRequestException if login fails', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'wrong-password',
      };

      const error = new AuthApiError('Invalid login credentials', 400, 'invalid_login_credentials');
      mockSignInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error });

      await expect(service.login(loginDto)).rejects.toThrow('Credenciales inválidas');
    });
  });
});
