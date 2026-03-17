import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { Currency } from '../../common/enums';

@Injectable()
export class WalletRepository {
  constructor(
    @InjectRepository(Wallet)
    private readonly repo: Repository<Wallet>,
  ) {}

  async create(userId: string, currency: Currency, manager?: EntityManager): Promise<Wallet> {
    const repo = manager ? manager.getRepository(Wallet) : this.repo;
    const wallet = repo.create({ userId, currency, balance: 0, lockedBalance: 0 });
    return repo.save(wallet);
  }

  async findByUserAndCurrency(
    userId: string,
    currency: Currency,
    manager?: EntityManager,
  ): Promise<Wallet | null> {
    const repo = manager ? manager.getRepository(Wallet) : this.repo;
    return repo.findOne({ where: { userId, currency } });
  }

  async findByUserAndCurrencyForUpdate(
    userId: string,
    currency: Currency,
    manager: EntityManager,
  ): Promise<Wallet | null> {
    return manager
      .getRepository(Wallet)
      .createQueryBuilder('wallet')
      .setLock('pessimistic_write')
      .where('wallet.userId = :userId', { userId })
      .andWhere('wallet.currency = :currency', { currency })
      .getOne();
  }

  async findAllByUser(userId: string): Promise<Wallet[]> {
    return this.repo.find({
      where: { userId },
      order: { currency: 'ASC' },
    });
  }

  async updateBalance(
    walletId: string,
    balance: number,
    manager: EntityManager,
  ): Promise<void> {
    await manager.getRepository(Wallet).update(walletId, { balance });
  }

  async getOrCreate(
    userId: string,
    currency: Currency,
    manager?: EntityManager,
  ): Promise<Wallet> {
    const existing = await this.findByUserAndCurrency(userId, currency, manager);
    if (existing) return existing;
    return this.create(userId, currency, manager);
  }
}
