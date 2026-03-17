import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { WalletService } from './wallet.service';
import { WalletRepository } from './wallet.repository';
import { TransactionRepository } from '../transaction/transaction.repository';
import { FxService } from '../fx/fx.service';
import { UserService } from '../user/user.service';
import { Currency, TransactionType, TransactionStatus } from '../../common/enums';

describe('WalletService', () => {
  let service: WalletService;
  let walletRepo: jest.Mocked<WalletRepository>;
  let transactionRepo: jest.Mocked<TransactionRepository>;
  let fxService: jest.Mocked<FxService>;
  let userService: jest.Mocked<UserService>;
  let dataSource: jest.Mocked<DataSource>;

  const mockUserId = 'user-uuid-1';
  const mockWallet = {
    id: 'wallet-uuid-1',
    userId: mockUserId,
    currency: Currency.NGN,
    balance: 50000,
    lockedBalance: 0,
    version: 0,
  };

  const mockTransaction = {
    id: 'txn-uuid-1',
    userId: mockUserId,
    type: TransactionType.FUNDING,
    status: TransactionStatus.COMPLETED,
    fromCurrency: Currency.NGN,
    toCurrency: Currency.NGN,
    fromAmount: 10000,
    toAmount: 10000,
    exchangeRate: null,
    idempotencyKey: 'test-key',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockManager = {
      getRepository: jest.fn(),
    } as unknown as EntityManager;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: WalletRepository,
          useValue: {
            findAllByUser: jest.fn(),
            getOrCreate: jest.fn(),
            findByUserAndCurrencyForUpdate: jest.fn(),
            updateBalance: jest.fn(),
          },
        },
        {
          provide: TransactionRepository,
          useValue: {
            findByIdempotencyKey: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: FxService,
          useValue: {
            convertAmount: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            findById: jest.fn(),
            findByEmail: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((cb) => cb(mockManager)),
          },
        },
      ],
    }).compile();

    service = module.get(WalletService);
    walletRepo = module.get(WalletRepository);
    transactionRepo = module.get(TransactionRepository);
    fxService = module.get(FxService);
    userService = module.get(UserService);
    dataSource = module.get(DataSource);
  });

  describe('getBalances', () => {
    it('should return existing wallet balances', async () => {
      walletRepo.findAllByUser.mockResolvedValue([mockWallet as any]);

      const result = await service.getBalances(mockUserId);

      expect(result).toEqual([
        { currency: Currency.NGN, balance: 50000, lockedBalance: 0 },
      ]);
      expect(walletRepo.findAllByUser).toHaveBeenCalledWith(mockUserId);
    });

    it('should return zero balances for all currencies when no wallets exist', async () => {
      walletRepo.findAllByUser.mockResolvedValue([]);

      const result = await service.getBalances(mockUserId);

      expect(result.length).toBe(Object.values(Currency).length);
      expect(result.every((w) => w.balance === 0)).toBe(true);
    });
  });

  describe('fundWallet', () => {
    it('should fund wallet and return transaction', async () => {
      transactionRepo.findByIdempotencyKey.mockResolvedValue(null);
      walletRepo.getOrCreate.mockResolvedValue(mockWallet as any);
      walletRepo.findByUserAndCurrencyForUpdate.mockResolvedValue(mockWallet as any);
      walletRepo.updateBalance.mockResolvedValue(undefined);
      transactionRepo.create.mockResolvedValue(mockTransaction as any);

      const result = await service.fundWallet(mockUserId, {
        currency: Currency.NGN,
        amount: 10000,
      });

      expect(result.transactionId).toBe(mockTransaction.id);
      expect(result.type).toBe(TransactionType.FUNDING);
      expect(result.status).toBe(TransactionStatus.COMPLETED);
    });

    it('should return existing transaction for duplicate idempotency key', async () => {
      transactionRepo.findByIdempotencyKey.mockResolvedValue(mockTransaction as any);

      const result = await service.fundWallet(mockUserId, {
        currency: Currency.NGN,
        amount: 10000,
        idempotencyKey: 'test-key',
      });

      expect(result.transactionId).toBe(mockTransaction.id);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('convertCurrency', () => {
    it('should reject converting same currency', async () => {
      await expect(
        service.convertCurrency(mockUserId, {
          fromCurrency: Currency.NGN,
          toCurrency: Currency.NGN,
          amount: 1000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when balance is insufficient', async () => {
      const lowBalanceWallet = { ...mockWallet, balance: 100 };
      transactionRepo.findByIdempotencyKey.mockResolvedValue(null);
      fxService.convertAmount.mockResolvedValue({ convertedAmount: 2.15, rate: 0.00065 });
      walletRepo.getOrCreate.mockResolvedValue(lowBalanceWallet as any);
      walletRepo.findByUserAndCurrencyForUpdate.mockResolvedValue(lowBalanceWallet as any);

      await expect(
        service.convertCurrency(mockUserId, {
          fromCurrency: Currency.NGN,
          toCurrency: Currency.USD,
          amount: 1000,
        }),
      ).rejects.toThrow('Insufficient NGN balance');
    });

    it('should convert currency and update both wallets', async () => {
      const sourceWallet = { ...mockWallet, balance: 50000 };
      const targetWallet = { ...mockWallet, id: 'wallet-uuid-2', currency: Currency.USD, balance: 10 };
      const convertTxn = {
        ...mockTransaction,
        type: TransactionType.CONVERSION,
        fromCurrency: Currency.NGN,
        toCurrency: Currency.USD,
        fromAmount: 1000,
        toAmount: 0.65,
        exchangeRate: 0.00065,
      };

      transactionRepo.findByIdempotencyKey.mockResolvedValue(null);
      fxService.convertAmount.mockResolvedValue({ convertedAmount: 0.65, rate: 0.00065 });
      walletRepo.getOrCreate
        .mockResolvedValueOnce(sourceWallet as any)
        .mockResolvedValueOnce(targetWallet as any);
      walletRepo.findByUserAndCurrencyForUpdate
        .mockResolvedValueOnce(sourceWallet as any)
        .mockResolvedValueOnce(targetWallet as any);
      walletRepo.updateBalance.mockResolvedValue(undefined);
      transactionRepo.create.mockResolvedValue(convertTxn as any);

      const result = await service.convertCurrency(mockUserId, {
        fromCurrency: Currency.NGN,
        toCurrency: Currency.USD,
        amount: 1000,
      });

      expect(result.sourceBalance).toBe(49000);
      expect(result.targetBalance).toBe(10.65);
      expect(walletRepo.updateBalance).toHaveBeenCalledTimes(2);
    });
  });

  describe('tradeCurrency', () => {
    it('should reject trades not involving NGN', async () => {
      await expect(
        service.tradeCurrency(mockUserId, {
          fromCurrency: Currency.USD,
          toCurrency: Currency.EUR,
          amount: 100,
        }),
      ).rejects.toThrow('Trades must involve NGN');
    });

    it('should reject trading same currency', async () => {
      await expect(
        service.tradeCurrency(mockUserId, {
          fromCurrency: Currency.USD,
          toCurrency: Currency.USD,
          amount: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('transfer', () => {
    const recipientUser = {
      id: 'user-uuid-2',
      email: 'recipient@example.com',
      isEmailVerified: true,
    };

    it('should reject transfer to self', async () => {
      userService.findById.mockResolvedValue({ id: mockUserId, email: 'self@example.com' } as any);
      userService.findByEmail.mockResolvedValue({ id: mockUserId, email: 'self@example.com', isEmailVerified: true } as any);
      transactionRepo.findByIdempotencyKey.mockResolvedValue(null);

      await expect(
        service.transfer(mockUserId, {
          recipientEmail: 'self@example.com',
          currency: Currency.NGN,
          amount: 1000,
        }),
      ).rejects.toThrow('Cannot transfer to yourself');
    });

    it('should reject transfer to nonexistent user', async () => {
      userService.findById.mockResolvedValue({ id: mockUserId } as any);
      userService.findByEmail.mockResolvedValue(null);

      await expect(
        service.transfer(mockUserId, {
          recipientEmail: 'nobody@example.com',
          currency: Currency.NGN,
          amount: 1000,
        }),
      ).rejects.toThrow('Recipient not found');
    });

    it('should reject transfer to unverified recipient', async () => {
      userService.findById.mockResolvedValue({ id: mockUserId } as any);
      userService.findByEmail.mockResolvedValue({ id: 'user-uuid-2', isEmailVerified: false } as any);

      await expect(
        service.transfer(mockUserId, {
          recipientEmail: 'unverified@example.com',
          currency: Currency.NGN,
          amount: 1000,
        }),
      ).rejects.toThrow('Recipient account is not verified');
    });

    it('should complete transfer between two users', async () => {
      const senderWallet = { ...mockWallet, balance: 50000 };
      const recipientWallet = { ...mockWallet, id: 'wallet-uuid-3', userId: 'user-uuid-2', balance: 5000 };
      const transferTxn = {
        ...mockTransaction,
        type: TransactionType.TRANSFER,
        fromAmount: 10000,
        toAmount: 10000,
      };

      userService.findById.mockResolvedValue({ id: mockUserId, email: 'sender@example.com' } as any);
      userService.findByEmail.mockResolvedValue(recipientUser as any);
      transactionRepo.findByIdempotencyKey.mockResolvedValue(null);
      walletRepo.getOrCreate
        .mockResolvedValueOnce(senderWallet as any)
        .mockResolvedValueOnce(recipientWallet as any);
      walletRepo.findByUserAndCurrencyForUpdate
        .mockResolvedValueOnce(senderWallet as any)
        .mockResolvedValueOnce(recipientWallet as any);
      walletRepo.updateBalance.mockResolvedValue(undefined);
      transactionRepo.create.mockResolvedValue(transferTxn as any);

      const result = await service.transfer(mockUserId, {
        recipientEmail: 'recipient@example.com',
        currency: Currency.NGN,
        amount: 10000,
      });

      expect(result.senderBalance).toBe(40000);
      expect(walletRepo.updateBalance).toHaveBeenCalledTimes(2);
    });
  });
});
