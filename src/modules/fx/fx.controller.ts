import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { FxService } from './fx.service';
import { ApiResponseDto } from '../../common/dto';
import { Currency } from '../../common/enums';

@ApiTags('FX')
@Controller('fx')
export class FxController {
  constructor(private readonly fxService: FxService) {}

  @Get('rates')
  @ApiOperation({ summary: 'Get current FX rates for supported currencies' })
  @ApiQuery({ name: 'base', enum: Currency, required: false, description: 'Base currency (defaults to USD)' })
  @ApiResponse({ status: 200, description: 'FX rates retrieved' })
  @ApiResponse({ status: 503, description: 'FX rates unavailable' })
  async getRates(@Query('base') base?: Currency) {
    const rates = await this.fxService.getRates(base || Currency.USD);
    return ApiResponseDto.success(rates, 'FX rates retrieved');
  }

  @Get('rates/all')
  @ApiOperation({ summary: 'Get FX rates matrix for all supported currency pairs' })
  @ApiResponse({ status: 200, description: 'Full rates matrix retrieved' })
  async getAllRates() {
    const rates = await this.fxService.getSupportedRates();
    return ApiResponseDto.success(rates, 'All FX rates retrieved');
  }
}
