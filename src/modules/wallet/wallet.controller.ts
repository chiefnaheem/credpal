import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { FundWalletDto, ConvertCurrencyDto, TradeCurrencyDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponseDto } from '../../common/dto';
import { User } from '../user/entities/user.entity';

@ApiTags('Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
  @ApiResponse({ status: 201, description: 'Wallet funded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async fundWallet(@CurrentUser() user: User, @Body() dto: FundWalletDto) {
    const result = await this.walletService.fundWallet(user.id, dto);
    return ApiResponseDto.success(result, 'Wallet funded successfully');
  }

  @Post('convert')
  @ApiOperation({ summary: 'Convert between currencies using real-time FX rates' })
  @ApiResponse({ status: 201, description: 'Currency converted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or insufficient balance' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 503, description: 'FX rates unavailable' })
  async convertCurrency(@CurrentUser() user: User, @Body() dto: ConvertCurrencyDto) {
    const result = await this.walletService.convertCurrency(user.id, dto);
    return ApiResponseDto.success(result, 'Currency converted successfully');
  }

  @Post('trade')
  @ApiOperation({ summary: 'Trade Naira against other currencies and vice versa' })
  @ApiResponse({ status: 201, description: 'Trade executed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input, insufficient balance, or non-NGN pair' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 503, description: 'FX rates unavailable' })
  async tradeCurrency(@CurrentUser() user: User, @Body() dto: TradeCurrencyDto) {
    const result = await this.walletService.tradeCurrency(user.id, dto);
    return ApiResponseDto.success(result, 'Trade executed successfully');
  }
}
