import { Module } from '@nestjs/common';
import { HoldModule } from '../../hold/module/hold.module';
import { CatalogController } from '../controller/catalog.controller';
import { CatalogService } from '../service/catalog.service';

@Module({
  imports: [HoldModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
