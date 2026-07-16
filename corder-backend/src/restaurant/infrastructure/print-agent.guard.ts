import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';

export type PrintAgentRequest = {
  printAgentRestaurantId: string;
  headers: { authorization?: string };
};

@Injectable()
export class PrintAgentGuard implements CanActivate {
  constructor(
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepo: Repository<RestaurantEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PrintAgentRequest>();
    const raw = request.headers?.authorization;
    const token = raw?.startsWith('Bearer ') ? raw.slice(7).trim() : raw?.trim();
    if (!token) {
      throw new UnauthorizedException();
    }
    const restaurant = await this.restaurantRepo.findOne({
      where: { printAgentToken: token },
    });
    if (!restaurant) {
      throw new UnauthorizedException();
    }
    request.printAgentRestaurantId = restaurant.id;
    return true;
  }
}
