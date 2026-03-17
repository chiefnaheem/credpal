import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../user/entities/user.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { Wallet } from '../wallet/entities/wallet.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Transaction, Wallet])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
