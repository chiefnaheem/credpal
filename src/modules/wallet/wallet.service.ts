import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { WalletRepository } from './wallet.repository';
import { TransactionRepository } from '../transaction/transaction.repository';
import { FxService } from '../fx/fx.service';
import { UserService } from '../user/user.service';
import { FundWalletDto, ConvertCurrencyDto, TradeCurrencyDto, TransferDto } from './dto';
import { Currency, TransactionType, TransactionStatus } from '../../common/enums';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly fxService: FxService,
    private readonly userService: UserService,
    private readonly dataSource: DataSource,
  ) {}

  async getBalances(userId: string) {
    const wallets = await this.walletRepository.findAllByUser(userId);

    if (wallets.length === 0) {
      return Object.values(Currency).map((currency) => ({
        currency,
        balance: 0,
        lockedBalance: 0,
      }));
    }

    return wallets.map((w) => ({
      currency: w.currency,
      balance: Number(w.balance),
      lockedBalance: Number(w.lockedBalance),
    }));
  }

  async fundWallet(userId: string, dto: FundWalletDto) {
    const idempotencyKey = dto.idempotencyKey || uuidv4();

    const existing = await this.transactionRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      this.logger.warn(`Duplicate funding request detected: ${idempotencyKey}`);
      return this.formatTransactionResponse(existing);
    }

    return this.dataSource.transaction(async (manager) => {
      const wallet = await this.walletRepository.getOrCreate(userId, dto.currency, manager);

      const lockedWallet = await this.walletRepository.findByUserAndCurrencyForUpdate(
        userId,
        dto.currency,
        manager,
      );

      const newBalance = Number(lockedWallet.balance) + dto.amount;

      await this.walletRepository.updateBalance(lockedWallet.id, newBalance, manager);

      const transaction = await this.transactionRepository.create(
        {
          userId,
          type: TransactionType.FUNDING,
          status: TransactionStatus.COMPLETED,
          fromCurrency: dto.currency,
          toCurrency: dto.currency,
          fromAmount: dto.amount,
          toAmount: dto.amount,
          idempotencyKey,
          description: `Funded ${dto.amount} ${dto.currency}`,
        },
        manager,
      );

      this.logger.log(`Wallet funded: ${dto.amount} ${dto.currency} for user ${userId}`);

      return this.formatTransactionResponse(transaction, newBalance);
    });
  }

  async convertCurrency(userId: string, dto: ConvertCurrencyDto) {
    if (dto.fromCurrency === dto.toCurrency) {
      throw new BadRequestException('Cannot convert to the same currency');
    }

    const idempotencyKey = dto.idempotencyKey || uuidv4();

    const existing = await this.transactionRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      this.logger.warn(`Duplicate conversion request detected: ${idempotencyKey}`);
      return this.formatTransactionResponse(existing);
    }

    const { convertedAmount, rate } = await this.fxService.convertAmount(
      dto.fromCurrency,
      dto.toCurrency,
      dto.amount,
    );

    return this.dataSource.transaction(async (manager) => {
      await this.walletRepository.getOrCreate(userId, dto.fromCurrency, manager);
      await this.walletRepository.getOrCreate(userId, dto.toCurrency, manager);

      const sourceWallet = await this.walletRepository.findByUserAndCurrencyForUpdate(
        userId,
        dto.fromCurrency,
        manager,
      );

      const targetWallet = await this.walletRepository.findByUserAndCurrencyForUpdate(
        userId,
        dto.toCurrency,
        manager,
      );

      if (Number(sourceWallet.balance) < dto.amount) {
        throw new BadRequestException(
          `Insufficient ${dto.fromCurrency} balance. Available: ${sourceWallet.balance}`,
        );
      }

      const newSourceBalance = Number(sourceWallet.balance) - dto.amount;
      const newTargetBalance = Number(targetWallet.balance) + convertedAmount;

      await this.walletRepository.updateBalance(sourceWallet.id, newSourceBalance, manager);
      await this.walletRepository.updateBalance(targetWallet.id, newTargetBalance, manager);

      const transaction = await this.transactionRepository.create(
        {
          userId,
          type: TransactionType.CONVERSION,
          status: TransactionStatus.COMPLETED,
          fromCurrency: dto.fromCurrency,
          toCurrency: dto.toCurrency,
          fromAmount: dto.amount,
          toAmount: convertedAmount,
          exchangeRate: rate,
          idempotencyKey,
          description: `Converted ${dto.amount} ${dto.fromCurrency} to ${convertedAmount} ${dto.toCurrency}`,
          metadata: { rate, fetchedAt: new Date().toISOString() },
        },
        manager,
      );

      this.logger.log(
        `Conversion: ${dto.amount} ${dto.fromCurrency} → ${convertedAmount} ${dto.toCurrency} for user ${userId}`,
      );

      return {
        ...this.formatTransactionResponse(transaction),
        sourceBalance: newSourceBalance,
        targetBalance: newTargetBalance,
      };
    });
  }

  async tradeCurrency(userId: string, dto: TradeCurrencyDto) {
    if (dto.fromCurrency === dto.toCurrency) {
      throw new BadRequestException('Cannot trade the same currency');
    }

    const hasNgn =
      dto.fromCurrency === Currency.NGN || dto.toCurrency === Currency.NGN;
    if (!hasNgn) {
      throw new BadRequestException(
        'Trades must involve NGN on at least one side',
      );
    }

    const idempotencyKey = dto.idempotencyKey || uuidv4();

    const existing = await this.transactionRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      this.logger.warn(`Duplicate trade request detected: ${idempotencyKey}`);
      return this.formatTransactionResponse(existing);
    }

    const { convertedAmount, rate } = await this.fxService.convertAmount(
      dto.fromCurrency,
      dto.toCurrency,
      dto.amount,
    );

    return this.dataSource.transaction(async (manager) => {
      await this.walletRepository.getOrCreate(userId, dto.fromCurrency, manager);
      await this.walletRepository.getOrCreate(userId, dto.toCurrency, manager);

      const sourceWallet = await this.walletRepository.findByUserAndCurrencyForUpdate(
        userId,
        dto.fromCurrency,
        manager,
      );

      const targetWallet = await this.walletRepository.findByUserAndCurrencyForUpdate(
        userId,
        dto.toCurrency,
        manager,
      );

      if (Number(sourceWallet.balance) < dto.amount) {
        throw new BadRequestException(
          `Insufficient ${dto.fromCurrency} balance. Available: ${sourceWallet.balance}`,
        );
      }

      const newSourceBalance = Number(sourceWallet.balance) - dto.amount;
      const newTargetBalance = Number(targetWallet.balance) + convertedAmount;

      await this.walletRepository.updateBalance(sourceWallet.id, newSourceBalance, manager);
      await this.walletRepository.updateBalance(targetWallet.id, newTargetBalance, manager);

      const transaction = await this.transactionRepository.create(
        {
          userId,
          type: TransactionType.TRADE,
          status: TransactionStatus.COMPLETED,
          fromCurrency: dto.fromCurrency,
          toCurrency: dto.toCurrency,
          fromAmount: dto.amount,
          toAmount: convertedAmount,
          exchangeRate: rate,
          idempotencyKey,
          description: `Traded ${dto.amount} ${dto.fromCurrency} for ${convertedAmount} ${dto.toCurrency}`,
          metadata: { rate, fetchedAt: new Date().toISOString() },
        },
        manager,
      );

      this.logger.log(
        `Trade: ${dto.amount} ${dto.fromCurrency} → ${convertedAmount} ${dto.toCurrency} for user ${userId}`,
      );

      return {
        ...this.formatTransactionResponse(transaction),
        sourceBalance: newSourceBalance,
        targetBalance: newTargetBalance,
      };
    });
  }

  async transfer(userId: string, dto: TransferDto) {
    const sender = await this.userService.findById(userId);
    const recipient = await this.userService.findByEmail(dto.recipientEmail);

    if (!recipient) {
      throw new BadRequestException('Recipient not found');
    }

    if (recipient.id === userId) {
      throw new BadRequestException('Cannot transfer to yourself');
    }

    if (!recipient.isEmailVerified) {
      throw new BadRequestException('Recipient account is not verified');
    }

    const idempotencyKey = dto.idempotencyKey || uuidv4();

    const existing = await this.transactionRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      this.logger.warn(`Duplicate transfer request detected: ${idempotencyKey}`);
      return this.formatTransactionResponse(existing);
    }

    return this.dataSource.transaction(async (manager) => {
      await this.walletRepository.getOrCreate(userId, dto.currency, manager);
      await this.walletRepository.getOrCreate(recipient.id, dto.currency, manager);

      const senderWallet = await this.walletRepository.findByUserAndCurrencyForUpdate(
        userId,
        dto.currency,
        manager,
      );

      const recipientWallet = await this.walletRepository.findByUserAndCurrencyForUpdate(
        recipient.id,
        dto.currency,
        manager,
      );

      if (Number(senderWallet.balance) < dto.amount) {
        throw new BadRequestException(
          `Insufficient ${dto.currency} balance. Available: ${senderWallet.balance}`,
        );
      }

      const newSenderBalance = Number(senderWallet.balance) - dto.amount;
      const newRecipientBalance = Number(recipientWallet.balance) + dto.amount;

      await this.walletRepository.updateBalance(senderWallet.id, newSenderBalance, manager);
      await this.walletRepository.updateBalance(recipientWallet.id, newRecipientBalance, manager);

      const transaction = await this.transactionRepository.create(
        {
          userId,
          type: TransactionType.TRANSFER,
          status: TransactionStatus.COMPLETED,
          fromCurrency: dto.currency,
          toCurrency: dto.currency,
          fromAmount: dto.amount,
          toAmount: dto.amount,
          idempotencyKey,
          description: `Transferred ${dto.amount} ${dto.currency} to ${dto.recipientEmail}`,
          metadata: { recipientId: recipient.id, recipientEmail: dto.recipientEmail },
        },
        manager,
      );

      this.logger.log(
        `Transfer: ${dto.amount} ${dto.currency} from ${sender.email} to ${dto.recipientEmail}`,
      );

      return {
        ...this.formatTransactionResponse(transaction),
        senderBalance: newSenderBalance,
      };
    });
  }

  private formatTransactionResponse(transaction: any, balance?: number) {
    return {
      transactionId: transaction.id,
      type: transaction.type,
      status: transaction.status,
      fromCurrency: transaction.fromCurrency,
      toCurrency: transaction.toCurrency,
      fromAmount: Number(transaction.fromAmount),
      toAmount: Number(transaction.toAmount),
      exchangeRate: transaction.exchangeRate ? Number(transaction.exchangeRate) : null,
      idempotencyKey: transaction.idempotencyKey,
      createdAt: transaction.createdAt,
      ...(balance !== undefined && { balance }),
    };
  }
}
