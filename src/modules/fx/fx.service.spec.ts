import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { FxService } from './fx.service';
import { RedisService } from '../redis/redis.service';
import { Currency } from '../../common/enums';

describe('FxService', () => {
  let service: FxService;
  let redisService: jest.Mocked<RedisService>;

  const mockRateCache = {
    rates: {
      NGN: 1,
      USD: 0.00065,
      EUR: 0.0006,
      GBP: 0.00052,
    },
    baseCurrency: 'NGN',
    fetchedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FxService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal?: any) => {
              const config: Record<string, any> = {
                'fx.apiUrl': 'https://v6.exchangerate-api.com/v6',
                'fx.apiKey': 'test-key',
              };
              return config[key] ?? defaultVal;
            }),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getJson: jest.fn(),
            setJson: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(FxService);
    redisService = module.get(RedisService);
  });

  describe('getRates', () => {
    it('should return cached rates on cache hit', async () => {
      redisService.getJson.mockResolvedValue(mockRateCache);

      const result = await service.getRates(Currency.NGN);

      expect(result).toEqual(mockRateCache);
      expect(redisService.getJson).toHaveBeenCalledWith('fx:rates:NGN');
    });

    it('should fetch from api on cache miss', async () => {
      redisService.getJson.mockResolvedValue(null);

      const mockApiResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          result: 'success',
          base_code: 'NGN',
          conversion_rates: {
            NGN: 1,
            USD: 0.00065,
            EUR: 0.0006,
            GBP: 0.00052,
            CAD: 0.00088,
            AUD: 0.001,
            JPY: 0.097,
            CHF: 0.00058,
            INR: 0.054, // not in our Currency enum, should be filtered
          },
        }),
      };
      global.fetch = jest.fn().mockResolvedValue(mockApiResponse);

      const result = await service.getRates(Currency.NGN);

      expect(result.baseCurrency).toBe('NGN');
      expect(result.rates.USD).toBe(0.00065);
      expect(result.rates['INR']).toBeUndefined();
      expect(redisService.setJson).toHaveBeenCalledTimes(2); // primary + stale
    });

    it('should return stale cache when api fails', async () => {
      redisService.getJson
        .mockResolvedValueOnce(null) // primary cache miss
        .mockResolvedValueOnce(mockRateCache); // stale cache hit

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await service.getRates(Currency.NGN);

      expect(result.isStale).toBe(true);
      expect(result.rates).toEqual(mockRateCache.rates);
    });

    it('should throw when api fails and no stale cache', async () => {
      redisService.getJson.mockResolvedValue(null);
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(service.getRates(Currency.NGN)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('getRate', () => {
    it('should return 1 for same currency', async () => {
      const rate = await service.getRate(Currency.NGN, Currency.NGN);
      expect(rate).toBe(1);
    });

    it('should return correct rate from cache', async () => {
      redisService.getJson.mockResolvedValue(mockRateCache);

      const rate = await service.getRate(Currency.NGN, Currency.USD);
      expect(rate).toBe(0.00065);
    });

    it('should throw when rate not available for pair', async () => {
      redisService.getJson.mockResolvedValue({
        rates: { NGN: 1 },
        baseCurrency: 'NGN',
        fetchedAt: new Date().toISOString(),
      });

      await expect(
        service.getRate(Currency.NGN, Currency.USD),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('convertAmount', () => {
    it('should calculate converted amount correctly', async () => {
      redisService.getJson.mockResolvedValue(mockRateCache);

      const result = await service.convertAmount(Currency.NGN, Currency.USD, 10000);

      expect(result.rate).toBe(0.00065);
      expect(result.convertedAmount).toBe(6.5);
    });

    it('should return same amount for same currency', async () => {
      const result = await service.convertAmount(Currency.NGN, Currency.NGN, 5000);

      expect(result.rate).toBe(1);
      expect(result.convertedAmount).toBe(5000);
    });

    it('should round to 4 decimal places', async () => {
      redisService.getJson.mockResolvedValue({
        rates: { USD: 0.000651234 },
        baseCurrency: 'NGN',
        fetchedAt: new Date().toISOString(),
      });

      const result = await service.convertAmount(Currency.NGN, Currency.USD, 10000);

      const decimals = result.convertedAmount.toString().split('.')[1]?.length ?? 0;
      expect(decimals).toBeLessThanOrEqual(4);
    });
  });
});
