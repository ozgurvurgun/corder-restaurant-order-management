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
import { RolesService } from '../application/roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import {
  BossOnly,
  PanelRootGuard,
  RequirePermissions,
} from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';

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
  ) {
    return this.rolesService.create(restaurantId, dto);
  }

  @Put(':idOrKey')
  @RequirePermissions('roles.manage')
  update(
    @RestaurantId() restaurantId: string,
    @Param('idOrKey') idOrKey: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(restaurantId, idOrKey, dto);
  }

  @Post(':idOrKey/reset')
  @RequirePermissions('roles.manage')
  reset(
    @RestaurantId() restaurantId: string,
    @Param('idOrKey') idOrKey: string,
  ) {
    return this.rolesService.resetToDefault(restaurantId, idOrKey);
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

