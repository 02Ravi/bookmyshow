import { AuthService } from '../../auth/service/auth.service';
import { BookingService } from '../../booking/service/booking.service';
import { CatalogService } from '../../catalog/service/catalog.service';
import { HoldService } from '../../hold/service/hold.service';
import { AgentSession } from '../session/session.service';

export interface BookingToolsContext {
  auth: AuthService;
  booking: BookingService;
  catalog: CatalogService;
  hold: HoldService;
  session: AgentSession;
  sessionId: string;
}
