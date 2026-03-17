import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './entities/wallet.entity';
import { WalletRepository } from './wallet.repository';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { TransactionModule } from '../transaction/transaction.module';
import { FxModule } from '../fx/fx.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet]),
    TransactionModule,
    FxModule,
    UserModule,
  ],
  controllers: [WalletController],
  providers: [WalletRepository, WalletService],
  exports: [WalletRepository, WalletService],
})
export class WalletModule {}
