import { Global, Module } from '@nestjs/common';
import { LoginRateLimiterService } from './login-rate-limiter.service';

@Global()
@Module({
  providers: [LoginRateLimiterService],
  exports: [LoginRateLimiterService],
})
export class SecurityModule {}
