import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TransactionService } from './transaction.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../../common/guards/verified-email.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto, ApiResponseDto } from '../../common/dto';
import { User } from '../user/entities/user.entity';

@ApiTags('Transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, VerifiedEmailGuard)
@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated transaction history for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Transaction history retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTransactions(
    @CurrentUser() user: User,
    @Query() pagination: PaginationDto,
  ) {
    const result = await this.transactionService.getUserTransactions(user.id, pagination);
    return ApiResponseDto.success(result.transactions, 'Transaction history retrieved', result.meta);
  }
}
