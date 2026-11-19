import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RolePolicyActor, RolesService } from '../application/roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import {
  PanelRootGuard,
  RequirePermissions,
} from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';

@Controller('restaurant/roles')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('catalog')
  @RequirePermissions('roles.manage', 'staff.view', 'staff.manage')
  getCatalog() {
    return this.rolesService.getPermissionCatalog();
  }

  @Get()
  @RequirePermissions('roles.manage', 'staff.view', 'staff.manage')
  list(@RestaurantId() restaurantId: string) {
    return this.rolesService.list(restaurantId);
  }

  @Post()
  @RequirePermissions('roles.manage')
  create(
    @RestaurantId() restaurantId: string,
    @Body() dto: CreateRoleDto,
    @RestaurantUser() actor?: RolePolicyActor,
  ) {
    return this.rolesService.create(restaurantId, dto, actor);
  }

  @Put(':idOrKey')
  @RequirePermissions('roles.manage')
  update(
    @RestaurantId() restaurantId: string,
    @Param('idOrKey') idOrKey: string,
    @Body() dto: UpdateRoleDto,
    @RestaurantUser() actor?: RolePolicyActor,
  ) {
    return this.rolesService.update(restaurantId, idOrKey, dto, actor);
  }

  @Post(':idOrKey/reset')
  @RequirePermissions('roles.manage')
  reset(
    @RestaurantId() restaurantId: string,
    @Param('idOrKey') idOrKey: string,
    @RestaurantUser() actor?: RolePolicyActor,
  ) {
    return this.rolesService.resetToDefault(restaurantId, idOrKey, actor);
  }

  @Delete(':idOrKey')
  @RequirePermissions('roles.manage')
  remove(
    @RestaurantId() restaurantId: string,
    @Param('idOrKey') idOrKey: string,
  ) {
    return this.rolesService.delete(restaurantId, idOrKey);
  }
}

