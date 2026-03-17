import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { PaginationDto, ApiResponseDto } from '../../common/dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List all registered users (admin only)' })
  @ApiResponse({ status: 200, description: 'Users retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin only' })
  async getUsers(@Query() pagination: PaginationDto) {
    const result = await this.adminService.getUsers(pagination);
    return ApiResponseDto.success(result.users, 'Users retrieved', result.meta);
  }

  @Get('users/:userId/wallets')
  @ApiOperation({ summary: 'Get wallet balances for a specific user (admin only)' })
  @ApiResponse({ status: 200, description: 'User wallets retrieved' })
  async getUserWallets(@Param('userId') userId: string) {
    const wallets = await this.adminService.getUserWallets(userId);
    return ApiResponseDto.success(wallets, 'User wallets retrieved');
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List all transactions across users (admin only)' })
  @ApiResponse({ status: 200, description: 'Transactions retrieved' })
  async getAllTransactions(@Query() pagination: PaginationDto) {
    const result = await this.adminService.getAllTransactions(pagination);
    return ApiResponseDto.success(result.transactions, 'Transactions retrieved', result.meta);
  }

  @Get('transactions/summary')
  @ApiOperation({ summary: 'Get aggregated transaction stats (admin only)' })
  @ApiResponse({ status: 200, description: 'Transaction summary retrieved' })
  async getTransactionsSummary() {
    const summary = await this.adminService.getTransactionsSummary();
    return ApiResponseDto.success(summary, 'Transaction summary retrieved');
  }
}
