import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './entities/wallet.entity';
import { WalletRepository } from './wallet.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet])],
  providers: [WalletRepository],
  exports: [WalletRepository],
})
export class WalletModule {}
