import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency, TransactionType, TransactionStatus } from '../enums';

export class WalletBalanceResponse {
  @ApiProperty({ enum: Currency, example: Currency.NGN })
  currency: Currency;

  @ApiProperty({ example: 50000 })
  balance: number;

  @ApiProperty({ example: 0 })
  lockedBalance: number;
}

export class TransactionResponse {
  @ApiProperty({ example: 'uuid-string' })
  id: string;

  @ApiProperty({ enum: TransactionType })
  type: TransactionType;

  @ApiProperty({ enum: TransactionStatus })
  status: TransactionStatus;

  @ApiProperty({ enum: Currency })
  fromCurrency: Currency;

  @ApiProperty({ enum: Currency })
  toCurrency: Currency;

  @ApiProperty({ example: 1000 })
  fromAmount: number;

  @ApiProperty({ example: 2.15 })
  toAmount: number;

  @ApiPropertyOptional({ example: 0.00065 })
  exchangeRate: number | null;

  @ApiPropertyOptional({ example: 'Converted 1000 NGN to 2.15 USD' })
  description: string;

  @ApiProperty()
  createdAt: Date;
}

export class FundResultResponse {
  @ApiProperty({ example: 'uuid-string' })
  transactionId: string;

  @ApiProperty({ enum: TransactionType })
  type: TransactionType;

  @ApiProperty({ enum: TransactionStatus })
  status: TransactionStatus;

  @ApiProperty({ enum: Currency })
  fromCurrency: Currency;

  @ApiProperty({ enum: Currency })
  toCurrency: Currency;

  @ApiProperty({ example: 10000 })
  fromAmount: number;

  @ApiProperty({ example: 10000 })
  toAmount: number;

  @ApiProperty({ example: 'idempotency-key-string' })
  idempotencyKey: string;

  @ApiPropertyOptional({ example: 60000 })
  balance: number;
}

export class ConvertResultResponse extends FundResultResponse {
  @ApiProperty({ example: 0.00065 })
  exchangeRate: number;

  @ApiProperty({ example: 49000 })
  sourceBalance: number;

  @ApiProperty({ example: 2.15 })
  targetBalance: number;
}

export class AuthTokenResponse {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIs...' })
  accessToken: string;
}

export class LoginResponse extends AuthTokenResponse {
  @ApiProperty({
    example: {
      id: 'uuid',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'USER',
    },
  })
  user: Record<string, any>;
}

export class PaginationMeta {
  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}
