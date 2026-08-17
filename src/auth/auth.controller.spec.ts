import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EntraAuthProvider } from './providers/entra-auth.provider';
import { NotImplementedException, BadRequestException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let entraAuthProvider: EntraAuthProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            refresh: jest.fn(),
          },
        },
        {
          provide: EntraAuthProvider,
          useValue: new EntraAuthProvider(),
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    entraAuthProvider = module.get<EntraAuthProvider>(EntraAuthProvider);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Entra ID Authentication (Stub)', () => {
    it('should return 501 Not Implemented for entraLogin', async () => {
      expect(() => controller.entraLogin()).toThrow(
        NotImplementedException,
      );
    });

    it('should return 501 Not Implemented for entraCallback', async () => {
      expect(() =>
        controller.entraCallback('test-code', 'test-state'),
      ).toThrow(NotImplementedException);
    });

    it('should handle Entra ID error responses', async () => {
      expect(() =>
        controller.entraCallback(
          undefined,
          'test-state',
          'access_denied',
          'User denied access',
        ),
      ).toThrow(BadRequestException);
    });

    it('should reject callback without authorization code', async () => {
      expect(() =>
        controller.entraCallback(undefined, 'test-state'),
      ).toThrow(BadRequestException);
    });
  });
});
