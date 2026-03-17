import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { FundWalletDto, ConvertCurrencyDto, TradeCurrencyDto, TransferDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../../common/guards/verified-email.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IdempotencyKey } from '../../common/decorators/idempotency-key.decorator';
import { ApiResponseDto } from '../../common/dto';
import { User } from '../user/entities/user.entity';

@ApiTags('Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, VerifiedEmailGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Get all wallet balances for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Wallet balances retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getBalances(@CurrentUser() user: User) {
    const balances = await this.walletService.getBalances(user.id);
    return ApiResponseDto.success(balances, 'Wallet balances retrieved');
  }

  @Post('fund')
  @ApiOperation({ summary: 'Fund wallet in a specified currency' })
  @ApiHeader({ name: 'x-idempotency-key', required: false, description: 'Unique key to prevent duplicate requests' })
  @ApiResponse({ status: 201, description: 'Wallet funded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async fundWallet(
    @CurrentUser() user: User,
    @Body() dto: FundWalletDto,
    @IdempotencyKey() headerKey?: string,
  ) {
    if (headerKey) dto.idempotencyKey = headerKey;
    const result = await this.walletService.fundWallet(user.id, dto);
    return ApiResponseDto.success(result, 'Wallet funded successfully');
  }

  @Post('convert')
  @ApiOperation({ summary: 'Convert between currencies using real-time FX rates' })
  @ApiHeader({ name: 'x-idempotency-key', required: false, description: 'Unique key to prevent duplicate requests' })
  @ApiResponse({ status: 201, description: 'Currency converted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or insufficient balance' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 503, description: 'FX rates unavailable' })
  async convertCurrency(
    @CurrentUser() user: User,
    @Body() dto: ConvertCurrencyDto,
    @IdempotencyKey() headerKey?: string,
  ) {
    if (headerKey) dto.idempotencyKey = headerKey;
    const result = await this.walletService.convertCurrency(user.id, dto);
    return ApiResponseDto.success(result, 'Currency converted successfully');
  }

  @Post('trade')
  @ApiOperation({ summary: 'Trade Naira against other currencies and vice versa' })
  @ApiHeader({ name: 'x-idempotency-key', required: false, description: 'Unique key to prevent duplicate requests' })
  @ApiResponse({ status: 201, description: 'Trade executed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input, insufficient balance, or non-NGN pair' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 503, description: 'FX rates unavailable' })
  async tradeCurrency(
    @CurrentUser() user: User,
    @Body() dto: TradeCurrencyDto,
    @IdempotencyKey() headerKey?: string,
  ) {
    if (headerKey) dto.idempotencyKey = headerKey;
    const result = await this.walletService.tradeCurrency(user.id, dto);
    return ApiResponseDto.success(result, 'Trade executed successfully');
  }

  @Post('transfer')
  @ApiOperation({ summary: 'Transfer funds to another user by email' })
  @ApiHeader({ name: 'x-idempotency-key', required: false, description: 'Unique key to prevent duplicate requests' })
  @ApiResponse({ status: 201, description: 'Transfer completed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input, insufficient balance, or recipient not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async transfer(
    @CurrentUser() user: User,
    @Body() dto: TransferDto,
    @IdempotencyKey() headerKey?: string,
  ) {
    if (headerKey) dto.idempotencyKey = headerKey;
    const result = await this.walletService.transfer(user.id, dto);
    return ApiResponseDto.success(result, 'Transfer completed successfully');
  }
}
