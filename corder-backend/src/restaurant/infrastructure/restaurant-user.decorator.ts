import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RestaurantJwtRole } from '../application/restaurant-auth.service';

export const RestaurantUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user as {
    sub: string;
    restaurantId: string;
    email: string;
    name: string;
    role: RestaurantJwtRole;
  };
  return { id: user.sub, email: user.email, name: user.name, role: user.role };
});
