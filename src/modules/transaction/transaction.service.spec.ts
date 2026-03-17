import { Test, TestingModule } from '@nestjs/testing';
import { TransactionService } from './transaction.service';
import { TransactionRepository } from './transaction.repository';
import { TransactionType, TransactionStatus, Currency } from '../../common/enums';

describe('TransactionService', () => {
  let service: TransactionService;
  let repo: jest.Mocked<TransactionRepository>;

  const mockTransactions = [
    {
      id: 'txn-1',
      type: TransactionType.FUNDING,
      status: TransactionStatus.COMPLETED,
      fromCurrency: Currency.NGN,
      toCurrency: Currency.NGN,
      fromAmount: 50000,
      toAmount: 50000,
      exchangeRate: null,
      description: 'Funded 50000 NGN',
      createdAt: new Date('2026-03-10'),
    },
    {
      id: 'txn-2',
      type: TransactionType.CONVERSION,
      status: TransactionStatus.COMPLETED,
      fromCurrency: Currency.NGN,
      toCurrency: Currency.USD,
      fromAmount: 10000,
      toAmount: 6.5,
      exchangeRate: 0.00065,
      description: 'Converted 10000 NGN to 6.5 USD',
      createdAt: new Date('2026-03-11'),
    },
    {
      id: 'txn-3',
      type: TransactionType.TRADE,
      status: TransactionStatus.COMPLETED,
      fromCurrency: Currency.USD,
      toCurrency: Currency.NGN,
      fromAmount: 5,
      toAmount: 7692.3077,
      exchangeRate: 1538.4615,
      description: 'Traded 5 USD for 7692.3077 NGN',
      createdAt: new Date('2026-03-12'),
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: TransactionRepository,
          useValue: {
            findByUser: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(TransactionService);
    repo = module.get(TransactionRepository);
  });

  describe('getUserTransactions', () => {
    it('should return formatted transactions with pagination meta', async () => {
      repo.findByUser.mockResolvedValue({
        data: mockTransactions as any,
        total: 3,
      });

      const result = await service.getUserTransactions('user-uuid-1', {
        page: 1,
        limit: 20,
      });

      expect(result.transactions).toHaveLength(3);
      expect(result.meta).toEqual({
        total: 3,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should convert decimal fields to numbers', async () => {
      repo.findByUser.mockResolvedValue({
        data: [mockTransactions[1]] as any,
        total: 1,
      });

      const result = await service.getUserTransactions('user-uuid-1', {
        page: 1,
        limit: 10,
      });

      const txn = result.transactions[0];
      expect(typeof txn.fromAmount).toBe('number');
      expect(typeof txn.toAmount).toBe('number');
      expect(typeof txn.exchangeRate).toBe('number');
    });

    it('should return null for exchangeRate on funding transactions', async () => {
      repo.findByUser.mockResolvedValue({
        data: [mockTransactions[0]] as any,
        total: 1,
      });

      const result = await service.getUserTransactions('user-uuid-1', {
        page: 1,
        limit: 10,
      });

      expect(result.transactions[0].exchangeRate).toBeNull();
    });

    it('should calculate correct totalPages', async () => {
      repo.findByUser.mockResolvedValue({
        data: mockTransactions as any,
        total: 55,
      });

      const result = await service.getUserTransactions('user-uuid-1', {
        page: 1,
        limit: 20,
      });

      expect(result.meta.totalPages).toBe(3);
    });

    it('should use default pagination values when not provided', async () => {
      repo.findByUser.mockResolvedValue({
        data: [],
        total: 0,
      });

      const result = await service.getUserTransactions('user-uuid-1', {});

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.totalPages).toBe(0);
    });

    it('should pass filter params through to repository', async () => {
      repo.findByUser.mockResolvedValue({ data: [], total: 0 });

      const filter = {
        page: 2,
        limit: 10,
        type: TransactionType.TRADE,
        status: TransactionStatus.COMPLETED,
      };

      await service.getUserTransactions('user-uuid-1', filter);

      expect(repo.findByUser).toHaveBeenCalledWith('user-uuid-1', filter);
    });
  });
});
