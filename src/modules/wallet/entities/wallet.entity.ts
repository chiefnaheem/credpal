import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Currency } from '../../../common/enums';
import { User } from '../../user/entities/user.entity';

@Entity('wallets')
@Index(['userId', 'currency'], { unique: true })
export class Wallet extends BaseEntity {
  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: Currency })
  currency: Currency;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  balance: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  lockedBalance: number;

  @Column({ type: 'int', default: 0 })
  version: number;
}
