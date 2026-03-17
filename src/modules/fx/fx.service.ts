import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { Currency } from '../../common/enums';

interface ExchangeRateResponse {
  result: string;
  base_code: string;
  conversion_rates: Record<string, number>;
  time_last_update_utc: string;
}

export interface RateCache {
  rates: Record<string, number>;
  baseCurrency: string;
  fetchedAt: string;
}

@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly cacheTtl = 300; // 5 minutes
  private readonly cachePrefix = 'fx:rates:';

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.apiUrl = this.configService.get<string>('fx.apiUrl', 'https://v6.exchangerate-api.com/v6');
    this.apiKey = this.configService.get<string>('fx.apiKey', '');
  }

  async getRates(baseCurrency: Currency = Currency.USD): Promise<RateCache> {
    const cacheKey = `${this.cachePrefix}${baseCurrency}`;

    const cached = await this.redisService.getJson<RateCache>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${baseCurrency} rates`);
      return cached;
    }

    this.logger.debug(`Cache miss for ${baseCurrency}, fetching from API`);
    return this.fetchAndCacheRates(baseCurrency);
  }

  async getRate(from: Currency, to: Currency): Promise<number> {
    if (from === to) return 1;

    const rateData = await this.getRates(from);
    const rate = rateData.rates[to];

    if (!rate) {
      throw new ServiceUnavailableException(
        `Exchange rate not available for ${from} to ${to}`,
      );
    }

    return rate;
  }

  async convertAmount(from: Currency, to: Currency, amount: number): Promise<{ convertedAmount: number; rate: number }> {
    const rate = await this.getRate(from, to);
    const convertedAmount = Math.round(amount * rate * 10000) / 10000;
    return { convertedAmount, rate };
  }

  async getSupportedRates(): Promise<Record<string, Record<string, number>>> {
    const currencies = Object.values(Currency);
    const result: Record<string, Record<string, number>> = {};

    for (const base of currencies) {
      const rateData = await this.getRates(base);
      result[base] = {};
      for (const target of currencies) {
        if (base !== target) {
          result[base][target] = rateData.rates[target] ?? 0;
        }
      }
    }

    return result;
  }

  private async fetchAndCacheRates(baseCurrency: Currency): Promise<RateCache> {
    try {
      const url = `${this.apiUrl}/${this.apiKey}/latest/${baseCurrency}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`FX API returned status ${response.status}`);
      }

      const data: ExchangeRateResponse = await response.json();

      if (data.result !== 'success') {
        throw new Error(`FX API returned result: ${data.result}`);
      }

      const supportedCurrencies = Object.values(Currency) as string[];
      const filteredRates: Record<string, number> = {};
      for (const currency of supportedCurrencies) {
        if (data.conversion_rates[currency] !== undefined) {
          filteredRates[currency] = data.conversion_rates[currency];
        }
      }

      const rateCache: RateCache = {
        rates: filteredRates,
        baseCurrency,
        fetchedAt: new Date().toISOString(),
      };

      await this.redisService.setJson(
        `${this.cachePrefix}${baseCurrency}`,
        rateCache,
        this.cacheTtl,
      );

      this.logger.log(`Fetched and cached rates for ${baseCurrency}`);
      return rateCache;
    } catch (error) {
      this.logger.error(`Failed to fetch FX rates for ${baseCurrency}`, error.message);

      // Try to return stale cache as fallback
      const staleKey = `${this.cachePrefix}${baseCurrency}:stale`;
      const stale = await this.redisService.getJson<RateCache>(staleKey);
      if (stale) {
        this.logger.warn(`Returning stale cached rates for ${baseCurrency}`);
        return stale;
      }

      throw new ServiceUnavailableException(
        'FX rates are currently unavailable. Please try again later.',
      );
    }
  }
}
