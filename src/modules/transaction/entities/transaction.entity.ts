import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Currency, TransactionType, TransactionStatus } from '../../../common/enums';
import { User } from '../../user/entities/user.entity';

@Entity('transactions')
@Index(['userId', 'createdAt'])
export class Transaction extends BaseEntity {
  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.PENDING })
  status: TransactionStatus;

  @Column({ type: 'enum', enum: Currency })
  fromCurrency: Currency;

  @Column({ type: 'enum', enum: Currency })
  toCurrency: Currency;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  fromAmount: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  toAmount: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  exchangeRate: number;

  @Index({ unique: true })
  @Column({ length: 64 })
  idempotencyKey: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
