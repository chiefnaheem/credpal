import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { MailService } from '../mail/mail.service';
import { WalletRepository } from '../wallet/wallet.repository';
import { UserRole } from '../../common/enums';

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<UserService>;
  let jwtService: jest.Mocked<JwtService>;
  let mailService: jest.Mocked<MailService>;
  let walletRepo: jest.Mocked<WalletRepository>;

  const mockUser = {
    id: 'user-uuid-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    password: '$2b$12$hashedpassword',
    role: UserRole.USER,
    isEmailVerified: false,
    otpCode: '123456',
    otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    validatePassword: jest.fn(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            findByEmail: jest.fn(),
            findByEmailWithSecrets: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendOtp: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: WalletRepository,
          useValue: {
            create: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    userService = module.get(UserService);
    jwtService = module.get(JwtService);
    mailService = module.get(MailService);
    walletRepo = module.get(WalletRepository);
  });

  describe('register', () => {
    it('should register a new user and send otp', async () => {
      userService.findByEmail.mockResolvedValue(null);
      userService.create.mockResolvedValue(mockUser as any);

      const result = await service.register({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'StrongP@ss1',
      });

      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
      expect(userService.create).toHaveBeenCalledTimes(1);
      expect(mailService.sendOtp).toHaveBeenCalledWith(mockUser.email, expect.any(String));
      expect(walletRepo.create).toHaveBeenCalledWith(mockUser.id, 'NGN');
    });

    it('should throw conflict if email already exists', async () => {
      userService.findByEmail.mockResolvedValue(mockUser as any);

      await expect(
        service.register({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          password: 'StrongP@ss1',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('verifyOtp', () => {
    it('should verify otp and return access token', async () => {
      userService.findByEmailWithSecrets.mockResolvedValue(mockUser as any);

      const result = await service.verifyOtp({
        email: 'john@example.com',
        otp: '123456',
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(userService.update).toHaveBeenCalledWith(mockUser.id, {
        isEmailVerified: true,
        otpCode: null,
        otpExpiresAt: null,
      });
    });

    it('should reject invalid otp', async () => {
      userService.findByEmailWithSecrets.mockResolvedValue(mockUser as any);

      await expect(
        service.verifyOtp({ email: 'john@example.com', otp: '000000' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject expired otp', async () => {
      const expiredUser = {
        ...mockUser,
        otpExpiresAt: new Date(Date.now() - 60 * 1000),
      };
      userService.findByEmailWithSecrets.mockResolvedValue(expiredUser as any);

      await expect(
        service.verifyOtp({ email: 'john@example.com', otp: '123456' }),
      ).rejects.toThrow('OTP has expired');
    });

    it('should reject already verified email', async () => {
      const verifiedUser = { ...mockUser, isEmailVerified: true };
      userService.findByEmailWithSecrets.mockResolvedValue(verifiedUser as any);

      await expect(
        service.verifyOtp({ email: 'john@example.com', otp: '123456' }),
      ).rejects.toThrow('Email is already verified');
    });

    it('should reject unknown email', async () => {
      userService.findByEmailWithSecrets.mockResolvedValue(null);

      await expect(
        service.verifyOtp({ email: 'nobody@example.com', otp: '123456' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('should return token for valid credentials', async () => {
      const verifiedUser = { ...mockUser, isEmailVerified: true };
      verifiedUser.validatePassword = jest.fn().mockResolvedValue(true);
      userService.findByEmailWithSecrets.mockResolvedValue(verifiedUser as any);

      const result = await service.login({
        email: 'john@example.com',
        password: 'StrongP@ss1',
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.email).toBe(mockUser.email);
    });

    it('should reject invalid password', async () => {
      mockUser.validatePassword.mockResolvedValue(false);
      userService.findByEmailWithSecrets.mockResolvedValue(mockUser as any);

      await expect(
        service.login({ email: 'john@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject unverified email', async () => {
      const unverifiedUser = { ...mockUser, isEmailVerified: false };
      unverifiedUser.validatePassword = jest.fn().mockResolvedValue(true);
      userService.findByEmailWithSecrets.mockResolvedValue(unverifiedUser as any);

      await expect(
        service.login({ email: 'john@example.com', password: 'StrongP@ss1' }),
      ).rejects.toThrow('Please verify your email');
    });

    it('should reject unknown email', async () => {
      userService.findByEmailWithSecrets.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('resendOtp', () => {
    it('should resend otp to unverified user', async () => {
      userService.findByEmail.mockResolvedValue(mockUser as any);

      const result = await service.resendOtp({ email: 'john@example.com' });

      expect(result.message).toContain('new verification code');
      expect(userService.update).toHaveBeenCalled();
      expect(mailService.sendOtp).toHaveBeenCalled();
    });

    it('should reject if email not found', async () => {
      userService.findByEmail.mockResolvedValue(null);

      await expect(
        service.resendOtp({ email: 'nobody@example.com' }),
      ).rejects.toThrow('No account found');
    });

    it('should reject if already verified', async () => {
      const verifiedUser = { ...mockUser, isEmailVerified: true };
      userService.findByEmail.mockResolvedValue(verifiedUser as any);

      await expect(
        service.resendOtp({ email: 'john@example.com' }),
      ).rejects.toThrow('Email is already verified');
    });
  });
});
