import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { TransactionFilterDto } from './dto';

@Injectable()
export class TransactionRepository {
  constructor(
    @InjectRepository(Transaction)
    private readonly repo: Repository<Transaction>,
  ) {}

  async create(data: Partial<Transaction>, manager?: EntityManager): Promise<Transaction> {
    const repo = manager ? manager.getRepository(Transaction) : this.repo;
    const transaction = repo.create(data);
    return repo.save(transaction);
  }

  async findByIdempotencyKey(key: string): Promise<Transaction | null> {
    return this.repo.findOne({ where: { idempotencyKey: key } });
  }

  async findByUser(
    userId: string,
    filter: TransactionFilterDto,
  ): Promise<{ data: Transaction[]; total: number }> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('t')
      .where('t.userId = :userId', { userId })
      .orderBy('t.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (filter.type) {
      qb.andWhere('t.type = :type', { type: filter.type });
    }

    if (filter.status) {
      qb.andWhere('t.status = :status', { status: filter.status });
    }

    if (filter.fromDate) {
      qb.andWhere('t.createdAt >= :fromDate', { fromDate: filter.fromDate });
    }

    if (filter.toDate) {
      qb.andWhere('t.createdAt <= :toDate', { toDate: new Date(filter.toDate + 'T23:59:59') });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async updateStatus(
    id: string,
    status: Transaction['status'],
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager ? manager.getRepository(Transaction) : this.repo;
    await repo.update(id, { status });
  }
}
