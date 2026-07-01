import { AuthService } from '../../auth/service/auth.service';
import { BookingService } from '../../booking/service/booking.service';
import { CatalogService } from '../../catalog/service/catalog.service';
import { ReservationService } from '../../reservation/service/reservation.service';
import { AgentSession } from '../session/session.service';

export interface BookingToolsContext {
  auth: AuthService;
  booking: BookingService;
  catalog: CatalogService;
  reservation: ReservationService;
  session: AgentSession;
  sessionId: string;
}
