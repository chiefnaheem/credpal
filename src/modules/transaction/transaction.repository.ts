import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { PaginationDto } from '../../common/dto';

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
    pagination: PaginationDto,
  ): Promise<{ data: Transaction[]; total: number }> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await this.repo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

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
