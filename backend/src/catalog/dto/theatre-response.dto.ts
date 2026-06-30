export interface TheatreResponseDto {
  id: string;
  name: string;
  city: string;
  address: string;
  createdAt: Date;
}

export function toTheatreResponse(theatre: {
  id: string;
  name: string;
  city: string;
  address: string;
  createdAt: Date;
}): TheatreResponseDto {
  return {
    id: theatre.id,
    name: theatre.name,
    city: theatre.city,
    address: theatre.address,
    createdAt: theatre.createdAt,
  };
}
