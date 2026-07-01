import { Module } from '@nestjs/common';
import { CatalogController } from '../controller/catalog.controller';
import { CatalogService } from '../service/catalog.service';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
