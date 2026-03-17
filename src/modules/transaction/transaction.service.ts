import { Injectable } from '@nestjs/common';
import { TransactionRepository } from './transaction.repository';
import { PaginationDto } from '../../common/dto';

@Injectable()
export class TransactionService {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async getUserTransactions(userId: string, pagination: PaginationDto) {
    const { data, total } = await this.transactionRepository.findByUser(userId, pagination);

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    return {
      transactions: data.map((t) => ({
        id: t.id,
        type: t.type,
        status: t.status,
        fromCurrency: t.fromCurrency,
        toCurrency: t.toCurrency,
        fromAmount: Number(t.fromAmount),
        toAmount: Number(t.toAmount),
        exchangeRate: t.exchangeRate ? Number(t.exchangeRate) : null,
        description: t.description,
        createdAt: t.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
