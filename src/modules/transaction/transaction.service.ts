import { Injectable } from '@nestjs/common';
import { TransactionRepository } from './transaction.repository';
import { TransactionFilterDto } from './dto';

@Injectable()
export class TransactionService {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async getUserTransactions(userId: string, filter: TransactionFilterDto) {
    const { data, total } = await this.transactionRepository.findByUser(userId, filter);

    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

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
