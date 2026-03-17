import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { PaginationDto } from '../../common/dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
  ) {}

  async getUsers(pagination: PaginationDto) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = (page - 1) * limit;

    const [users, total] = await this.userRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      users: users.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        isEmailVerified: u.isEmailVerified,
        createdAt: u.createdAt,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUserWallets(userId: string) {
    const wallets = await this.walletRepo.find({
      where: { userId },
      order: { currency: 'ASC' },
    });

    return wallets.map((w) => ({
      id: w.id,
      currency: w.currency,
      balance: Number(w.balance),
      lockedBalance: Number(w.lockedBalance),
    }));
  }

  async getTransactionsSummary() {
    const totalCount = await this.transactionRepo.count();

    const byType = await this.transactionRepo
      .createQueryBuilder('t')
      .select('t.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(t.fromAmount)', 'totalFromAmount')
      .groupBy('t.type')
      .getRawMany();

    const byStatus = await this.transactionRepo
      .createQueryBuilder('t')
      .select('t.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('t.status')
      .getRawMany();

    return { totalCount, byType, byStatus };
  }

  async getAllTransactions(pagination: PaginationDto) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await this.transactionRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
      relations: ['user'],
    });

    return {
      transactions: data.map((t) => ({
        id: t.id,
        userId: t.userId,
        userEmail: t.user?.email,
        type: t.type,
        status: t.status,
        fromCurrency: t.fromCurrency,
        toCurrency: t.toCurrency,
        fromAmount: Number(t.fromAmount),
        toAmount: Number(t.toAmount),
        exchangeRate: t.exchangeRate ? Number(t.exchangeRate) : null,
        createdAt: t.createdAt,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
