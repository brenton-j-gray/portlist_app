export type Note = {
  id: string;
  date: string; // ISO date string
  title?: string;
  description?: string;
  weather?: string;
  notes?: string;
  photoUri?: string; // optional local image URI (legacy)
  photos?: { uri: string; caption?: string }[]; // new: support multiple photos
  location?: { lat: number; lng: number };
  locationName?: string; // human-readable label for location
};

export type Trip = {
  id: string;
  title: string; // e.g., "Alaska Cruise"
  ship?: string;
  startDate?: string; // ISO date
  endDate?: string; // ISO date
  completed?: boolean; // explicitly marked as completed by user
  ports?: string[];
  days: Note[];
  createdAt: number;
};

// Generic user-maintained lists (bucket list, packing list, custom checklists)
export type ListItem = {
  id: string;
  text: string;
  done?: boolean;
  notes?: string;
  order: number; // for stable sorting / drag reordering
  createdAt: number;
};

export type List = {
  id: string;
  title: string;
  type: 'bucket' | 'packing' | 'custom';
  items: ListItem[];
  createdAt: number;
  updatedAt: number;
  color?: string; // user-selected accent color for the list
};