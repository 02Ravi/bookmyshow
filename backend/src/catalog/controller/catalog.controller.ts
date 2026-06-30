import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ListShowsQueryDto } from '../dto/list-shows-query.dto';
import { CatalogService } from '../service/catalog.service';

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('movies')
  findAllMovies() {
    return this.catalogService.findAllMovies();
  }

  @Get('movies/:id')
  findMovieById(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.findMovieById(id);
  }

  @Get('theatres')
  findAllTheatres() {
    return this.catalogService.findAllTheatres();
  }

  @Get('shows')
  findShows(@Query() query: ListShowsQueryDto) {
    return this.catalogService.findShows(query);
  }

  @Get('shows/:id/seats')
  findShowSeats(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.findShowSeats(id);
  }

  @Get('shows/:id')
  findShowById(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.findShowById(id);
  }
}
