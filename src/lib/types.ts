export type ProblemType =
  | "asphalt"
  | "pothole"
  | "traffic"
  | "trucks"
  | "sidewalk"
  | "lighting"
  | "other";

export interface RoadReport {
  id: string;
  type: ProblemType;
  description: string;
  lat: number;
  lng: number;
  address: string;
  photoDataUrl?: string;
  /** Фото лежит отдельно и подгружается в карточке */
  hasPhoto?: boolean;
  createdAt: string;
}

export interface MapFocus {
  lat: number;
  lng: number;
  zoom?: number;
}
