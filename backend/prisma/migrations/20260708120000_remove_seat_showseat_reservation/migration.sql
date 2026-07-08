-- Idempotent migration: remove Seat/ShowSeat/Reservation* and introduce BookedSeat.

-- Drop Booking FK to Reservation (Booking table still exists)
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_reservationId_fkey";

-- Drop leftover FKs only when the parent tables still exist
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='BookingSeat') THEN
    ALTER TABLE "BookingSeat" DROP CONSTRAINT IF EXISTS "BookingSeat_bookingId_fkey";
    ALTER TABLE "BookingSeat" DROP CONSTRAINT IF EXISTS "BookingSeat_showSeatId_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ReservationSeat') THEN
    ALTER TABLE "ReservationSeat" DROP CONSTRAINT IF EXISTS "ReservationSeat_reservationId_fkey";
    ALTER TABLE "ReservationSeat" DROP CONSTRAINT IF EXISTS "ReservationSeat_showSeatId_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ShowSeat') THEN
    ALTER TABLE "ShowSeat" DROP CONSTRAINT IF EXISTS "ShowSeat_showId_fkey";
    ALTER TABLE "ShowSeat" DROP CONSTRAINT IF EXISTS "ShowSeat_seatId_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Seat') THEN
    ALTER TABLE "Seat" DROP CONSTRAINT IF EXISTS "Seat_screenId_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Reservation') THEN
    ALTER TABLE "Reservation" DROP CONSTRAINT IF EXISTS "Reservation_userId_fkey";
  END IF;
END $$;

-- Clear remaining data
DELETE FROM "Booking";
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Reservation') THEN
    EXECUTE 'DELETE FROM "Reservation"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ShowSeat') THEN
    EXECUTE 'DELETE FROM "ShowSeat"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Seat') THEN
    EXECUTE 'DELETE FROM "Seat"';
  END IF;
END $$;

-- Drop old tables
DROP TABLE IF EXISTS "BookingSeat";
DROP TABLE IF EXISTS "ReservationSeat";
DROP TABLE IF EXISTS "Reservation";
DROP TABLE IF EXISTS "ShowSeat";
DROP TABLE IF EXISTS "Seat";

-- Drop unused enums
DROP TYPE IF EXISTS "ShowSeatStatus";
DROP TYPE IF EXISTS "ReservationStatus";
DROP TYPE IF EXISTS "SeatType";

-- Booking: remove reservation link, add totalPrice
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "reservationId";
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "totalPrice" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ALTER COLUMN "totalPrice" DROP DEFAULT;

-- Screen: add layoutConfig
ALTER TABLE "Screen" ADD COLUMN IF NOT EXISTS "layoutConfig" JSONB NOT NULL DEFAULT '{"rows":[]}';
ALTER TABLE "Screen" ALTER COLUMN "layoutConfig" DROP DEFAULT;

-- Show: add basePrice
ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "basePrice" DECIMAL(10,2) NOT NULL DEFAULT 200.00;
ALTER TABLE "Show" ALTER COLUMN "basePrice" DROP DEFAULT;

-- BookedSeat: sparse occupied-seat records
CREATE TABLE IF NOT EXISTS "BookedSeat" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "seatLabel" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "bookingId" TEXT NOT NULL,

    CONSTRAINT "BookedSeat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BookedSeat_showId_seatLabel_key" ON "BookedSeat"("showId", "seatLabel");
CREATE INDEX IF NOT EXISTS "BookedSeat_showId_idx" ON "BookedSeat"("showId");
CREATE INDEX IF NOT EXISTS "BookedSeat_bookingId_idx" ON "BookedSeat"("bookingId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BookedSeat_bookingId_fkey'
  ) THEN
    ALTER TABLE "BookedSeat" ADD CONSTRAINT "BookedSeat_bookingId_fkey"
      FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BookedSeat_showId_fkey'
  ) THEN
    ALTER TABLE "BookedSeat" ADD CONSTRAINT "BookedSeat_showId_fkey"
      FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
