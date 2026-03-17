import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { MailService } from '../mail/mail.service';
import { WalletRepository } from '../wallet/wallet.repository';
import { RegisterDto, VerifyOtpDto, LoginDto, ResendOtpDto } from './dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { generateOtp, getOtpExpiry } from '../../common/utils';
import { Currency } from '../../common/enums';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly walletRepository: WalletRepository,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const otp = generateOtp();
    const otpExpiresAt = getOtpExpiry();

    const user = await this.userService.create({
      ...dto,
      otpCode: otp,
      otpExpiresAt,
    });

    await this.walletRepository.create(user.id, Currency.NGN);

    await this.mailService.sendOtp(user.email, otp);

    return {
      id: user.id,
      email: user.email,
      message: 'Registration successful. Check your email for the verification code.',
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.userService.findByEmailWithSecrets(dto.email);
    if (!user) {
      throw new BadRequestException('Invalid email or OTP');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    if (!user.otpCode || user.otpCode !== dto.otp) {
      throw new BadRequestException('Invalid email or OTP');
    }

    if (!user.otpExpiresAt || new Date() > user.otpExpiresAt) {
      throw new BadRequestException('OTP has expired. Request a new one.');
    }

    await this.userService.update(user.id, {
      isEmailVerified: true,
      otpCode: null,
      otpExpiresAt: null,
    });

    const token = this.generateToken(user);

    return {
      message: 'Email verified successfully',
      accessToken: token,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.userService.findByEmailWithSecrets(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await user.validatePassword(dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email before logging in');
    }

    const token = this.generateToken(user);

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async resendOtp(dto: ResendOtpDto) {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      throw new BadRequestException('No account found with this email');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    const otp = generateOtp();
    const otpExpiresAt = getOtpExpiry();

    await this.userService.update(user.id, { otpCode: otp, otpExpiresAt });
    await this.mailService.sendOtp(user.email, otp);

    return { message: 'A new verification code has been sent to your email' };
  }

  private generateToken(user: { id: string; email: string; role: string }): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as any,
    };
    return this.jwtService.sign(payload);
  }
}
