import { IsEmail, IsEnum, IsNumber, IsPositive, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency } from '../../../common/enums';

export class TransferDto {
  @ApiProperty({ example: 'recipient@example.com', description: 'Email of the recipient' })
  @IsEmail()
  recipientEmail: string;

  @ApiProperty({ enum: Currency, example: Currency.NGN, description: 'Currency to transfer' })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({ example: 5000, description: 'Amount to transfer' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ description: 'Unique key to prevent duplicate transfers' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
